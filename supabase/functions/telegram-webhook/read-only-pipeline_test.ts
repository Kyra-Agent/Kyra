import { HttpError } from "./core.ts";
import { processVerifiedTelegramReadOnlyUpdate } from "./read-only-pipeline.ts";

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

function createUpdate(
  text: string = "/status",
  telegramUserId = 123456,
  telegramChatId = -987654,
) {
  return {
    update_id: 9001,
    message: {
      message_id: 42,
      from: { id: telegramUserId },
      chat: { id: telegramChatId },
      text,
    },
  };
}

Deno.test("telegram read-only pipeline authorizes personal owner help", () => {
  const result = processVerifiedTelegramReadOnlyUpdate({
    update: createUpdate("/help"),
    chatPolicy: {
      mode: "personal",
      ownerTelegramUserId: 123456,
      ownerTelegramChatId: -987654,
    },
  });

  assertEquals(result.command, "help");
  assertEquals(result.commandKind, "read_only");
  assertEquals(result.authorizationRole, "owner");
  assertEquals(result.response.command, "help");
});

Deno.test("telegram read-only pipeline authorizes community member status", () => {
  const result = processVerifiedTelegramReadOnlyUpdate({
    update: createUpdate("/status"),
    chatPolicy: {
      mode: "community",
      allowedTelegramUserIds: [123456],
    },
  });

  assertEquals(result.command, "status");
  assertEquals(result.authorizationRole, "member");
  assertEquals(result.response.command, "status");
});

Deno.test("telegram read-only pipeline allows community public read-only command", () => {
  const result = processVerifiedTelegramReadOnlyUpdate({
    update: createUpdate("/help", 111111, -222222),
    chatPolicy: {
      mode: "community",
      allowPublicReadOnly: true,
    },
  });

  assertEquals(result.commandKind, "read_only");
  assertEquals(result.authorizationRole, "public_read_only");
});

Deno.test("telegram read-only pipeline rejects unknown personal chat before response", () => {
  const error = assertThrowsHttpError(
    () =>
      processVerifiedTelegramReadOnlyUpdate({
        update: createUpdate("/help", 111111, -222222),
        chatPolicy: {
          mode: "personal",
          ownerTelegramUserId: 123456,
          ownerTelegramChatId: -987654,
        },
      }),
    403,
    "chat_not_authorized",
  );

  assertEquals(error.message, "Telegram chat is not authorized.");
});

Deno.test("telegram read-only pipeline rejects missing identity as invalid update", () => {
  const update = createUpdate("/status") as Record<string, unknown>;
  const message = update.message as Record<string, unknown>;
  delete message.from;

  assertThrowsHttpError(
    () =>
      processVerifiedTelegramReadOnlyUpdate({
        update,
        chatPolicy: {
          mode: "community",
          allowPublicReadOnly: true,
        },
      }),
    400,
    "invalid_update",
  );
});

Deno.test("telegram read-only pipeline rejects unsupported command before authorization", () => {
  assertThrowsHttpError(
    () =>
      processVerifiedTelegramReadOnlyUpdate({
        update: createUpdate("/approve", 111111, -222222),
        chatPolicy: {
          mode: "personal",
          ownerTelegramUserId: 123456,
        },
      }),
    422,
    "unsupported_update",
  );
});

Deno.test("telegram read-only pipeline rejects mismatched bot target", () => {
  assertThrowsHttpError(
    () =>
      processVerifiedTelegramReadOnlyUpdate({
        update: createUpdate("/status@other_demo_bot"),
        expectedBotUsername: "kyra_demo_bot",
        chatPolicy: {
          mode: "personal",
          ownerTelegramUserId: 123456,
        },
      }),
    422,
    "unsupported_update",
  );
});

Deno.test("telegram read-only pipeline result excludes identities and policy", () => {
  const rawUserId = 123456;
  const rawChatId = -987654;
  const rawOwnerId = 333333;
  const result = processVerifiedTelegramReadOnlyUpdate({
    update: createUpdate("/status", rawUserId, rawChatId),
    chatPolicy: {
      mode: "community",
      allowedTelegramUserIds: [rawUserId],
      adminTelegramUserIds: [rawOwnerId],
    },
  });
  const serialized = JSON.stringify(result);

  assertEquals(
    Object.keys(result).sort().join(","),
    "authorizationRole,command,commandKind,response",
  );
  assert(!serialized.includes(String(rawUserId)), "Result must hide user id.");
  assert(!serialized.includes(String(rawChatId)), "Result must hide chat id.");
  assert(
    !serialized.includes(String(rawOwnerId)),
    "Result must hide policy ids.",
  );
  assert(!serialized.includes("chatPolicy"), "Result must hide policy.");
  assert(!serialized.includes("telegramUserId"), "Result must hide identity.");
  assert(!serialized.includes("telegramChatId"), "Result must hide identity.");
});
