import {
  assertTelegramDisconnectBody,
  handleTelegramDisconnectRequest,
  type TelegramDisconnectDependencies,
} from "./core.ts";
import { HttpError } from "../telegram-connect/core.ts";
import {
  createTelegramDisconnectRuntimeConfig,
  isTelegramDisconnectEnabled,
} from "./runtime-config.ts";
import {
  createTelegramDisconnectDependenciesFromOptions,
} from "./dependencies.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

async function readJson(response: Response) {
  return await response.json() as Record<string, unknown>;
}

const agentId = "11111111-1111-4111-8111-111111111111";
const telegramSessionId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";

function makeRequest(options: {
  body?: string;
  authorization?: string;
  contentType?: string;
  contentLength?: string;
} = {}) {
  const headers = new Headers();

  if (options.authorization !== undefined) {
    headers.set("authorization", options.authorization);
  }

  if (options.contentType !== undefined) {
    headers.set("content-type", options.contentType);
  }

  if (options.contentLength !== undefined) {
    headers.set("content-length", options.contentLength);
  }

  return new Request("https://kyra.test/functions/v1/telegram-disconnect", {
    method: "POST",
    headers,
    body: options.body ?? JSON.stringify({ agentId, action: "pause" }),
  });
}

function createEnabledDependencies(
  overrides: Partial<TelegramDisconnectDependencies> = {},
): TelegramDisconnectDependencies {
  return {
    disconnectRuntimeConfig: { enabled: true },
    getEnv: (key) => `test-${key}`,
    getUser: async () => ({ id: userId }),
    ...overrides,
  };
}

Deno.test("telegram-disconnect runtime gate defaults off and requires exact true", () => {
  assertEquals(isTelegramDisconnectEnabled(undefined), false);
  assertEquals(isTelegramDisconnectEnabled(""), false);
  assertEquals(isTelegramDisconnectEnabled("TRUE"), false);
  assertEquals(isTelegramDisconnectEnabled("1"), false);
  assertEquals(isTelegramDisconnectEnabled("true"), true);
});

Deno.test("telegram-disconnect runtime config reads only its exact gate key", () => {
  const keys: string[] = [];
  const config = createTelegramDisconnectRuntimeConfig((key) => {
    keys.push(key);
    return "";
  });

  assertEquals(config.enabled, false);
  assertEquals(keys.join(","), "KYRA_TELEGRAM_DISCONNECT_ENABLED");
});

Deno.test("telegram-disconnect default-off response reads no body env or session dependency", async () => {
  const request = new Request(
    "https://kyra.test/functions/v1/telegram-disconnect",
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ agentId, action: "revoke" }),
    },
  );
  const response = await handleTelegramDisconnectRequest(request, {
    disconnectRuntimeConfig: { enabled: false },
    getEnv: () => {
      throw new Error("Disabled handler must not read env.");
    },
    getUser: async () => {
      throw new Error("Disabled handler must not validate session.");
    },
  });
  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(!request.bodyUsed, "Disabled handler must not read body.");
});

Deno.test("telegram-disconnect OPTIONS returns CORS response", async () => {
  const response = await handleTelegramDisconnectRequest(
    new Request("https://kyra.test/functions/v1/telegram-disconnect", {
      method: "OPTIONS",
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "ok");
  assertEquals(response.headers.get("access-control-allow-origin"), "*");
});

Deno.test("telegram-disconnect rejects unsupported content type before env and body access", async () => {
  let envRead = false;
  const request = makeRequest({
    contentType: "text/plain",
    authorization: "Bearer session",
  });
  const response = await handleTelegramDisconnectRequest(
    request,
    createEnabledDependencies({
      getEnv: () => {
        envRead = true;
        return "unexpected";
      },
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 415);
  assertEquals(body.status, "unsupported_media_type");
  assert(!envRead, "Content type guard must reject before env read.");
  assert(!request.bodyUsed, "Content type guard must reject before body read.");
});

Deno.test("telegram-disconnect rejects oversized content-length before env and body access", async () => {
  let envRead = false;
  const request = makeRequest({
    authorization: "Bearer session",
    contentType: "application/json",
    contentLength: "4097",
  });
  const response = await handleTelegramDisconnectRequest(
    request,
    createEnabledDependencies({
      getEnv: () => {
        envRead = true;
        return "unexpected";
      },
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 413);
  assertEquals(body.status, "payload_too_large");
  assert(!envRead, "Body size guard must reject before env read.");
  assert(!request.bodyUsed, "Body size guard must reject before body read.");
});

Deno.test("telegram-disconnect enabled path requires bearer before env and body access", async () => {
  let envRead = false;
  const request = makeRequest({ contentType: "application/json" });
  const response = await handleTelegramDisconnectRequest(
    request,
    createEnabledDependencies({
      getEnv: () => {
        envRead = true;
        return "unexpected";
      },
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 401);
  assertEquals(body.status, "unauthorized");
  assert(!envRead, "Missing bearer must reject before env read.");
  assert(!request.bodyUsed, "Missing bearer must reject before body read.");
});

Deno.test("telegram-disconnect invalid session returns sanitized unauthorized", async () => {
  const response = await handleTelegramDisconnectRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
    }),
    createEnabledDependencies({
      getUser: async () => {
        throw new HttpError(
          401,
          "unauthorized",
          "A valid Supabase session is required.",
        );
      },
    }),
  );
  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 401);
  assertEquals(body.status, "unauthorized");
  assert(!serialized.includes("Bearer"), "Response must hide bearer details.");
});

Deno.test("telegram-disconnect disconnect action remains inert and does not claim session", async () => {
  const order: string[] = [];
  let claimCalled = false;
  const response = await handleTelegramDisconnectRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
      body: JSON.stringify({
        agentId,
        action: "disconnect",
        reason: "operator test",
      }),
    }),
    createEnabledDependencies({
      getEnv(key) {
        order.push(`env:${key}`);
        return `test-${key}`;
      },
      async getUser() {
        order.push("auth");
        return { id: userId };
      },
      claimTelegramDisconnectSession: async () => {
        claimCalled = true;
        throw new Error("Disconnect action must not claim session yet.");
      },
    }),
  );
  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assertEquals(
    order.join(","),
    "env:SUPABASE_URL,env:SUPABASE_ANON_KEY,auth",
  );
  assert(!claimCalled, "Disconnect action must remain inert.");
  assert(!serialized.includes(agentId), "Response must hide agent id.");
  assert(!serialized.includes(userId), "Response must hide user id.");
  assert(
    !serialized.includes("operator test"),
    "Response must hide operator note.",
  );
});

Deno.test("telegram-disconnect revoke action remains inert and does not claim session", async () => {
  let claimCalled = false;
  const response = await handleTelegramDisconnectRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
      body: JSON.stringify({
        agentId,
        action: "revoke",
      }),
    }),
    createEnabledDependencies({
      claimTelegramDisconnectSession: async () => {
        claimCalled = true;
        throw new Error("Revoke action must not claim session yet.");
      },
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(!claimCalled, "Revoke action must remain inert.");
});

Deno.test("telegram-disconnect pause action claims session and returns sanitized paused response", async () => {
  const claimedInputs: Array<Record<string, unknown>> = [];
  const response = await handleTelegramDisconnectRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
      body: JSON.stringify({
        agentId,
        action: "pause",
        reason: "operator test",
      }),
    }),
    createEnabledDependencies({
      claimTelegramDisconnectSession: async (input) => {
        claimedInputs.push(input);
        return {
          claimed: true,
          action: input.action,
          telegramSessionId,
          agentId: input.agentId,
          botHandle: "@kyra_test_bot",
        };
      },
    }),
  );
  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.status, "paused");
  assertEquals(claimedInputs.length, 1);
  assertEquals(claimedInputs[0].agentId, agentId);
  assertEquals(claimedInputs[0].ownerUserId, userId);
  assertEquals(claimedInputs[0].action, "pause");
  assert(!serialized.includes(agentId), "Response must hide agent id.");
  assert(!serialized.includes(userId), "Response must hide owner user id.");
  assert(!serialized.includes(telegramSessionId), "Response must hide session id.");
  assert(!serialized.includes("@kyra_test_bot"), "Response must hide bot handle.");
  assert(!serialized.includes("operator test"), "Response must hide reason.");
  assert(!serialized.includes("token"), "Response must not mention token data.");
  assert(
    !serialized.includes("webhook"),
    "Response must not mention webhook secret data.",
  );
});

Deno.test("telegram-disconnect dependencies keep disabled gate free of required env and claim wiring", () => {
  const requiredEnvReads: string[] = [];
  const optionalEnvReads: string[] = [];
  const dependencies = createTelegramDisconnectDependenciesFromOptions({
    getOptionalEnv(key) {
      optionalEnvReads.push(key);
      return "";
    },
    getEnv(key) {
      requiredEnvReads.push(key);
      throw new Error("Disabled dependency setup must not read required env.");
    },
    getUser: async () => {
      throw new Error("Disabled dependency setup must not configure auth.");
    },
  });

  assertEquals(dependencies.disconnectRuntimeConfig?.enabled, false);
  assertEquals(requiredEnvReads.length, 0);
  assertEquals(optionalEnvReads.join(","), "KYRA_TELEGRAM_DISCONNECT_ENABLED");
  assertEquals(typeof dependencies.getEnv, "undefined");
  assertEquals(typeof dependencies.getUser, "undefined");
  assertEquals(typeof dependencies.claimTelegramDisconnectSession, "undefined");
});

Deno.test("telegram-disconnect dependencies read service role lazily only when pause claim runs", async () => {
  const envReads: string[] = [];
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = [];
  const dependencies = createTelegramDisconnectDependenciesFromOptions({
    getOptionalEnv(key) {
      assertEquals(key, "KYRA_TELEGRAM_DISCONNECT_ENABLED");
      return "true";
    },
    getEnv(key) {
      envReads.push(key);

      if (key === "SUPABASE_URL") {
        return "https://project.supabase.co";
      }

      if (key === "SUPABASE_ANON_KEY") {
        return "anon-key";
      }

      if (key === "SUPABASE_SERVICE_ROLE_KEY") {
        return "service-role-secret";
      }

      throw new Error(`Unexpected env key: ${key}`);
    },
    fetchRpc: async (input, init) => {
      fetchCalls.push({ url: String(input), init });
      return new Response(
        JSON.stringify([
          {
            claimed: true,
            status: "claimed",
            telegram_session_id: telegramSessionId,
            agent_id: agentId,
            bot_handle: "@kyra_test_bot",
            token_secret_ref: null,
            webhook_secret_ref: null,
          },
        ]),
        {
          status: 200,
          headers: { "content-type": "application/json" },
        },
      );
    },
    getUser: async () => ({ id: userId }),
  });

  assertEquals(dependencies.disconnectRuntimeConfig?.enabled, true);
  assertEquals(envReads.length, 0);
  assertEquals(fetchCalls.length, 0);
  assertEquals(typeof dependencies.claimTelegramDisconnectSession, "function");

  const claim = await dependencies.claimTelegramDisconnectSession?.({
    agentId,
    ownerUserId: userId,
    action: "pause",
  });

  assertEquals(claim?.action, "pause");
  assertEquals(envReads.join(","), "SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY");
  assertEquals(fetchCalls.length, 1);
  assertEquals(
    fetchCalls[0].url,
    "https://project.supabase.co/rest/v1/rpc/claim_telegram_disconnect_session",
  );
  assertEquals(fetchCalls[0].init?.method, "POST");
  const requestBody = JSON.parse(String(fetchCalls[0].init?.body)) as Record<
    string,
    unknown
  >;
  assertEquals(requestBody.p_agent_id, agentId);
  assertEquals(requestBody.p_owner_user_id, userId);
  assertEquals(requestBody.p_action, "pause");
  assert(
    !JSON.stringify(claim).includes("service-role-secret"),
    "Claim result must not echo service role key.",
  );
});

Deno.test("telegram-disconnect rejects invalid JSON with sanitized 400", async () => {
  const response = await handleTelegramDisconnectRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
      body: "{",
    }),
    createEnabledDependencies(),
  );
  const body = await readJson(response);

  assertEquals(response.status, 400);
  assertEquals(body.status, "invalid_request");
});

Deno.test("telegram-disconnect rejects extra fields including botToken", async () => {
  const response = await handleTelegramDisconnectRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
      body: JSON.stringify({
        agentId,
        action: "pause",
        botToken: "must-not-be-accepted",
      }),
    }),
    createEnabledDependencies(),
  );
  const body = await readJson(response);

  assertEquals(response.status, 400);
  assertEquals(body.status, "invalid_request");
  assert(
    !JSON.stringify(body).includes("botToken"),
    "Response must hide token.",
  );
});

Deno.test("telegram-disconnect validates action and bounded reason", () => {
  assertEquals(
    assertTelegramDisconnectBody({ agentId, action: "pause" }).action,
    "pause",
  );
  assertEquals(
    assertTelegramDisconnectBody({
      agentId,
      action: "revoke",
      reason: "  rotate bot  ",
    }).reason,
    "rotate bot",
  );

  for (
    const body of [
      { agentId, action: "delete" },
      { agentId, action: "pause", reason: "x".repeat(161) },
      { agentId, action: "pause", reason: 1 },
      { agentId: "not-a-uuid", action: "pause" },
    ]
  ) {
    let threw = false;

    try {
      assertTelegramDisconnectBody(body);
    } catch {
      threw = true;
    }

    assert(threw, `Expected invalid body to throw: ${JSON.stringify(body)}`);
  }
});
