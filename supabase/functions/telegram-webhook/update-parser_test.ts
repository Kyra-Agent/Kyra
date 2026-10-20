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
  const policy = parseTelegramWebhookUpdate(createUpdate("/policy"));

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
  assertEquals(policy.command, "policy");
  assertEquals(policy.commandKind, "read_only");
});

Deno.test("telegram update parser carries a safe Telegram language hint", () => {
  const update = createUpdate("¿Qué estrategia usa este agente?");
  update.message.from = { id: 123456, language_code: "es-MX" } as {
    id: number;
    language_code: string;
  };

  const parsed = parseTelegramWebhookUpdate(update);

  assertEquals(parsed.command, "chat");
  assertEquals(parsed.languageCode, "es-MX");

  update.message.from = { id: 123456, language_code: "unsafe value" } as {
    id: number;
    language_code: string;
  };
  const sanitized = parseTelegramWebhookUpdate(update);
  assertEquals(sanitized.languageCode, undefined);
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

Deno.test("telegram update parser accepts bounded read-only chat text", () => {
  const parsed = parseTelegramWebhookUpdate(
    createUpdate("make a campaign plan for Agent 666"),
  );

  assertEquals(parsed.command, "chat");
  assertEquals(parsed.commandKind, "read_only");
  assertEquals(parsed.text, "make a campaign plan for Agent 666");
});

Deno.test("telegram update parser rejects oversized read-only chat text", () => {
  assertThrowsHttpError(
    () => parseTelegramWebhookUpdate(createUpdate("x".repeat(1001))),
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

function createGroupUpdate(text: string, extra: Record<string, unknown> = {}) {
  return {
    update_id: 9100,
    message: {
      message_id: 77,
      text,
      from: { id: 555, is_bot: false, language_code: "en" },
      chat: { id: -1001234567890, type: "supergroup", title: "ABC <Community>\n" },
      ...extra,
    },
  };
}

const groupBot = { expectedBotUsername: "@kyra_test_bot" };

Deno.test("telegram update parser treats /ask as a question meant for the bot", () => {
  for (
    const text of [
      "/ask when is the unlock?",
      "/ask@kyra_test_bot when is the unlock?",
      "/ASK   when is the unlock?",
    ]
  ) {
    const parsed = parseTelegramWebhookUpdate(createGroupUpdate(text), groupBot);
    assertEquals(parsed.command, "chat");
    assertEquals(parsed.text, "when is the unlock?");
    assertEquals(parsed.addressedToBot, true);
    assertEquals(parsed.chatType, "supergroup");
    assertEquals(parsed.chatTitle, "ABC Community");
  }

  assertEquals(
    parseTelegramWebhookUpdate(createGroupUpdate("/ask"), groupBot).command,
    "help",
  );
  assertThrowsHttpError(
    () => parseTelegramWebhookUpdate(createGroupUpdate("/ask@other_bot hi"), groupBot),
    422,
    "unsupported_update",
  );
});

Deno.test("telegram update parser only addresses group chatter that targets the bot", () => {
  const chatter = parseTelegramWebhookUpdate(createGroupUpdate("gm everyone"), groupBot);
  assertEquals(chatter.command, "chat");
  assertEquals(chatter.addressedToBot, false);

  const mention = parseTelegramWebhookUpdate(
    createGroupUpdate("hey @Kyra_Test_Bot what is the supply?"),
    groupBot,
  );
  assertEquals(mention.addressedToBot, true);
  assertEquals(mention.text, "hey what is the supply?");

  const reply = parseTelegramWebhookUpdate(
    createGroupUpdate("and the vesting?", {
      reply_to_message: { from: { id: 1, is_bot: true, username: "kyra_test_bot" } },
    }),
    groupBot,
  );
  assertEquals(reply.addressedToBot, true);

  const replyToHuman = parseTelegramWebhookUpdate(
    createGroupUpdate("agreed", {
      reply_to_message: { from: { id: 2, is_bot: false, username: "kyra_test_bot" } },
    }),
    groupBot,
  );
  assertEquals(replyToHuman.addressedToBot, false);
});

Deno.test("telegram update parser keeps private chats addressed and supports community commands", () => {
  const privateChat = parseTelegramWebhookUpdate({
    update_id: 9200,
    message: {
      message_id: 3,
      text: "gm",
      from: { id: 555, is_bot: false },
      chat: { id: 555, type: "private" },
    },
  });
  assertEquals(privateChat.addressedToBot, true);
  assertEquals(privateChat.chatType, "private");

  for (const command of ["community_on", "community_off"]) {
    const parsed = parseTelegramWebhookUpdate(
      createGroupUpdate(`/${command}@kyra_test_bot`),
      groupBot,
    );
    assertEquals(parsed.command, command);
    assertEquals(parsed.addressedToBot, true);
  }
});

Deno.test("telegram update parser reads monitoring commands and their arguments", () => {
  const cases: Array<[string, string, string | undefined]> = [
    ["/watch 0x5fc5360d0400a0fd4f2af552add042d716f1d168", "watch", "0x5fc5360d0400a0fd4f2af552add042d716f1d168"],
    ["/alert@kyra_test_bot 0x5fc5360d0400a0fd4f2af552add042d716f1d168   above  2.5", "alert", "0x5fc5360d0400a0fd4f2af552add042d716f1d168 above 2.5"],
    ["/launches on", "launches", "on"],
    ["/watch", "watch", undefined],
    ["/watchlist", "watchlist", undefined],
    ["/alerts_clear", "alerts_clear", undefined],
  ];

  for (const [text, command, args] of cases) {
    const parsed = parseTelegramWebhookUpdate(
      {
        update_id: 9400,
        message: {
          message_id: 5,
          text,
          from: { id: 555, is_bot: false },
          chat: { id: 555, type: "private" },
        },
      },
      { expectedBotUsername: "@kyra_test_bot" },
    );
    assertEquals(parsed.command, command, text);
    assertEquals(parsed.text, args, text);
  }
});
