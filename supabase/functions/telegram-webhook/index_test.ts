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
  telegramWebhookLookupEnabledEnvKey,
  telegramWebhookParseEnabledEnvKey,
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
  assertEquals(dependencies.lookupTelegramWebhookSession, undefined);
  assertEquals(dependencies.claimTelegramUpdate, undefined);
  assertEquals(dependencies.deliverTelegramReadOnlyResponse, undefined);
  assertEquals(
    keys.join(","),
    `${telegramWebhookLookupEnabledEnvKey},${telegramWebhookParseEnabledEnvKey},${telegramWebhookChatAuthEnabledEnvKey},${telegramWebhookClaimEnabledEnvKey},${telegramWebhookDeliveryEnabledEnvKey}`,
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
  assertEquals(typeof dependencies.lookupTelegramWebhookSession, "function");
  assertEquals(typeof dependencies.lookupTelegramChatAuthorization, "function");
  assertEquals(typeof dependencies.claimTelegramUpdate, "function");
  assertEquals(dependencies.deliverTelegramReadOnlyResponse, undefined);
  assertEquals(
    keys.join(","),
    `${telegramWebhookLookupEnabledEnvKey},${telegramWebhookParseEnabledEnvKey},${telegramWebhookChatAuthEnabledEnvKey},${telegramWebhookClaimEnabledEnvKey},${telegramWebhookDeliveryEnabledEnvKey}`,
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
