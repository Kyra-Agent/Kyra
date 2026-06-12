import { HttpError } from "./core.ts";
import { parseTelegramWebhookUpdate } from "./update-parser.ts";

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

function createUpdate(text: unknown = "/status") {
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

Deno.test("telegram update parser accepts supported read-only commands", () => {
  const status = parseTelegramWebhookUpdate(createUpdate("/status"));
  const help = parseTelegramWebhookUpdate(createUpdate("/help"));
  const agent = parseTelegramWebhookUpdate(createUpdate("/agent"));
  const actions = parseTelegramWebhookUpdate(createUpdate("/actions"));
  const modules = parseTelegramWebhookUpdate(createUpdate("/modules"));

  assertEquals(status.updateId, "9001");
  assertEquals(status.messageId, "42");
  assertEquals(status.telegramUserId, "123456");
  assertEquals(status.telegramChatId, "-987654");
  assertEquals(status.command, "status");
  assertEquals(status.commandKind, "read_only");
  assertEquals(help.command, "help");
  assertEquals(help.commandKind, "read_only");
  assertEquals(agent.command, "agent");
  assertEquals(agent.commandKind, "read_only");
  assertEquals(actions.command, "actions");
  assertEquals(actions.commandKind, "read_only");
  assertEquals(modules.command, "modules");
  assertEquals(modules.commandKind, "read_only");
});

Deno.test("telegram update parser discards group command bot username", () => {
  const parsed = parseTelegramWebhookUpdate(
    createUpdate("/help@kyra_demo_bot"),
    { expectedBotUsername: "@Kyra_Demo_Bot" },
  );
  const serialized = JSON.stringify(parsed);

  assertEquals(parsed.command, "help");
  assert(
    !serialized.includes("kyra_demo_bot"),
    "Parsed command must not return bot username.",
  );
});

Deno.test("telegram update parser rejects missing or mismatched group command bot username", () => {
  assertThrowsHttpError(
    () => parseTelegramWebhookUpdate(createUpdate("/status@other_demo_bot")),
    422,
    "unsupported_update",
  );
  assertThrowsHttpError(
    () =>
      parseTelegramWebhookUpdate(
        createUpdate("/status@other_demo_bot"),
        { expectedBotUsername: "kyra_demo_bot" },
      ),
    422,
    "unsupported_update",
  );
});

Deno.test("telegram update parser rejects unknown commands and arguments", () => {
  assertThrowsHttpError(
    () => parseTelegramWebhookUpdate(createUpdate("/approve")),
    422,
    "unsupported_update",
  );
  assertThrowsHttpError(
    () => parseTelegramWebhookUpdate(createUpdate("/status private details")),
    422,
    "unsupported_update",
  );
  assertThrowsHttpError(
    () => parseTelegramWebhookUpdate(createUpdate("/status ")),
    422,
    "unsupported_update",
  );
});

Deno.test("telegram update parser rejects non-command text", () => {
  assertThrowsHttpError(
    () => parseTelegramWebhookUpdate(createUpdate("show private status")),
    422,
    "unsupported_update",
  );
});

Deno.test("telegram update parser rejects unsupported update kinds", () => {
  const unsupportedUpdates = [
    { update_id: 1, edited_message: createUpdate().message },
    { update_id: 2, callback_query: { id: "callback-secret" } },
    { update_id: 3, channel_post: createUpdate().message },
  ];

  for (const update of unsupportedUpdates) {
    assertThrowsHttpError(
      () => parseTelegramWebhookUpdate(update),
      422,
      "unsupported_update",
    );
  }
});

Deno.test("telegram update parser rejects missing or unsafe integer ids", () => {
  const invalidUpdates = [
    {},
    { ...createUpdate(), update_id: Number.MAX_SAFE_INTEGER + 1 },
    {
      ...createUpdate(),
      message: { ...createUpdate().message, message_id: 0 },
    },
    {
      ...createUpdate(),
      message: {
        ...createUpdate().message,
        from: { id: "123456" },
      },
    },
    {
      ...createUpdate(),
      message: {
        ...createUpdate().message,
        chat: { id: 0 },
      },
    },
  ];

  for (const update of invalidUpdates) {
    assertThrowsHttpError(
      () => parseTelegramWebhookUpdate(update),
      400,
      "invalid_update",
    );
  }
});

Deno.test("telegram update parser errors do not expose raw update values", () => {
  const rawMessage = "/approve private-wallet-instruction";
  const rawUserId = 112233;
  const rawChatId = -445566;
  const rawUsername = "private_bot_username";
  const update = {
    update_id: 7,
    message: {
      message_id: 8,
      from: { id: rawUserId },
      chat: { id: rawChatId },
      text: `${rawMessage}@${rawUsername}`,
    },
  };

  const error = assertThrowsHttpError(
    () => parseTelegramWebhookUpdate(update),
    422,
    "unsupported_update",
  );
  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
  });

  assert(
    !serialized.includes(rawMessage),
    "Error must not expose message text.",
  );
  assert(
    !serialized.includes(String(rawUserId)),
    "Error must not expose Telegram user id.",
  );
  assert(
    !serialized.includes(String(rawChatId)),
    "Error must not expose Telegram chat id.",
  );
  assert(
    !serialized.includes(rawUsername),
    "Error must not expose Telegram username.",
  );
});
