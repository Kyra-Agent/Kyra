import {
  assertActiveTelegramWebhookSession,
  assertBodySizeFromHeaders,
  assertTelegramWebhookChatAuthorized,
  handleTelegramWebhookRequest,
  HttpError,
  maxTelegramWebhookBodyBytes,
  sanitizeErrorMessage,
  sanitizeTelegramWebhookSessionLookupError,
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

Deno.test("telegram-webhook rejects missing Telegram secret before body read", async () => {
  let bodyRead = false;

  const response = handleTelegramWebhookRequest(
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

  const response = handleTelegramWebhookRequest(
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

Deno.test("telegram-webhook rejects unsupported content type after secret verification", async () => {
  let bodyRead = false;

  const response = handleTelegramWebhookRequest(
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
