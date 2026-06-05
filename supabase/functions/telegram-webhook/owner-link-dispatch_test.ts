import {
  type TelegramOwnerLinkConsumeInput,
  TelegramOwnerLinkContractError,
} from "../_shared/telegram-owner-link.ts";
import { HttpError } from "./core.ts";
import {
  assertTelegramOwnerLinkTerminalResult,
  dispatchVerifiedTelegramWebhookUpdate,
  isTelegramOwnerLinkCommandCandidate,
  sanitizeTelegramOwnerLinkDispatchError,
  type TelegramWebhookDispatchDependencies,
} from "./owner-link-dispatch.ts";
import type { TelegramOwnerLinkConsumeResult } from "./owner-link-consume.ts";
import type { TelegramWebhookParsedCommand } from "./update-parser.ts";

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

async function captureError(action: () => Promise<unknown> | unknown) {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw.");
}

const telegramSessionId = "11111111-1111-4111-8111-111111111111";
const telegramUpdateId = "123";
const telegramUserId = "456";
const challenge = "ab".repeat(32);
const challengeHash = "cd".repeat(32);

const parsedReadOnly: TelegramWebhookParsedCommand = {
  updateId: telegramUpdateId,
  messageId: "789",
  telegramUserId,
  telegramChatId: telegramUserId,
  command: "status",
  commandKind: "read_only",
};

const parsedOwnerLink: TelegramOwnerLinkConsumeInput = {
  telegramUpdateId,
  telegramUserId,
  telegramChatId: telegramUserId,
  challengeHash,
};

function createUpdate(text: string) {
  return {
    update_id: Number(telegramUpdateId),
    message: {
      message_id: 789,
      from: { id: Number(telegramUserId) },
      chat: { id: Number(telegramUserId), type: "private" },
      text,
    },
  };
}

function createDispatchDependencies(
  overrides: Partial<TelegramWebhookDispatchDependencies> = {},
): TelegramWebhookDispatchDependencies {
  return {
    parseOwnerLinkUpdate: async () => parsedOwnerLink,
    consumeOwnerLinkChallenge: async () => ({
      linked: true,
      status: "linked",
    }),
    parseReadOnlyUpdate: () => parsedReadOnly,
    ...overrides,
  };
}

Deno.test("owner-link dispatch candidate detector is narrow and bounded", () => {
  for (
    const text of [
      `/start ${challenge}`,
      `/link ${challenge}`,
      `/start@kyra_test_bot ${challenge}`,
      "/start",
      "/link invalid",
    ]
  ) {
    assert(
      isTelegramOwnerLinkCommandCandidate(createUpdate(text)),
      `Expected owner-link candidate: ${text}`,
    );
  }

  for (
    const value of [
      createUpdate("/status"),
      createUpdate("/startup"),
      createUpdate("start"),
      null,
      [],
    ]
  ) {
    assert(
      !isTelegramOwnerLinkCommandCandidate(value),
      "Unexpected owner-link candidate.",
    );
  }
});

Deno.test("owner-link dispatch disabled routes candidate to existing read-only parser only", async () => {
  let ownerParserCalled = false;
  let consumeCalled = false;
  const result = await dispatchVerifiedTelegramWebhookUpdate(
    {
      update: createUpdate(`/start ${challenge}`),
      telegramSessionId,
      expectedBotUsername: "@kyra_test_bot",
      ownerLinkConsumeEnabled: false,
    },
    createDispatchDependencies({
      parseOwnerLinkUpdate: async () => {
        ownerParserCalled = true;
        throw new Error("Disabled owner-link parser must not run.");
      },
      consumeOwnerLinkChallenge: async () => {
        consumeCalled = true;
        throw new Error("Disabled owner-link consume must not run.");
      },
    }),
  );

  assertEquals(result.route, "read_only");
  assert(!ownerParserCalled, "Disabled owner-link parser must not run.");
  assert(!consumeCalled, "Disabled owner-link consume must not run.");
});

Deno.test("owner-link dispatch enabled preserves normal read-only route", async () => {
  let ownerParserCalled = false;
  let consumeCalled = false;
  const result = await dispatchVerifiedTelegramWebhookUpdate(
    {
      update: createUpdate("/status"),
      telegramSessionId,
      expectedBotUsername: "@kyra_test_bot",
      ownerLinkConsumeEnabled: true,
    },
    createDispatchDependencies({
      parseOwnerLinkUpdate: async () => {
        ownerParserCalled = true;
        throw new Error("Normal command must not use owner-link parser.");
      },
      consumeOwnerLinkChallenge: async () => {
        consumeCalled = true;
        throw new Error("Normal command must not use owner-link consume.");
      },
    }),
  );

  assertEquals(result.route, "read_only");
  assert(!ownerParserCalled, "Normal command must not use owner-link parser.");
  assert(!consumeCalled, "Normal command must not use owner-link consume.");
});

Deno.test("owner-link dispatch parses then consumes once and returns generic acknowledgement", async () => {
  const order: string[] = [];
  const consumed: Array<Record<string, unknown>> = [];
  let readOnlyCalled = false;
  const result = await dispatchVerifiedTelegramWebhookUpdate(
    {
      update: createUpdate(`/start ${challenge}`),
      telegramSessionId,
      expectedBotUsername: "@kyra_test_bot",
      ownerLinkConsumeEnabled: true,
    },
    createDispatchDependencies({
      parseOwnerLinkUpdate: async () => {
        order.push("parse_owner_link");
        return parsedOwnerLink;
      },
      consumeOwnerLinkChallenge: async (input) => {
        order.push("consume");
        consumed.push(input);
        return { linked: true, status: "linked" };
      },
      parseReadOnlyUpdate: () => {
        readOnlyCalled = true;
        throw new Error("Owner-link route must not use read-only parser.");
      },
    }),
  );
  const serialized = JSON.stringify(result);

  assertEquals(order.join(","), "parse_owner_link,consume");
  assertEquals(consumed.length, 1);
  assertEquals(consumed[0]?.telegramSessionId, telegramSessionId);
  assertEquals(consumed[0]?.telegramUpdateId, telegramUpdateId);
  assertEquals(consumed[0]?.telegramUserId, telegramUserId);
  assertEquals(consumed[0]?.telegramChatId, telegramUserId);
  assertEquals(consumed[0]?.challengeHash, challengeHash);
  assert(!readOnlyCalled, "Owner-link route must not use read-only parser.");
  assert(
    result.route === "owner_link" && result.status === "received",
    "Expected generic owner-link acknowledgement.",
  );
  assert(
    !serialized.includes(challenge),
    "Acknowledgement must hide challenge.",
  );
  assert(
    !serialized.includes(challengeHash),
    "Acknowledgement must hide hash.",
  );
  assert(
    !serialized.includes(telegramSessionId),
    "Acknowledgement must hide session id.",
  );
  assert(
    !serialized.includes(telegramUserId),
    "Acknowledgement must hide Telegram identity.",
  );
});

Deno.test("owner-link dispatch returns the same acknowledgement for terminal consume outcomes", async () => {
  const results: TelegramOwnerLinkConsumeResult[] = [
    { linked: true, status: "linked" },
    { linked: false, status: "duplicate" },
    { linked: false, status: "not_linked" },
  ];
  const acknowledgements: string[] = [];

  for (const consumeResult of results) {
    const result = await dispatchVerifiedTelegramWebhookUpdate(
      {
        update: createUpdate(`/link ${challenge}`),
        telegramSessionId,
        ownerLinkConsumeEnabled: true,
      },
      createDispatchDependencies({
        consumeOwnerLinkChallenge: async () => consumeResult,
      }),
    );
    acknowledgements.push(JSON.stringify(result));
  }

  assertEquals(new Set(acknowledgements).size, 1);
});

Deno.test("owner-link dispatch acknowledges invalid owner-link candidates without consume", async () => {
  let consumeCalled = false;
  const result = await dispatchVerifiedTelegramWebhookUpdate(
    {
      update: createUpdate("/start invalid"),
      telegramSessionId,
      ownerLinkConsumeEnabled: true,
    },
    createDispatchDependencies({
      parseOwnerLinkUpdate: async () => {
        throw new TelegramOwnerLinkContractError(
          400,
          "invalid_owner_link",
          `raw ${challengeHash}`,
        );
      },
      consumeOwnerLinkChallenge: async () => {
        consumeCalled = true;
        throw new Error("Invalid owner-link candidate must not consume.");
      },
    }),
  );

  assert(
    result.route === "owner_link" && result.status === "received",
    "Expected generic owner-link acknowledgement.",
  );
  assert(!consumeCalled, "Invalid owner-link candidate must not consume.");
  assert(
    !JSON.stringify(result).includes(challengeHash),
    "Acknowledgement must hide invalid challenge details.",
  );
});

Deno.test("owner-link dispatch sanitizes unexpected parser consume and result failures", async () => {
  for (
    const dependencies of [
      createDispatchDependencies({
        parseOwnerLinkUpdate: async () => {
          throw new Error(`raw parser ${challengeHash}`);
        },
      }),
      createDispatchDependencies({
        consumeOwnerLinkChallenge: async () => {
          throw new Error(`raw consume ${telegramUserId}`);
        },
      }),
      createDispatchDependencies({
        consumeOwnerLinkChallenge:
          async () => ({ linked: true, status: "duplicate" } as never),
      }),
    ]
  ) {
    const error = await captureError(() =>
      dispatchVerifiedTelegramWebhookUpdate(
        {
          update: createUpdate(`/start ${challenge}`),
          telegramSessionId,
          ownerLinkConsumeEnabled: true,
        },
        dependencies,
      )
    );
    const serialized = JSON.stringify(error);

    assert(error instanceof HttpError, "Expected sanitized HttpError.");
    assertEquals((error as HttpError).statusCode, 500);
    assertEquals((error as HttpError).code, "server_error");
    assertEquals(
      (error as HttpError).message,
      "Telegram owner-link dispatch failed.",
    );
    assert(!serialized.includes(challengeHash), "Error must hide hash.");
    assert(!serialized.includes(telegramUserId), "Error must hide identity.");
  }

  const sanitized = sanitizeTelegramOwnerLinkDispatchError(
    new Error(`raw ${challengeHash}`),
  );
  const terminalError = await captureError(() =>
    assertTelegramOwnerLinkTerminalResult({
      linked: false,
      status: "raw",
      token_secret_ref: challengeHash,
    })
  );

  for (const error of [sanitized, terminalError]) {
    assert(error instanceof HttpError, "Expected sanitized HttpError.");
    assertEquals(
      (error as HttpError).message,
      "Telegram owner-link dispatch failed.",
    );
    assert(
      !JSON.stringify(error).includes(challengeHash),
      "Error must hide raw values.",
    );
  }
});
