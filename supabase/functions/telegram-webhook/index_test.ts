import {
  assertActiveTelegramWebhookSession,
  assertBodySizeFromHeaders,
  assertTelegramWebhookChatAuthorized,
  assertTelegramWebhookSecretHash,
  assertTelegramWebhookSessionLookupResult,
  assertTelegramWebhookSessionLookupRows,
  createTelegramWebhookDependencies,
  handleTelegramWebhookRequest,
  HttpError,
  maxTelegramWebhookBodyBytes,
  readTelegramWebhookUpdateBody,
  sanitizeErrorMessage,
  sanitizeTelegramWebhookSessionLookupError,
  telegramWebhookChatAuthEnabledEnvKey,
  telegramWebhookClaimEnabledEnvKey,
  telegramWebhookDeliveryEnabledEnvKey,
  telegramWebhookAgentBrainEnabledEnvKey,
  telegramWebhookAgentBrainProviderEnabledEnvKey,
  telegramWebhookLookupEnabledEnvKey,
  telegramWebhookOwnerLinkConsumeEnabledEnvKey,
  telegramWebhookParseEnabledEnvKey,
  telegramWebhookTemplateContextEnabledEnvKey,
} from "./index.ts";

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

function assertThrowsHttpError(
  action: () => unknown,
  expectedStatusCode: number,
  expectedCode: string,
) {
  let error: unknown;

  try {
    action();
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof HttpError, "Expected action to throw HttpError.");
  assertEquals((error as HttpError).statusCode, expectedStatusCode);
  assertEquals((error as HttpError).code, expectedCode);

  return error as HttpError;
}

async function readJson(response: Response) {
  return await response.json() as Record<string, unknown>;
}

async function captureError(action: () => Promise<unknown> | unknown) {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw.");
}

function requestThatFailsIfBodyIsRead(
  headers: HeadersInit,
  onRead: () => void,
) {
  return {
    method: "POST",
    headers: new Headers(headers),
    get body() {
      onRead();
      throw new Error("Request body must not be read.");
    },
    async json() {
      onRead();
      throw new Error("Request body must not be parsed as JSON.");
    },
    async text() {
      onRead();
      throw new Error("Request body must not be read as text.");
    },
    async arrayBuffer() {
      onRead();
      throw new Error("Request body must not be read as bytes.");
    },
  } as unknown as Request;
}

function createWebhookUpdate(text: string = "/status") {
  return {
    update_id: 9001,
    message: {
      message_id: 42,
      from: { id: 123456 },
      chat: { id: -987654 },
      text,
    },
  };
}

function createOwnerLinkWebhookUpdate(text: string) {
  return {
    update_id: 9001,
    message: {
      message_id: 42,
      from: { id: 123456 },
      chat: { id: 123456, type: "private" },
      text,
    },
  };
}

function createJsonWebhookRequest(body: unknown, headers: HeadersInit = {}) {
  return new Request("https://kyra.test/functions/v1/telegram-webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-telegram-bot-api-secret-token": "test-webhook-secret",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const testWebhookSecretHash =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const testTelegramSessionId = "11111111-1111-4111-8111-111111111111";
const testBotToken = "123456789:abcdefghijklmnopqrstuvwxyzABCDE";

const activeLookupRow = {
  session_id: "telegram-session-1",
  agent_id: "agent-1",
  workspace_id: "workspace-1",
  owner_user_id: "owner-1",
  bot_handle: "@kyra_test_bot",
  webhook_status: "active",
};

Deno.test("telegram-webhook rejects missing Telegram secret before body read", async () => {
  let bodyRead = false;

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      { "content-type": "application/json" },
      () => {
        bodyRead = true;
      },
    ),
  );

  const body = await readJson(response);

  assertEquals(response.status, 401);
  assertEquals(body.ok, false);
  assertEquals(body.status, "webhook_verification_failed");
  assertEquals(body.message, "Telegram webhook verification failed.");
  assert(
    !bodyRead,
    "Webhook body must not be read before secret verification.",
  );
});

Deno.test("telegram-webhook returns inert not_configured response without reading body", async () => {
  let bodyRead = false;

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
  );

  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.ok, false);
  assertEquals(body.status, "not_configured");
  assertEquals(
    body.message,
    "Telegram webhook is planned but not enabled yet.",
  );
  assert(
    !bodyRead,
    "Inert webhook skeleton must not parse or read the request body.",
  );
});

Deno.test("telegram-webhook disabled lookup gate does not call lookup dependency", async () => {
  let bodyRead = false;
  let lookupCalled = false;

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
    {
      lookupRuntimeConfig: { enabled: false },
      lookupTelegramWebhookSession: async () => {
        lookupCalled = true;
        throw new Error("Disabled lookup must not be called.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(!lookupCalled, "Disabled lookup gate must not call lookup.");
  assert(!bodyRead, "Disabled lookup gate must not read request body.");
});

Deno.test("telegram-webhook enabled lookup gate calls lookup without reading body", async () => {
  let bodyRead = false;
  const lookupInputs: string[] = [];

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
    {
      lookupRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async (webhookSecretHeader) => {
        lookupInputs.push(webhookSecretHeader);
        return {
          sessionId: "telegram-session-1",
          agentId: "agent-1",
          workspaceId: "workspace-1",
          ownerUserId: "owner-1",
          botHandle: "@kyra_test_bot",
          webhookStatus: "active",
        };
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assertEquals(lookupInputs.length, 1);
  assertEquals(lookupInputs[0], "test-webhook-secret");
  assert(!bodyRead, "Enabled lookup gate must not read request body.");
});

Deno.test("telegram-webhook rejects unsupported content type before lookup", async () => {
  let bodyRead = false;
  let lookupCalled = false;

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "text/plain",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
    {
      lookupRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => {
        lookupCalled = true;
        throw new Error("Lookup must not run before content-type guard.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 415);
  assertEquals(body.status, "unsupported_media_type");
  assert(!lookupCalled, "Content-type guard must run before lookup.");
  assert(!bodyRead, "Content-type guard must not read request body.");
});

Deno.test("telegram-webhook rejects oversized content length before lookup", async () => {
  let bodyRead = false;
  let lookupCalled = false;

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-length": String(maxTelegramWebhookBodyBytes + 1),
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
    {
      lookupRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => {
        lookupCalled = true;
        throw new Error("Lookup must not run before body size guard.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 413);
  assertEquals(body.status, "payload_too_large");
  assert(!lookupCalled, "Body size guard must run before lookup.");
  assert(!bodyRead, "Body size guard must not read request body.");
});

Deno.test("telegram-webhook enabled lookup returns sanitized session miss before body read", async () => {
  let bodyRead = false;

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "raw-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
    {
      lookupRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => {
        throw new HttpError(
          404,
          "session_not_found",
          "Telegram webhook session was not found.",
        );
      },
    },
  );

  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 404);
  assertEquals(body.status, "session_not_found");
  assert(
    !serialized.includes("raw-webhook-secret"),
    "Lookup miss response must not echo the raw webhook secret.",
  );
  assert(!bodyRead, "Lookup failures must not read request body.");
});

Deno.test("telegram-webhook parse gate requires lookup before body read", async () => {
  let bodyRead = false;

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
    {
      lookupRuntimeConfig: { enabled: false },
      parseRuntimeConfig: { enabled: true },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(
    body.message,
    "Telegram webhook parsing requires session lookup.",
  );
  assert(!bodyRead, "Parse gate must not read body without session lookup.");
});

Deno.test("telegram-webhook parse gate parses valid update and remains inert", async () => {
  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/status@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
});

Deno.test("telegram-webhook parse gate sanitizes invalid JSON", async () => {
  const rawBody = "{private malformed json";
  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(rawBody),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
    },
  );

  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 400);
  assertEquals(body.status, "invalid_request");
  assert(!serialized.includes(rawBody), "Invalid JSON must not be echoed.");
});

Deno.test("telegram-webhook parse gate sanitizes unsupported updates", async () => {
  const rawCommand = "/approve private-wallet";
  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate(rawCommand)),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
    },
  );

  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 422);
  assertEquals(body.status, "unsupported_update");
  assert(!serialized.includes(rawCommand), "Raw command must not be echoed.");
  assert(
    !serialized.includes("123456"),
    "Telegram user id must not be echoed.",
  );
  assert(
    !serialized.includes("-987654"),
    "Telegram chat id must not be echoed.",
  );
});

Deno.test("telegram-webhook owner-link consume gate requires lookup before body read", async () => {
  let bodyRead = false;

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
    {
      lookupRuntimeConfig: { enabled: false },
      ownerLinkConsumeRuntimeConfig: { enabled: true },
    },
  );
  const body = await readJson(response);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(
    body.message,
    "Telegram owner-link consume requires session lookup.",
  );
  assert(!bodyRead, "Owner-link consume must require lookup before body read.");
});

Deno.test("telegram-webhook owner-link consume runs after lookup and bypasses normal pipeline", async () => {
  const challenge = "ab".repeat(32);
  const consumed: Array<Record<string, unknown>> = [];
  let normalPipelineCalled = false;
  const request = createJsonWebhookRequest(
    createOwnerLinkWebhookUpdate(`/start ${challenge}`),
  );
  const response = await handleTelegramWebhookRequest(request, {
    lookupRuntimeConfig: { enabled: true },
    parseRuntimeConfig: { enabled: true },
    chatAuthRuntimeConfig: { enabled: true },
    claimRuntimeConfig: { enabled: true },
    deliveryRuntimeConfig: { enabled: true },
    ownerLinkConsumeRuntimeConfig: { enabled: true },
    lookupTelegramWebhookSession: async () => ({
      sessionId: testTelegramSessionId,
      agentId: "agent-1",
      workspaceId: "workspace-1",
      ownerUserId: "owner-1",
      botHandle: "@kyra_test_bot",
      webhookStatus: "active",
    }),
    consumeTelegramOwnerLinkChallenge: async (input) => {
      consumed.push(input);
      return { linked: true, status: "linked" };
    },
    lookupTelegramChatAuthorization: async () => {
      normalPipelineCalled = true;
      throw new Error("Owner-link route must bypass chat authorization.");
    },
    claimTelegramUpdate: async () => {
      normalPipelineCalled = true;
      throw new Error("Owner-link route must bypass normal claim.");
    },
    deliverTelegramReadOnlyResponse: async () => {
      normalPipelineCalled = true;
      throw new Error("Owner-link route must bypass delivery.");
    },
  });
  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.status, "received");
  assertEquals(body.message, "Telegram update received.");
  assertEquals(consumed.length, 1);
  assertEquals(consumed[0]?.telegramSessionId, testTelegramSessionId);
  assertEquals(consumed[0]?.telegramUpdateId, "9001");
  assertEquals(consumed[0]?.telegramUserId, "123456");
  assertEquals(consumed[0]?.telegramChatId, "123456");
  assert(
    typeof consumed[0]?.challengeHash === "string" &&
      consumed[0]?.challengeHash !== challenge,
    "Owner-link consume must receive only the challenge hash.",
  );
  assert(request.bodyUsed, "Owner-link route must read the body once.");
  assert(
    !normalPipelineCalled,
    "Owner-link route must bypass the normal pipeline.",
  );
  assert(!serialized.includes(challenge), "Response must hide challenge.");
  assert(
    !serialized.includes(testTelegramSessionId),
    "Response must hide session id.",
  );
  assert(!serialized.includes("123456"), "Response must hide Telegram ids.");
});

Deno.test("telegram-webhook invalid owner-link candidate returns generic acknowledgement", async () => {
  let consumeCalled = false;
  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createOwnerLinkWebhookUpdate("/start invalid")),
    {
      lookupRuntimeConfig: { enabled: true },
      ownerLinkConsumeRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: testTelegramSessionId,
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      consumeTelegramOwnerLinkChallenge: async () => {
        consumeCalled = true;
        throw new Error("Invalid owner-link candidate must not consume.");
      },
    },
  );
  const body = await readJson(response);

  assertEquals(response.status, 200);
  assertEquals(body.status, "received");
  assert(!consumeCalled, "Invalid owner-link candidate must not consume.");
});

Deno.test("telegram-webhook owner-link consume gate preserves normal read-only route", async () => {
  let consumeCalled = false;
  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/status@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      ownerLinkConsumeRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: testTelegramSessionId,
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      consumeTelegramOwnerLinkChallenge: async () => {
        consumeCalled = true;
        throw new Error("Normal read-only route must not consume owner link.");
      },
    },
  );
  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(!consumeCalled, "Normal read-only route must not consume owner link.");
});

Deno.test("telegram-webhook disabled chat auth gate does not call auth dependency", async () => {
  let authCalled = false;

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/status@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: false },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => {
        authCalled = true;
        throw new Error("Disabled chat auth must not be called.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(!authCalled, "Disabled chat auth gate must not call auth lookup.");
});

Deno.test("telegram-webhook chat auth gate requires parsed update before auth", async () => {
  let bodyRead = false;
  let authCalled = false;

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: false },
      chatAuthRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => {
        authCalled = true;
        throw new Error("Chat auth must not run before parsing.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(
    body.message,
    "Telegram chat authorization requires parsed update.",
  );
  assert(!authCalled, "Chat auth must not run without parsed update.");
  assert(!bodyRead, "Chat auth misconfiguration must not read body.");
});

Deno.test("telegram-webhook chat auth gate authorizes parsed read-only update and remains inert", async () => {
  const authInputs: Array<Record<string, unknown>> = [];

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/status@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async (input) => {
        authInputs.push(input);
        return { authorized: true, role: "owner" };
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assertEquals(authInputs.length, 1);
  assertEquals(authInputs[0]?.agentId, "agent-1");
  assertEquals(authInputs[0]?.telegramUserId, "123456");
  assertEquals(authInputs[0]?.telegramChatId, "-987654");
  assertEquals(authInputs[0]?.commandKind, "read_only");
});

Deno.test("telegram-webhook chat auth gate returns sanitized unauthorized chat", async () => {
  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/help@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => {
        throw new HttpError(
          403,
          "chat_not_authorized",
          "Telegram chat is not authorized.",
        );
      },
    },
  );

  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 403);
  assertEquals(body.status, "chat_not_authorized");
  assert(!serialized.includes("123456"), "User id must not be echoed.");
  assert(!serialized.includes("-987654"), "Chat id must not be echoed.");
  assert(!serialized.includes("agent-1"), "Agent id must not be echoed.");
});

Deno.test("telegram-webhook disabled claim gate does not call claim dependency", async () => {
  let claimCalled = false;

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/status@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: false },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => {
        claimCalled = true;
        throw new Error("Disabled claim must not run.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(!claimCalled, "Disabled claim gate must not call claim dependency.");
});

Deno.test("telegram-webhook claim gate requires authorized parsed update", async () => {
  let bodyRead = false;
  let claimCalled = false;

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: false },
      chatAuthRuntimeConfig: { enabled: false },
      claimRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      claimTelegramUpdate: async () => {
        claimCalled = true;
        throw new Error("Claim must not run before parsing and auth.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(
    body.message,
    "Telegram update claim requires authorized parsed update.",
  );
  assert(!claimCalled, "Claim must not run before parsed authorized update.");
  assert(!bodyRead, "Claim prerequisite failure must not read body.");
});

Deno.test("telegram-webhook claim gate runs after chat authorization and remains inert", async () => {
  const claimInputs: Array<Record<string, unknown>> = [];

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/status@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async (input) => {
        claimInputs.push(input);
        return { claimed: true, status: "claimed" };
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assertEquals(claimInputs.length, 1);
  assertEquals(claimInputs[0]?.telegramSessionId, "telegram-session-1");
  assertEquals(claimInputs[0]?.telegramUpdateId, "9001");
});

Deno.test("telegram-webhook claim failure is sanitized", async () => {
  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/help@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => {
        throw new HttpError(
          500,
          "server_error",
          "Telegram update claim failed.",
        );
      },
    },
  );

  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(body.message, "Telegram update claim failed.");
  assert(!serialized.includes("9001"), "Update id must not be echoed.");
  assert(
    !serialized.includes("telegram-session-1"),
    "Session id must not be echoed.",
  );
});

Deno.test("telegram-webhook unexpected claim failure is sanitized", async () => {
  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/help@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => {
        throw new Error(
          "raw claim failure update 9001 telegram-session-1 owner-1",
        );
      },
    },
  );

  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(body.message, "Telegram update claim failed.");
  assert(!serialized.includes("9001"), "Update id must not be echoed.");
  assert(
    !serialized.includes("telegram-session-1"),
    "Session id must not be echoed.",
  );
  assert(!serialized.includes("owner-1"), "Owner id must not be echoed.");
});

Deno.test("telegram-webhook disabled delivery gate does not call delivery dependency", async () => {
  let deliveryCalled = false;

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/status@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: false },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      deliverTelegramReadOnlyResponse: async () => {
        deliveryCalled = true;
        throw new Error("Disabled delivery must not run.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(
    !deliveryCalled,
    "Disabled delivery gate must not call delivery dependency.",
  );
});

Deno.test("telegram-webhook delivery gate requires a claimed update", async () => {
  let bodyRead = false;
  let deliveryCalled = false;

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: false },
      chatAuthRuntimeConfig: { enabled: false },
      claimRuntimeConfig: { enabled: false },
      deliveryRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      deliverTelegramReadOnlyResponse: async () => {
        deliveryCalled = true;
        throw new Error("Delivery must not run before claim.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(
    body.message,
    "Telegram response delivery requires a claimed update.",
  );
  assert(!deliveryCalled, "Delivery must not run before claim result.");
  assert(!bodyRead, "Delivery prerequisite failure must not read body.");
});

Deno.test("telegram-webhook delivery gate sends claimed read-only response", async () => {
  const deliveries: Array<Record<string, unknown>> = [];

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/status@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      deliverTelegramReadOnlyResponse: async (input) => {
        deliveries.push(input);
        return { delivered: true };
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.status, "delivered");
  assertEquals(deliveries.length, 1);
  assertEquals(deliveries[0]?.telegramSessionId, "telegram-session-1");
  assertEquals(deliveries[0]?.telegramChatId, "-987654");
  assertEquals(
    (deliveries[0]?.response as Record<string, unknown> | undefined)?.command,
    "status",
  );
});

Deno.test("telegram-webhook template context gate stays off by default", async () => {
  let templateContextCalled = false;
  const deliveries: Array<Record<string, unknown>> = [];

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/agent@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      templateContextRuntimeConfig: { enabled: false },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      lookupTelegramTemplateContext: async () => {
        templateContextCalled = true;
        throw new Error("Disabled template context must not be called.");
      },
      deliverTelegramReadOnlyResponse: async (input) => {
        deliveries.push(input);
        return { delivered: true };
      },
    },
  );

  const body = await readJson(response);
  const deliveredResponse = deliveries[0]?.response as
    | Record<string, unknown>
    | undefined;

  assertEquals(response.status, 200);
  assertEquals(body.status, "delivered");
  assertEquals(templateContextCalled, false);
  assertEquals(deliveries.length, 1);
  assertEquals(deliveredResponse?.command, "agent");
  assert(
    String(deliveredResponse?.text ?? "").includes("Kyra agent: active"),
    "Default-off gate must keep static /agent response.",
  );
});

Deno.test("telegram-webhook template context gate enriches agent response", async () => {
  const deliveries: Array<Record<string, unknown>> = [];
  const templateContextAgentIds: string[] = [];
  const templateContextCommands: string[] = [];

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/agent@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      templateContextRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      lookupTelegramTemplateContext: async (agentId, command) => {
        templateContextAgentIds.push(agentId);
        templateContextCommands.push(command);
        return {
          context: {
            templateId: "strategist",
            name: "Strategist",
            role: "Market and campaign intelligence agent",
            summary: "Market planning agent.",
            actions: [],
            modules: [],
            readOnlyActions: ["market brief"],
            gatedActions: [],
            safetyNote: "Telegram is read-only.",
          },
          text: "Strategist: read-only market brief ready.",
        };
      },
      deliverTelegramReadOnlyResponse: async (input) => {
        deliveries.push(input);
        return { delivered: true };
      },
    },
  );

  const body = await readJson(response);
  const deliveredResponse = deliveries[0]?.response as
    | Record<string, unknown>
    | undefined;

  assertEquals(response.status, 200);
  assertEquals(body.status, "delivered");
  assertEquals(templateContextAgentIds.join(","), "agent-1");
  assertEquals(templateContextCommands.join(","), "agent");
  assertEquals(deliveries.length, 1);
  assertEquals(deliveredResponse?.command, "agent");
  assertEquals(
    deliveredResponse?.text,
    "Strategist: read-only market brief ready.",
  );
});

Deno.test("telegram-webhook template context gate enriches modules response", async () => {
  const deliveries: Array<Record<string, unknown>> = [];
  const templateContextAgentIds: string[] = [];
  const templateContextCommands: string[] = [];

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/modules@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      templateContextRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      lookupTelegramTemplateContext: async (agentId, command) => {
        templateContextAgentIds.push(agentId);
        templateContextCommands.push(command);
        return {
          context: {
            templateId: "strategist",
            name: "Strategist",
            role: "Market and campaign intelligence agent",
            summary: "Market planning agent.",
            actions: [],
            modules: [
              {
                name: "NIRA-01",
                title: "Narrative intelligence",
                telegramStatus: "active",
              },
              {
                name: "ASTRA-03",
                title: "Execution guard",
                telegramStatus: "guard",
              },
            ],
            readOnlyActions: ["market brief"],
            gatedActions: [],
            safetyNote: "Telegram is read-only.",
          },
          text: "Strategist modules: NIRA-01 active, ASTRA-03 guarded.",
        };
      },
      deliverTelegramReadOnlyResponse: async (input) => {
        deliveries.push(input);
        return { delivered: true };
      },
    },
  );

  const body = await readJson(response);
  const deliveredResponse = deliveries[0]?.response as
    | Record<string, unknown>
    | undefined;

  assertEquals(response.status, 200);
  assertEquals(body.status, "delivered");
  assertEquals(templateContextAgentIds.join(","), "agent-1");
  assertEquals(templateContextCommands.join(","), "modules");
  assertEquals(deliveries.length, 1);
  assertEquals(deliveredResponse?.command, "modules");
  assertEquals(
    deliveredResponse?.text,
    "Strategist modules: NIRA-01 active, ASTRA-03 guarded.",
  );
});

Deno.test("telegram-webhook agent brain gate stays off by default", async () => {
  let agentBrainCalled = false;
  const deliveries: Array<Record<string, unknown>> = [];

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/agent@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      templateContextRuntimeConfig: { enabled: true },
      agentBrainRuntimeConfig: { enabled: false },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      lookupTelegramTemplateContext: async () => ({
        context: {
          templateId: "strategist",
          name: "Strategist",
          role: "Market and campaign intelligence agent",
          summary: "Market planning agent.",
          actions: [],
          modules: [],
          readOnlyActions: ["market brief"],
          gatedActions: [],
          safetyNote: "Telegram is read-only.",
        },
        text: "Strategist template reply.",
      }),
      generateTelegramAgentBrainReply: async () => {
        agentBrainCalled = true;
        throw new Error("Disabled agent brain must not be called.");
      },
      deliverTelegramReadOnlyResponse: async (input) => {
        deliveries.push(input);
        return { delivered: true };
      },
    },
  );

  const body = await readJson(response);
  const deliveredResponse = deliveries[0]?.response as
    | Record<string, unknown>
    | undefined;

  assertEquals(response.status, 200);
  assertEquals(body.status, "delivered");
  assertEquals(agentBrainCalled, false);
  assertEquals(deliveredResponse?.text, "Strategist template reply.");
});

Deno.test("telegram-webhook agent brain gate enriches template response", async () => {
  const deliveries: Array<Record<string, unknown>> = [];
  const brainInputs: Array<Record<string, unknown>> = [];

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/actions@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      templateContextRuntimeConfig: { enabled: true },
      agentBrainRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      lookupTelegramTemplateContext: async () => ({
        context: {
          templateId: "strategist",
          name: "Strategist",
          role: "Market and campaign intelligence agent",
          summary: "Market planning agent.",
          actions: [],
          modules: [],
          readOnlyActions: ["market brief", "campaign plan"],
          gatedActions: ["custom prompt"],
          safetyNote: "Telegram is read-only.",
        },
        text: "Template fallback should be replaced.",
      }),
      generateTelegramAgentBrainReply: async (input) => {
        brainInputs.push(input as unknown as Record<string, unknown>);
        return { text: "Strategist can summarize read-only campaign options." };
      },
      deliverTelegramReadOnlyResponse: async (input) => {
        deliveries.push(input);
        return { delivered: true };
      },
    },
  );

  const body = await readJson(response);
  const deliveredResponse = deliveries[0]?.response as
    | Record<string, unknown>
    | undefined;

  assertEquals(response.status, 200);
  assertEquals(body.status, "delivered");
  assertEquals(brainInputs.length, 1);
  assertEquals(brainInputs[0]?.command, "actions");
  assertEquals(brainInputs[0]?.agentName, "Strategist");
  assertEquals(
    brainInputs[0]?.agentRole,
    "Market and campaign intelligence agent",
  );
  assertEquals(
    Array.isArray(brainInputs[0]?.capabilities),
    true,
  );
  assertEquals(deliveredResponse?.command, "actions");
  assertEquals(
    deliveredResponse?.text,
    "Strategist can summarize read-only campaign options.",
  );
});

Deno.test("telegram-webhook agent brain gate enriches modules response", async () => {
  const deliveries: Array<Record<string, unknown>> = [];
  const brainInputs: Array<Record<string, unknown>> = [];

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/modules@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      templateContextRuntimeConfig: { enabled: true },
      agentBrainRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      lookupTelegramTemplateContext: async () => ({
        context: {
          templateId: "strategist",
          name: "Strategist",
          role: "Market and campaign intelligence agent",
          summary: "Market planning agent.",
          actions: [],
          modules: [
            {
              name: "NIRA-01",
              title: "Narrative intelligence",
              telegramStatus: "active",
            },
            {
              name: "ASTRA-03",
              title: "Execution guard",
              telegramStatus: "guard",
            },
          ],
          readOnlyActions: ["market brief"],
          gatedActions: [],
          safetyNote: "Telegram is read-only.",
        },
        text: "Template modules fallback should be replaced.",
      }),
      generateTelegramAgentBrainReply: async (input) => {
        brainInputs.push(input as unknown as Record<string, unknown>);
        return { text: "Strategist modules are available in read-only mode." };
      },
      deliverTelegramReadOnlyResponse: async (input) => {
        deliveries.push(input);
        return { delivered: true };
      },
    },
  );

  const body = await readJson(response);
  const deliveredResponse = deliveries[0]?.response as
    | Record<string, unknown>
    | undefined;

  assertEquals(response.status, 200);
  assertEquals(body.status, "delivered");
  assertEquals(brainInputs.length, 1);
  assertEquals(brainInputs[0]?.command, "modules");
  assertEquals(brainInputs[0]?.agentName, "Strategist");
  assertEquals(deliveredResponse?.command, "modules");
  assertEquals(
    deliveredResponse?.text,
    "Strategist modules are available in read-only mode.",
  );
});

Deno.test("telegram-webhook agent brain gate falls back without dependency", async () => {
  const deliveries: Array<Record<string, unknown>> = [];

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/agent@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      templateContextRuntimeConfig: { enabled: true },
      agentBrainRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      lookupTelegramTemplateContext: async () => ({
        context: {
          templateId: "strategist",
          name: "Strategist",
          role: "Market and campaign intelligence agent",
          summary: "Market planning agent.",
          actions: [],
          modules: [],
          readOnlyActions: ["market brief"],
          gatedActions: [],
          safetyNote: "Telegram is read-only.",
        },
        text: "Template fallback remains available.",
      }),
      deliverTelegramReadOnlyResponse: async (input) => {
        deliveries.push(input);
        return { delivered: true };
      },
    },
  );

  const body = await readJson(response);
  const deliveredResponse = deliveries[0]?.response as
    | Record<string, unknown>
    | undefined;

  assertEquals(response.status, 200);
  assertEquals(body.status, "delivered");
  assertEquals(deliveredResponse?.text, "Template fallback remains available.");
});

Deno.test("telegram-webhook agent brain provider failure keeps template fallback", async () => {
  const deliveries: Array<Record<string, unknown>> = [];
  let agentBrainCalled = false;

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/modules@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      templateContextRuntimeConfig: { enabled: true },
      agentBrainRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      lookupTelegramTemplateContext: async () => ({
        context: {
          templateId: "strategist",
          name: "Strategist",
          role: "Market and campaign intelligence agent",
          summary: "Market planning agent.",
          actions: [],
          modules: [],
          readOnlyActions: ["market brief"],
          gatedActions: [],
          safetyNote: "Telegram is read-only.",
        },
        text: "Template modules fallback remains available.",
      }),
      generateTelegramAgentBrainReply: async () => {
        agentBrainCalled = true;
        throw new HttpError(
          502,
          "agent_brain_invalid_response",
          "Kyra agent brain returned an invalid response.",
        );
      },
      deliverTelegramReadOnlyResponse: async (input) => {
        deliveries.push(input);
        return { delivered: true };
      },
    },
  );

  const body = await readJson(response);
  const deliveredResponse = deliveries[0]?.response as
    | Record<string, unknown>
    | undefined;

  assertEquals(response.status, 200);
  assertEquals(body.status, "delivered");
  assertEquals(agentBrainCalled, true);
  assertEquals(deliveredResponse?.command, "modules");
  assertEquals(
    deliveredResponse?.text,
    "Template modules fallback remains available.",
  );
});

Deno.test("telegram-webhook template context gate ignores status command", async () => {
  let templateContextCalled = false;

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/status@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      templateContextRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      lookupTelegramTemplateContext: async () => {
        templateContextCalled = true;
        throw new Error("Status command must not lookup template context.");
      },
      deliverTelegramReadOnlyResponse: async () => ({ delivered: true }),
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 200);
  assertEquals(body.status, "delivered");
  assertEquals(templateContextCalled, false);
});

Deno.test("telegram-webhook duplicate claim skips template context lookup", async () => {
  let templateContextCalled = false;

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/actions@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      templateContextRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({
        claimed: false,
        status: "duplicate",
      }),
      lookupTelegramTemplateContext: async () => {
        templateContextCalled = true;
        throw new Error("Duplicate updates must not lookup template context.");
      },
      deliverTelegramReadOnlyResponse: async () => {
        throw new Error("Duplicate updates must not deliver.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 200);
  assertEquals(body.status, "duplicate");
  assertEquals(templateContextCalled, false);
});

Deno.test("telegram-webhook template context gate requires lookup dependency", async () => {
  let deliveryCalled = false;

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/actions@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      templateContextRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      deliverTelegramReadOnlyResponse: async () => {
        deliveryCalled = true;
        throw new Error("Delivery must not run without template context.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(
    body.message,
    "Telegram template context lookup is not configured.",
  );
  assertEquals(deliveryCalled, false);
});

Deno.test("telegram-webhook duplicate claim skips delivery", async () => {
  let deliveryCalled = false;

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/help@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({
        claimed: false,
        status: "duplicate",
      }),
      deliverTelegramReadOnlyResponse: async () => {
        deliveryCalled = true;
        throw new Error("Duplicate update must not deliver.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.status, "duplicate");
  assert(!deliveryCalled, "Duplicate claim must skip delivery.");
});

Deno.test("telegram-webhook unexpected delivery failure is sanitized", async () => {
  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/help@kyra_test_bot")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      claimRuntimeConfig: { enabled: true },
      deliveryRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => ({
        authorized: true,
        role: "owner",
      }),
      claimTelegramUpdate: async () => ({ claimed: true, status: "claimed" }),
      deliverTelegramReadOnlyResponse: async () => {
        throw new Error("raw delivery token chat -987654 owner-1");
      },
    },
  );

  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 503);
  assertEquals(body.status, "telegram_unavailable");
  assertEquals(body.message, "Telegram is unavailable.");
  assert(!serialized.includes("-987654"), "Chat id must not be echoed.");
  assert(!serialized.includes("owner-1"), "Owner id must not be echoed.");
});

Deno.test("telegram-webhook parse failure prevents chat auth lookup", async () => {
  let authCalled = false;

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/approve private")),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      chatAuthRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
      lookupTelegramChatAuthorization: async () => {
        authCalled = true;
        throw new Error("Chat auth must not run after parse failure.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 422);
  assertEquals(body.status, "unsupported_update");
  assert(!authCalled, "Parse failure must prevent chat auth lookup.");
});

Deno.test("telegram-webhook streaming body reader enforces max bytes", async () => {
  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest("x".repeat(maxTelegramWebhookBodyBytes + 1)),
    {
      lookupRuntimeConfig: { enabled: true },
      parseRuntimeConfig: { enabled: true },
      lookupTelegramWebhookSession: async () => ({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
      }),
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 413);
  assertEquals(body.status, "payload_too_large");
});

Deno.test("telegram-webhook rejects unsupported content type after secret verification", async () => {
  let bodyRead = false;

  const response = await handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "text/plain",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
  );

  const body = await readJson(response);

  assertEquals(response.status, 415);
  assertEquals(body.status, "unsupported_media_type");
  assert(
    !bodyRead,
    "Unsupported webhook content type must not read request body.",
  );
});

Deno.test("telegram-webhook runtime dependencies keep lookup disabled without service setup", () => {
  const keys: string[] = [];
  const dependencies = createTelegramWebhookDependencies({
    getOptionalEnv: (key) => {
      keys.push(key);
      return "";
    },
  });

  assertEquals(dependencies.lookupRuntimeConfig?.enabled, false);
  assertEquals(dependencies.parseRuntimeConfig?.enabled, false);
  assertEquals(dependencies.chatAuthRuntimeConfig?.enabled, false);
  assertEquals(dependencies.claimRuntimeConfig?.enabled, false);
  assertEquals(dependencies.deliveryRuntimeConfig?.enabled, false);
  assertEquals(dependencies.ownerLinkConsumeRuntimeConfig?.enabled, false);
  assertEquals(dependencies.templateContextRuntimeConfig?.enabled, false);
  assertEquals(dependencies.agentBrainRuntimeConfig?.enabled, false);
  assertEquals(dependencies.agentBrainProviderRuntimeConfig?.enabled, false);
  assertEquals(dependencies.lookupTelegramWebhookSession, undefined);
  assertEquals(dependencies.claimTelegramUpdate, undefined);
  assertEquals(dependencies.deliverTelegramReadOnlyResponse, undefined);
  assertEquals(dependencies.consumeTelegramOwnerLinkChallenge, undefined);
  assertEquals(dependencies.lookupTelegramTemplateContext, undefined);
  assertEquals(dependencies.generateTelegramAgentBrainReply, undefined);
  assertEquals(
    keys.join(","),
    `${telegramWebhookLookupEnabledEnvKey},${telegramWebhookParseEnabledEnvKey},${telegramWebhookChatAuthEnabledEnvKey},${telegramWebhookClaimEnabledEnvKey},${telegramWebhookDeliveryEnabledEnvKey},${telegramWebhookOwnerLinkConsumeEnabledEnvKey},${telegramWebhookTemplateContextEnabledEnvKey},${telegramWebhookAgentBrainEnabledEnvKey},${telegramWebhookAgentBrainProviderEnabledEnvKey}`,
  );
});

Deno.test("telegram-webhook runtime dependencies enable lookup lazily", () => {
  const keys: string[] = [];
  const dependencies = createTelegramWebhookDependencies({
    getOptionalEnv: (key) => {
      keys.push(key);
      return "true";
    },
  });

  assertEquals(dependencies.lookupRuntimeConfig?.enabled, true);
  assertEquals(dependencies.parseRuntimeConfig?.enabled, true);
  assertEquals(dependencies.chatAuthRuntimeConfig?.enabled, true);
  assertEquals(dependencies.claimRuntimeConfig?.enabled, true);
  assertEquals(dependencies.deliveryRuntimeConfig?.enabled, true);
  assertEquals(dependencies.ownerLinkConsumeRuntimeConfig?.enabled, true);
  assertEquals(dependencies.templateContextRuntimeConfig?.enabled, true);
  assertEquals(dependencies.agentBrainRuntimeConfig?.enabled, true);
  assertEquals(dependencies.agentBrainProviderRuntimeConfig?.enabled, true);
  assertEquals(typeof dependencies.lookupTelegramWebhookSession, "function");
  assertEquals(typeof dependencies.lookupTelegramChatAuthorization, "function");
  assertEquals(typeof dependencies.claimTelegramUpdate, "function");
  assertEquals(typeof dependencies.deliverTelegramReadOnlyResponse, "function");
  assertEquals(
    typeof dependencies.consumeTelegramOwnerLinkChallenge,
    "function",
  );
  assertEquals(typeof dependencies.lookupTelegramTemplateContext, "function");
  assertEquals(typeof dependencies.generateTelegramAgentBrainReply, "function");
  assertEquals(
    keys.join(","),
    `${telegramWebhookLookupEnabledEnvKey},${telegramWebhookParseEnabledEnvKey},${telegramWebhookChatAuthEnabledEnvKey},${telegramWebhookClaimEnabledEnvKey},${telegramWebhookDeliveryEnabledEnvKey},${telegramWebhookOwnerLinkConsumeEnabledEnvKey},${telegramWebhookTemplateContextEnabledEnvKey},${telegramWebhookAgentBrainEnabledEnvKey},${telegramWebhookAgentBrainProviderEnabledEnvKey}`,
  );
});

Deno.test("telegram-webhook runtime agent brain provider stays absent without provider gate", () => {
  let requiredEnvRead = false;
  const dependencies = createTelegramWebhookDependencies({
    getEnv: () => {
      requiredEnvRead = true;
      throw new Error("Provider-disabled runtime must not read required env.");
    },
    getOptionalEnv: (key) =>
      key === telegramWebhookLookupEnabledEnvKey ||
        key === telegramWebhookAgentBrainEnabledEnvKey
        ? "true"
        : "",
  });

  assertEquals(dependencies.lookupRuntimeConfig?.enabled, true);
  assertEquals(dependencies.agentBrainRuntimeConfig?.enabled, true);
  assertEquals(dependencies.agentBrainProviderRuntimeConfig?.enabled, false);
  assertEquals(dependencies.generateTelegramAgentBrainReply, undefined);
  assert(
    !requiredEnvRead,
    "Provider-disabled runtime must not read provider env.",
  );
});

Deno.test("telegram-webhook runtime agent brain provider reads env lazily and uses fake fetch", async () => {
  const requiredKeys: string[] = [];
  const optionalKeys: string[] = [];
  let providerFetchCalled = false;
  const dependencies = createTelegramWebhookDependencies({
    getEnv: (key) => {
      requiredKeys.push(key);

      if (key === "SUPABASE_URL") {
        return "https://project.supabase.co";
      }

      if (key === "SUPABASE_SERVICE_ROLE_KEY") {
        return "test-service-role-key";
      }

      if (key === "KYRA_TELEGRAM_AGENT_BRAIN_API_KEY") {
        return "test-provider-key";
      }

      if (key === "KYRA_TELEGRAM_AGENT_BRAIN_MODEL") {
        return "gpt-test-safe";
      }

      throw new Error(`Unexpected required env ${key}`);
    },
    getOptionalEnv: (key) => {
      optionalKeys.push(key);
      return key === telegramWebhookLookupEnabledEnvKey ||
          key === telegramWebhookAgentBrainEnabledEnvKey ||
          key === telegramWebhookAgentBrainProviderEnabledEnvKey
        ? "true"
        : "";
    },
    fetchAgentBrain: async (_input, init) => {
      providerFetchCalled = true;
      const body = String(init?.body ?? "");

      assert(
        !body.includes("test-provider-key"),
        "Provider request body must not include API key.",
      );

      return new Response(
        JSON.stringify({
          output_text: "Kyra can answer read-only template questions.",
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  assertEquals(typeof dependencies.generateTelegramAgentBrainReply, "function");
  assertEquals(requiredKeys.join(","), "");

  const reply = await dependencies.generateTelegramAgentBrainReply?.({
    command: "agent",
    agentName: "Kyra",
    agentRole: "Telegram read-only agent",
    capabilities: ["status", "agent", "actions"],
  });

  assertEquals(
    requiredKeys.join(","),
    "KYRA_TELEGRAM_AGENT_BRAIN_API_KEY,KYRA_TELEGRAM_AGENT_BRAIN_MODEL",
  );
  assert(
    optionalKeys.includes("KYRA_TELEGRAM_AGENT_BRAIN_ENDPOINT"),
    "Provider endpoint env should be optional and lazy.",
  );
  assertEquals(providerFetchCalled, true);
  assertEquals(
    reply?.text,
    "Kyra can answer read-only template questions.",
  );
});

Deno.test("telegram-webhook runtime owner-link dependency stays absent without lookup", () => {
  let requiredEnvRead = false;
  const dependencies = createTelegramWebhookDependencies({
    getEnv: () => {
      requiredEnvRead = true;
      throw new Error("Lookup-disabled runtime must not read required env.");
    },
    getOptionalEnv: (key) =>
      key === telegramWebhookOwnerLinkConsumeEnabledEnvKey ? "true" : "",
  });

  assertEquals(dependencies.lookupRuntimeConfig?.enabled, false);
  assertEquals(dependencies.ownerLinkConsumeRuntimeConfig?.enabled, true);
  assertEquals(dependencies.lookupTelegramWebhookSession, undefined);
  assertEquals(dependencies.consumeTelegramOwnerLinkChallenge, undefined);
  assert(
    !requiredEnvRead,
    "Lookup-disabled runtime must not read required env.",
  );
});

Deno.test("telegram-webhook runtime owner-link consume resolves session then consumes through injected RPC", async () => {
  const challenge = "ab".repeat(32);
  const rpcCalls: Array<{ url: string; body: Record<string, unknown> }> = [];
  const dependencies = createTelegramWebhookDependencies({
    getEnv: (key) => {
      if (key === "SUPABASE_URL") {
        return "https://project.supabase.co";
      }

      if (key === "SUPABASE_SERVICE_ROLE_KEY") {
        return "test-service-role-key";
      }

      throw new Error(`Unexpected required env ${key}`);
    },
    getOptionalEnv: (key) =>
      key === telegramWebhookLookupEnabledEnvKey ||
        key === telegramWebhookOwnerLinkConsumeEnabledEnvKey
        ? "true"
        : "",
    fetchRpc: async (input, init) => {
      const url = String(input);
      const body = JSON.parse(
        String((init as { body?: unknown } | undefined)?.body ?? "{}"),
      ) as Record<string, unknown>;
      rpcCalls.push({ url, body });

      if (url.endsWith("/resolve_telegram_webhook_session")) {
        return new Response(
          JSON.stringify([{
            ...activeLookupRow,
            session_id: testTelegramSessionId,
          }]),
          { status: 200 },
        );
      }

      if (url.endsWith("/consume_telegram_owner_link_challenge")) {
        return new Response(
          JSON.stringify([{ linked: true, status: "linked" }]),
          { status: 200 },
        );
      }

      throw new Error(`Unexpected RPC ${url}`);
    },
  });
  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(
      createOwnerLinkWebhookUpdate(`/start ${challenge}`),
    ),
    dependencies,
  );
  const body = await readJson(response);
  const serializedCalls = JSON.stringify(rpcCalls);

  assertEquals(response.status, 200);
  assertEquals(body.status, "received");
  assertEquals(rpcCalls.length, 2);
  assert(
    rpcCalls[0]?.url.endsWith("/resolve_telegram_webhook_session") ?? false,
    "Session lookup RPC must run first.",
  );
  assert(
    rpcCalls[1]?.url.endsWith("/consume_telegram_owner_link_challenge") ??
      false,
    "Owner-link consume RPC must run second.",
  );
  assertEquals(
    rpcCalls[1]?.body.p_telegram_session_id,
    testTelegramSessionId,
  );
  assertEquals(rpcCalls[1]?.body.p_telegram_update_id, 9001);
  assertEquals(rpcCalls[1]?.body.p_telegram_user_id, "123456");
  assertEquals(rpcCalls[1]?.body.p_telegram_chat_id, "123456");
  assert(
    typeof rpcCalls[1]?.body.p_challenge_hash === "string" &&
      rpcCalls[1]?.body.p_challenge_hash !== challenge,
    "Consume RPC must receive only the challenge hash.",
  );
  assert(
    !serializedCalls.includes(challenge),
    "RPC calls must hide challenge.",
  );
});

Deno.test("telegram-webhook runtime delivery dependency resolves token lazily", async () => {
  const rpcCalls: string[] = [];
  const telegramCalls: string[] = [];
  const dependencies = createTelegramWebhookDependencies({
    getEnv: (key) => {
      if (key === "SUPABASE_URL") {
        return "https://project.supabase.co";
      }

      if (key === "SUPABASE_SERVICE_ROLE_KEY") {
        return "test-service-role-key";
      }

      throw new Error(`Unexpected required env ${key}`);
    },
    getOptionalEnv: () => "true",
    fetchRpc: async (input, init) => {
      const url = String(input);
      rpcCalls.push(url);

      if (url.endsWith("/resolve_telegram_webhook_session")) {
        return new Response(
          JSON.stringify([{
            ...activeLookupRow,
            session_id: testTelegramSessionId,
          }]),
          { status: 200 },
        );
      }

      if (url.endsWith("/resolve_telegram_chat_authorization")) {
        return new Response(
          JSON.stringify([{ authorized: true, role: "owner" }]),
          { status: 200 },
        );
      }

      if (url.endsWith("/claim_telegram_update")) {
        return new Response(
          JSON.stringify([{ claimed: true, status: "claimed" }]),
          { status: 200 },
        );
      }

      if (url.endsWith("/resolve_telegram_delivery_token")) {
        const requestInit = init as { body?: unknown } | undefined;
        const payload = JSON.parse(
          String(requestInit?.body ?? "{}"),
        ) as Record<string, unknown>;

        assertEquals(payload.p_telegram_session_id, testTelegramSessionId);

        return new Response(JSON.stringify(testBotToken), { status: 200 });
      }

      throw new Error(`Unexpected RPC ${url}`);
    },
    fetchTelegram: async (input) => {
      telegramCalls.push(String(input));

      return new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
      });
    },
  });

  assertEquals(rpcCalls.length, 0);
  assertEquals(telegramCalls.length, 0);

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/status@kyra_test_bot")),
    dependencies,
  );
  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 200);
  assertEquals(body.status, "delivered");
  assertEquals(rpcCalls.length, 4);
  assert(
    rpcCalls[0].endsWith("/resolve_telegram_webhook_session"),
    "Lookup RPC must run first.",
  );
  assert(
    rpcCalls[1].endsWith("/resolve_telegram_chat_authorization"),
    "Chat authorization RPC must run second.",
  );
  assert(
    rpcCalls[2].endsWith("/claim_telegram_update"),
    "Claim RPC must run third.",
  );
  assert(
    rpcCalls[3].endsWith("/resolve_telegram_delivery_token"),
    "Token resolver RPC must run after claim.",
  );
  assertEquals(telegramCalls.length, 1);
  assert(
    telegramCalls[0].includes("/sendMessage"),
    "Delivery must call sendMessage through injected fetch.",
  );
  assert(!serializedBody.includes(testBotToken), "Response must hide token.");
});

Deno.test("telegram-webhook runtime template context lookup uses REST before delivery token", async () => {
  const calls: Array<{ url: string; method: string }> = [];
  const templateAgentId = "9220060d-2760-496c-9774-18384211496c";
  const dependencies = createTelegramWebhookDependencies({
    getEnv: (key) => {
      if (key === "SUPABASE_URL") {
        return "https://project.supabase.co";
      }

      if (key === "SUPABASE_SERVICE_ROLE_KEY") {
        return "test-service-role-key";
      }

      throw new Error(`Unexpected required env ${key}`);
    },
    getOptionalEnv: (key) =>
      key === telegramWebhookLookupEnabledEnvKey ||
        key === telegramWebhookParseEnabledEnvKey ||
        key === telegramWebhookChatAuthEnabledEnvKey ||
        key === telegramWebhookClaimEnabledEnvKey ||
        key === telegramWebhookDeliveryEnabledEnvKey ||
        key === telegramWebhookTemplateContextEnabledEnvKey
        ? "true"
        : "",
    fetchRpc: async (input, init) => {
      const url = String(input);
      const method = String((init as { method?: unknown } | undefined)?.method);
      calls.push({ url, method });

      if (url.endsWith("/resolve_telegram_webhook_session")) {
        return new Response(
          JSON.stringify([{
            ...activeLookupRow,
            session_id: testTelegramSessionId,
            agent_id: templateAgentId,
          }]),
          { status: 200 },
        );
      }

      if (url.endsWith("/resolve_telegram_chat_authorization")) {
        return new Response(
          JSON.stringify([{ authorized: true, role: "owner" }]),
          { status: 200 },
        );
      }

      if (url.endsWith("/claim_telegram_update")) {
        return new Response(
          JSON.stringify([{ claimed: true, status: "claimed" }]),
          { status: 200 },
        );
      }

      if (url.includes("/rest/v1/agent_instances")) {
        assert(
          url.includes("select=id%2Ctemplate_id%2Cdisplay_name"),
          "Agent lookup must request only template context columns.",
        );
        assert(
          url.includes(`id=eq.${templateAgentId}`),
          "Agent lookup must be scoped to the resolved session agent id.",
        );
        return new Response(
          JSON.stringify([{
            id: templateAgentId,
            template_id: "strategist",
            display_name: "Strategist",
          }]),
          { status: 200 },
        );
      }

      if (url.includes("/rest/v1/agent_templates")) {
        assert(
          url.includes("select=id%2Cname%2Crole%2Csummary%2Cactions%2Cmodules"),
          "Template lookup must request only context columns.",
        );
        assert(
          url.includes("id=eq.strategist"),
          "Template lookup must be scoped to the agent template id.",
        );
        return new Response(
          JSON.stringify([{
            id: "strategist",
            name: "Strategist",
            role: "Market and campaign intelligence agent",
            summary: "A planning agent for launch narratives.",
            actions: ["market brief", "campaign plan"],
            modules: ["ASTRA-03", "VEXA-02"],
          }]),
          { status: 200 },
        );
      }

      if (url.endsWith("/resolve_telegram_delivery_token")) {
        return new Response(JSON.stringify(testBotToken), { status: 200 });
      }

      throw new Error(`Unexpected RPC ${url}`);
    },
    fetchTelegram: async () =>
      new Response(JSON.stringify({ ok: true, result: {} }), {
        status: 200,
      }),
  });

  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/actions@kyra_test_bot")),
    dependencies,
  );
  const body = await readJson(response);

  assertEquals(response.status, 200);
  assertEquals(body.status, "delivered");
  assertEquals(calls.length, 6);
  assert(
    calls[0].url.endsWith("/resolve_telegram_webhook_session"),
    "Session lookup must run first.",
  );
  assert(
    calls[1].url.endsWith("/resolve_telegram_chat_authorization"),
    "Chat authorization must run after session lookup.",
  );
  assert(
    calls[2].url.endsWith("/claim_telegram_update"),
    "Claim must run before template context lookup.",
  );
  assert(
    calls[3].url.includes("/rest/v1/agent_instances"),
    "Agent instance REST lookup must run before template lookup.",
  );
  assert(
    calls[4].url.includes("/rest/v1/agent_templates"),
    "Template REST lookup must run before delivery token resolution.",
  );
  assert(
    calls[5].url.endsWith("/resolve_telegram_delivery_token"),
    "Delivery token must be resolved after template context lookup.",
  );
  assertEquals(calls[3].method, "GET");
  assertEquals(calls[4].method, "GET");
});

Deno.test("telegram-webhook runtime delivery token failure is sanitized", async () => {
  const telegramCalls: string[] = [];
  const response = await handleTelegramWebhookRequest(
    createJsonWebhookRequest(createWebhookUpdate("/help@kyra_test_bot")),
    createTelegramWebhookDependencies({
      getEnv: (key) => {
        if (key === "SUPABASE_URL") {
          return "https://project.supabase.co";
        }

        if (key === "SUPABASE_SERVICE_ROLE_KEY") {
          return "test-service-role-key";
        }

        throw new Error(`Unexpected required env ${key}`);
      },
      getOptionalEnv: () => "true",
      fetchRpc: async (input) => {
        const url = String(input);

        if (url.endsWith("/resolve_telegram_webhook_session")) {
          return new Response(
            JSON.stringify([{
              ...activeLookupRow,
              session_id: testTelegramSessionId,
            }]),
            { status: 200 },
          );
        }

        if (url.endsWith("/resolve_telegram_chat_authorization")) {
          return new Response(
            JSON.stringify([{ authorized: true, role: "owner" }]),
            { status: 200 },
          );
        }

        if (url.endsWith("/claim_telegram_update")) {
          return new Response(
            JSON.stringify([{ claimed: true, status: "claimed" }]),
            { status: 200 },
          );
        }

        if (url.endsWith("/resolve_telegram_delivery_token")) {
          return new Response(
            JSON.stringify({
              message: `${testBotToken} token_secret_ref owner_user_id`,
            }),
            { status: 500 },
          );
        }

        throw new Error(`Unexpected RPC ${url}`);
      },
      fetchTelegram: async (input) => {
        telegramCalls.push(String(input));
        throw new Error("Telegram must not be called after token failure.");
      },
    }),
  );
  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 503);
  assertEquals(body.status, "telegram_unavailable");
  assertEquals(body.message, "Telegram delivery token is unavailable.");
  assertEquals(telegramCalls.length, 0);
  assert(!serialized.includes(testBotToken), "Response must hide token.");
  assert(!serialized.includes("token_secret_ref"), "Response must hide refs.");
  assert(
    !serialized.includes("owner_user_id"),
    "Response must hide owner data.",
  );
});

Deno.test("telegram-webhook body size header validator rejects oversized requests", () => {
  let error: unknown;

  try {
    assertBodySizeFromHeaders(
      new Headers({
        "content-length": String(maxTelegramWebhookBodyBytes + 1),
      }),
      maxTelegramWebhookBodyBytes,
    );
  } catch (caughtError) {
    error = caughtError;
  }

  assert(
    error instanceof HttpError,
    "Oversized Content-Length must throw HttpError.",
  );
  assertEquals((error as HttpError).statusCode, 413);
  assertEquals((error as HttpError).code, "payload_too_large");
});

Deno.test("telegram-webhook JSON body reader rejects invalid object payloads", async () => {
  const error = await captureError(async () => {
    await readTelegramWebhookUpdateBody(
      createJsonWebhookRequest(["not", "an", "object"]),
    );
  });

  assert(error instanceof HttpError, "Expected invalid body HttpError.");
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
});

Deno.test("telegram-webhook secret hash validator accepts lowercase sha256 hex only", () => {
  assertEquals(
    assertTelegramWebhookSecretHash(testWebhookSecretHash),
    testWebhookSecretHash,
  );

  assertThrowsHttpError(
    () => assertTelegramWebhookSecretHash("test-webhook-secret"),
    400,
    "invalid_request",
  );

  assertThrowsHttpError(
    () =>
      assertTelegramWebhookSecretHash(
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
      ),
    400,
    "invalid_request",
  );
});

Deno.test("telegram-webhook sanitizer redacts secret-like server errors", () => {
  const sanitized = sanitizeErrorMessage(
    "raw sb_secret_testvalue and jwt eyJabc.def.ghi leaked",
  );

  assert(
    sanitized.includes("sb_secret_[hidden]"),
    "Secret-like value must be redacted.",
  );
  assert(
    sanitized.includes("jwt_[hidden]"),
    "JWT-like value must be redacted.",
  );
  assert(
    !sanitized.includes("sb_secret_testvalue"),
    "Raw secret marker must not be returned.",
  );
  assert(
    !sanitized.includes("eyJabc.def.ghi"),
    "Raw JWT marker must not be returned.",
  );
});

Deno.test("telegram-webhook session contract returns active session only", () => {
  const session = {
    sessionId: "telegram-session-1",
    agentId: "agent-1",
    workspaceId: "workspace-1",
    ownerUserId: "owner-1",
    botHandle: "@kyra_test_bot",
    webhookStatus: "active",
  };

  assertEquals(assertActiveTelegramWebhookSession(session), session);
});

Deno.test("telegram-webhook session lookup result maps one active row", () => {
  const session = assertTelegramWebhookSessionLookupResult({
    data: [activeLookupRow],
  });

  assertEquals(session.sessionId, "telegram-session-1");
  assertEquals(session.agentId, "agent-1");
  assertEquals(session.workspaceId, "workspace-1");
  assertEquals(session.ownerUserId, "owner-1");
  assertEquals(session.botHandle, "@kyra_test_bot");
  assertEquals(session.webhookStatus, "active");
});

Deno.test("telegram-webhook session lookup result hides missing rows as not found", () => {
  assertThrowsHttpError(
    () => assertTelegramWebhookSessionLookupRows([]),
    404,
    "session_not_found",
  );

  assertThrowsHttpError(
    () => assertTelegramWebhookSessionLookupResult({ data: null }),
    404,
    "session_not_found",
  );
});

Deno.test("telegram-webhook session lookup result rejects inactive row as not found", () => {
  const error = assertThrowsHttpError(
    () =>
      assertTelegramWebhookSessionLookupResult({
        data: [{ ...activeLookupRow, webhook_status: "paused" }],
      }),
    404,
    "session_not_found",
  );

  assertEquals(error.message, "Telegram webhook session was not found.");
});

Deno.test("telegram-webhook session lookup result sanitizes duplicate rows", () => {
  const error = assertThrowsHttpError(
    () =>
      assertTelegramWebhookSessionLookupResult({
        data: [activeLookupRow, activeLookupRow],
      }),
    500,
    "server_error",
  );

  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
  });

  assertEquals(error.message, "Telegram webhook session lookup failed.");
  assert(
    !serialized.includes("owner-1"),
    "Duplicate lookup errors must not expose owner id.",
  );
  assert(
    !serialized.includes("workspace-1"),
    "Duplicate lookup errors must not expose workspace id.",
  );
});

Deno.test("telegram-webhook session lookup result sanitizes non-array data", () => {
  const error = assertThrowsHttpError(
    () =>
      assertTelegramWebhookSessionLookupResult({
        data: {
          owner_user_id: "owner-1",
          workspace_id: "workspace-1",
        },
      }),
    500,
    "server_error",
  );

  assertEquals(error.message, "Telegram webhook session lookup failed.");
});

Deno.test("telegram-webhook session lookup result sanitizes rpc errors", () => {
  const error = assertThrowsHttpError(
    () =>
      assertTelegramWebhookSessionLookupResult({
        data: null,
        error: {
          message:
            "raw rpc owner_user_id workspace-1 token_secret_ref webhook_secret_hash",
        },
      }),
    500,
    "server_error",
  );

  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
  });

  assertEquals(error.message, "Telegram webhook session lookup failed.");
  assert(
    !serialized.includes("owner_user_id"),
    "RPC errors must not expose owner column names.",
  );
  assert(
    !serialized.includes("token_secret_ref"),
    "RPC errors must not expose token refs.",
  );
  assert(
    !serialized.includes("webhook_secret_hash"),
    "RPC errors must not expose webhook hashes.",
  );
});

Deno.test("telegram-webhook session lookup result sanitizes invalid row shape", () => {
  const error = assertThrowsHttpError(
    () =>
      assertTelegramWebhookSessionLookupResult({
        data: [
          {
            ...activeLookupRow,
            workspace_id: "",
            owner_user_id: testWebhookSecretHash,
          },
        ],
      }),
    500,
    "server_error",
  );

  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
  });

  assertEquals(error.message, "Telegram webhook session lookup failed.");
  assert(
    !serialized.includes(testWebhookSecretHash),
    "Invalid row errors must not expose webhook secret hashes.",
  );
});

Deno.test("telegram-webhook session contract hides missing or inactive sessions", () => {
  const missingError = assertThrowsHttpError(
    () => assertActiveTelegramWebhookSession(null),
    404,
    "session_not_found",
  );

  const inactiveError = assertThrowsHttpError(
    () =>
      assertActiveTelegramWebhookSession({
        sessionId: "telegram-session-1",
        agentId: "agent-1",
        workspaceId: "workspace-1",
        ownerUserId: "owner-1",
        webhookStatus: "queued",
      }),
    404,
    "session_not_found",
  );

  assertEquals(missingError.message, "Telegram webhook session was not found.");
  assertEquals(
    inactiveError.message,
    "Telegram webhook session was not found.",
  );
});

Deno.test("telegram-webhook session lookup sanitizer hides raw lookup details", () => {
  const error = sanitizeTelegramWebhookSessionLookupError(
    new Error("raw DB owner_user_id workspace-1 token_secret_ref"),
  );
  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
  });

  assertEquals(error.statusCode, 500);
  assertEquals(error.code, "server_error");
  assertEquals(error.message, "Telegram webhook session lookup failed.");
  assert(
    !serialized.includes("owner_user_id"),
    "Error must not expose owner id.",
  );
  assert(
    !serialized.includes("workspace-1"),
    "Error must not expose workspace id.",
  );
  assert(
    !serialized.includes("token_secret_ref"),
    "Error must not expose token refs.",
  );
});

Deno.test("telegram-webhook personal chat policy authorizes owner-linked identity", () => {
  const authorization = assertTelegramWebhookChatAuthorized(
    { telegramUserId: 12345, telegramChatId: 67890 },
    {
      mode: "personal",
      ownerTelegramUserId: "12345",
      ownerTelegramChatId: "67890",
    },
    "approval",
  );

  assertEquals(authorization.authorized, true);
  assertEquals(authorization.role, "owner");
});

Deno.test("telegram-webhook personal chat policy denies unknown chats safely", () => {
  const error = assertThrowsHttpError(
    () =>
      assertTelegramWebhookChatAuthorized(
        { telegramUserId: "11111", telegramChatId: "22222" },
        {
          mode: "personal",
          ownerTelegramUserId: "12345",
          ownerTelegramChatId: "67890",
        },
      ),
    403,
    "chat_not_authorized",
  );

  assert(
    !error.message.includes("11111"),
    "Error must not echo Telegram user id.",
  );
  assert(
    !error.message.includes("22222"),
    "Error must not echo Telegram chat id.",
  );
});

Deno.test("telegram-webhook community policy separates read-only and write access", () => {
  const memberAuthorization = assertTelegramWebhookChatAuthorized(
    { telegramUserId: "member-1" },
    {
      mode: "community",
      allowedTelegramUserIds: ["member-1"],
      adminTelegramUserIds: ["admin-1"],
    },
    "read_only",
  );

  assertEquals(memberAuthorization.role, "member");

  assertThrowsHttpError(
    () =>
      assertTelegramWebhookChatAuthorized(
        { telegramUserId: "member-1" },
        {
          mode: "community",
          allowedTelegramUserIds: ["member-1"],
          adminTelegramUserIds: ["admin-1"],
        },
        "write",
      ),
    403,
    "chat_not_authorized",
  );

  const adminAuthorization = assertTelegramWebhookChatAuthorized(
    { telegramUserId: "admin-1" },
    {
      mode: "community",
      allowedTelegramUserIds: ["member-1"],
      adminTelegramUserIds: ["admin-1"],
    },
    "write",
  );

  assertEquals(adminAuthorization.role, "admin");
});

Deno.test("telegram-webhook community public access is read-only only", () => {
  const publicAuthorization = assertTelegramWebhookChatAuthorized(
    { telegramChatId: "public-chat" },
    {
      mode: "community",
      allowPublicReadOnly: true,
    },
    "read_only",
  );

  assertEquals(publicAuthorization.role, "public_read_only");

  assertThrowsHttpError(
    () =>
      assertTelegramWebhookChatAuthorized(
        { telegramChatId: "public-chat" },
        {
          mode: "community",
          allowPublicReadOnly: true,
        },
        "approval",
      ),
    403,
    "chat_not_authorized",
  );
});

Deno.test("telegram-webhook chat authorization rejects missing identity as invalid update", () => {
  assertThrowsHttpError(
    () =>
      assertTelegramWebhookChatAuthorized(
        {},
        {
          mode: "personal",
          ownerTelegramUserId: "12345",
        },
      ),
    400,
    "invalid_update",
  );
});
