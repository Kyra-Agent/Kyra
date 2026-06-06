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

Deno.test("telegram-disconnect enabled valid body remains inert not_configured", async () => {
  const order: string[] = [];
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
  assert(!serialized.includes(agentId), "Response must hide agent id.");
  assert(!serialized.includes(userId), "Response must hide user id.");
  assert(
    !serialized.includes("operator test"),
    "Response must hide operator note.",
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
