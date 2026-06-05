import {
  handleTelegramLinkRequest,
  type TelegramLinkDependencies,
} from "./core.ts";

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
const workspaceId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const sessionId = "44444444-4444-4444-8444-444444444444";
const challenge = "ab".repeat(32);
const challengeHash = "cd".repeat(32);
const botHandle = "@kyra_test_bot";

function makeRequest(options: {
  body?: string;
  authorization?: string;
  contentType?: string;
} = {}) {
  const headers = new Headers();

  if (options.authorization !== undefined) {
    headers.set("authorization", options.authorization);
  }

  if (options.contentType !== undefined) {
    headers.set("content-type", options.contentType);
  }

  return new Request("https://kyra.test/functions/v1/telegram-link", {
    method: "POST",
    headers,
    body: options.body ?? JSON.stringify({ agentId }),
  });
}

function createEnabledDependencies(
  overrides: Partial<TelegramLinkDependencies> = {},
): TelegramLinkDependencies {
  return {
    issueRuntimeConfig: { enabled: true },
    getEnv: (key) => `test-${key}`,
    getUser: async () => ({ id: userId }),
    lookupAgentOwnership: async () => ({
      agentId,
      ownerUserId: userId,
      workspaceId,
    }),
    lookupActiveTelegramSession: async () => ({
      telegramSessionId: sessionId,
      agentId,
      botHandle,
    }),
    createChallengeMaterial: async () => ({
      challenge,
      challengeHash,
      expiresAt: new Date(Date.now() + 9 * 60 * 1000).toISOString(),
    }),
    issueOwnerLinkChallenge: async () => ({ issued: true, status: "issued" }),
    ...overrides,
  };
}

Deno.test("telegram-link default-off response reads no body env session or RPC dependency", async () => {
  const request = new Request("https://kyra.test/functions/v1/telegram-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentId }),
  });
  const response = await handleTelegramLinkRequest(request, {
    issueRuntimeConfig: { enabled: false },
    getEnv: () => {
      throw new Error("Disabled handler must not read env.");
    },
    getUser: async () => {
      throw new Error("Disabled handler must not validate session.");
    },
    lookupAgentOwnership: async () => {
      throw new Error("Disabled handler must not query ownership.");
    },
  });
  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(!request.bodyUsed, "Disabled handler must not read body.");
});

Deno.test("telegram-link enabled path requires bearer before env and body access", async () => {
  let envRead = false;
  const request = new Request("https://kyra.test/functions/v1/telegram-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agentId }),
  });
  const response = await handleTelegramLinkRequest(
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

Deno.test("telegram-link enabled path runs auth ownership session generation and issue in order", async () => {
  const order: string[] = [];
  const issuedInputs: Array<Record<string, unknown>> = [];
  const expiresAt = new Date(Date.now() + 9 * 60 * 1000).toISOString();
  const response = await handleTelegramLinkRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
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
      async lookupAgentOwnership() {
        order.push("ownership");
        return { agentId, ownerUserId: userId, workspaceId };
      },
      async lookupActiveTelegramSession() {
        order.push("session");
        return { telegramSessionId: sessionId, agentId, botHandle };
      },
      async createChallengeMaterial() {
        order.push("generate");
        return { challenge, challengeHash, expiresAt };
      },
      async issueOwnerLinkChallenge(input) {
        order.push("issue");
        issuedInputs.push(input);
        return { issued: true, status: "issued" };
      },
    }),
  );
  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 200);
  assertEquals(body.status, "link_ready");
  assertEquals(
    body.telegramLink,
    `https://t.me/kyra_test_bot?start=${challenge}`,
  );
  assertEquals(body.expiresAt, expiresAt);
  assertEquals(
    order.join(","),
    "env:SUPABASE_URL,env:SUPABASE_ANON_KEY,auth,ownership,session,generate,issue",
  );
  assertEquals(issuedInputs.length, 1);
  assertEquals(issuedInputs[0]?.agentId, agentId);
  assertEquals(issuedInputs[0]?.telegramSessionId, sessionId);
  assertEquals(issuedInputs[0]?.issuedByUserId, userId);
  assertEquals(issuedInputs[0]?.challengeHash, challengeHash);
  assert(!serialized.includes(challengeHash), "Response must hide hash.");
  assert(!serialized.includes(agentId), "Response must hide agent id.");
  assert(!serialized.includes(sessionId), "Response must hide session id.");
  assert(!serialized.includes(userId), "Response must hide owner id.");
  assert(
    !serialized.includes("token_secret_ref"),
    "Response must hide token ref.",
  );
});

Deno.test("telegram-link rejects extra body fields including botToken", async () => {
  let ownershipCalled = false;
  const response = await handleTelegramLinkRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
      body: JSON.stringify({ agentId, botToken: "must-not-be-accepted" }),
    }),
    createEnabledDependencies({
      lookupAgentOwnership: async () => {
        ownershipCalled = true;
        throw new Error("Invalid body must reject before ownership.");
      },
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 400);
  assertEquals(body.status, "invalid_request");
  assert(!ownershipCalled, "Invalid body must reject before ownership.");
  assert(
    !JSON.stringify(body).includes("botToken"),
    "Response must hide token.",
  );
});

Deno.test("telegram-link never generates challenge before ownership and active session succeed", async () => {
  for (
    const overrides of [
      {
        lookupAgentOwnership: async () => null,
      },
      {
        lookupActiveTelegramSession: async () => {
          throw new Error("raw token_secret_ref session failure");
        },
      },
    ]
  ) {
    let generated = false;
    let issued = false;
    const response = await handleTelegramLinkRequest(
      makeRequest({
        authorization: "Bearer session",
        contentType: "application/json",
      }),
      createEnabledDependencies({
        ...overrides,
        createChallengeMaterial: async () => {
          generated = true;
          throw new Error("Must not generate.");
        },
        issueOwnerLinkChallenge: async () => {
          issued = true;
          throw new Error("Must not issue.");
        },
      }),
    );
    const body = await readJson(response);
    const serialized = JSON.stringify(body);

    assert(response.status >= 400, "Failure must return error response.");
    assert(!generated, "Challenge must not be generated.");
    assert(!issued, "Issue RPC must not be called.");
    assert(
      !serialized.includes("token_secret_ref"),
      "Error must hide token ref.",
    );
  }
});

Deno.test("telegram-link sanitizes invalid challenge material and issue failures", async () => {
  for (
    const overrides of [
      {
        createChallengeMaterial: async () => ({
          challenge,
          challengeHash,
          expiresAt: "expired",
        }),
      },
      {
        issueOwnerLinkChallenge: async () => {
          throw new Error(
            `raw owner_user_id ${userId} token_secret_ref ${challengeHash}`,
          );
        },
      },
      {
        issueOwnerLinkChallenge:
          async () => ({ issued: false, status: "issued" } as never),
      },
    ]
  ) {
    const response = await handleTelegramLinkRequest(
      makeRequest({
        authorization: "Bearer session",
        contentType: "application/json",
      }),
      createEnabledDependencies(overrides),
    );
    const body = await readJson(response);
    const serialized = JSON.stringify(body);

    assertEquals(response.status, 500);
    assertEquals(body.status, "server_error");
    assert(!serialized.includes(userId), "Error must hide owner id.");
    assert(!serialized.includes(challengeHash), "Error must hide hash.");
    assert(
      !serialized.includes("token_secret_ref"),
      "Error must hide token ref.",
    );
  }
});

Deno.test("telegram-link OPTIONS returns CORS response", async () => {
  const response = await handleTelegramLinkRequest(
    new Request("https://kyra.test/functions/v1/telegram-link", {
      method: "OPTIONS",
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "ok");
  assertEquals(
    response.headers.get("Access-Control-Allow-Methods"),
    "POST, OPTIONS",
  );
});
