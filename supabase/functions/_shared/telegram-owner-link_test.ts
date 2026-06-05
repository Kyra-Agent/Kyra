import {
  assertTelegramOwnerLinkChallenge,
  buildTelegramOwnerLinkDeepLink,
  createTelegramOwnerLinkChallengeMaterial,
  createTelegramOwnerLinkChallengeStoreInput,
  hashTelegramOwnerLinkChallenge,
  parseAndHashTelegramOwnerLinkUpdate,
  sanitizeTelegramOwnerLinkContractError,
  TelegramOwnerLinkContractError,
  telegramOwnerLinkChallengeBytes,
  telegramOwnerLinkChallengeTtlMs,
} from "./telegram-owner-link.ts";

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

const testNowMs = Date.parse("2026-06-05T00:00:00.000Z");
const testAgentId = "11111111-1111-4111-8111-111111111111";
const testSessionId = "22222222-2222-4222-8222-222222222222";
const testOwnerUserId = "33333333-3333-4333-8333-333333333333";
const testChallenge = "ab".repeat(32);

function createOwnerLinkUpdate(
  text: unknown = `/start ${testChallenge}`,
  options: {
    userId?: number;
    chatId?: number;
    chatType?: string;
  } = {},
) {
  return {
    update_id: 9001,
    message: {
      message_id: 42,
      from: { id: options.userId ?? 123456 },
      chat: {
        id: options.chatId ?? 123456,
        type: options.chatType ?? "private",
      },
      text,
    },
  };
}

Deno.test("telegram owner-link challenge material uses 256 random bits and ten minute TTL", async () => {
  let requestedBytes = 0;
  const material = await createTelegramOwnerLinkChallengeMaterial({
    nowMs: testNowMs,
    getRandomValues: (bytes) => {
      requestedBytes = bytes.length;
      bytes.fill(0xab);
      return bytes;
    },
  });

  assertEquals(requestedBytes, telegramOwnerLinkChallengeBytes);
  assertEquals(material.challenge, testChallenge);
  assertEquals(
    material.challengeHash,
    await hashTelegramOwnerLinkChallenge(testChallenge),
  );
  assertEquals(
    material.expiresAt,
    new Date(testNowMs + telegramOwnerLinkChallengeTtlMs).toISOString(),
  );
  assert(
    material.challengeHash !== material.challenge,
    "Stored hash must differ from the raw challenge.",
  );
});

Deno.test("telegram owner-link store input excludes raw challenge", async () => {
  const challengeHash = await hashTelegramOwnerLinkChallenge(testChallenge);
  const storeInput = createTelegramOwnerLinkChallengeStoreInput(
    {
      agentId: testAgentId,
      telegramSessionId: testSessionId,
      issuedByUserId: testOwnerUserId,
      challengeHash,
      expiresAt: new Date(testNowMs + telegramOwnerLinkChallengeTtlMs)
        .toISOString(),
      challenge: testChallenge,
    } as {
      agentId: unknown;
      telegramSessionId: unknown;
      issuedByUserId: unknown;
      challengeHash: unknown;
      expiresAt: unknown;
    },
    testNowMs,
  );
  const serialized = JSON.stringify(storeInput);

  assertEquals(storeInput.agentId, testAgentId);
  assertEquals(storeInput.telegramSessionId, testSessionId);
  assertEquals(storeInput.issuedByUserId, testOwnerUserId);
  assertEquals(storeInput.challengeHash, challengeHash);
  assert(
    !serialized.includes(testChallenge),
    "Store input must not include raw challenge.",
  );
});

Deno.test("telegram owner-link store input rejects expired or overlong TTL", async () => {
  const challengeHash = await hashTelegramOwnerLinkChallenge(testChallenge);
  const makeInput = (expiresAt: string) => ({
    agentId: testAgentId,
    telegramSessionId: testSessionId,
    issuedByUserId: testOwnerUserId,
    challengeHash,
    expiresAt,
  });
  const expired = await captureError(() =>
    createTelegramOwnerLinkChallengeStoreInput(
      makeInput(new Date(testNowMs).toISOString()),
      testNowMs,
    )
  );
  const overlong = await captureError(() =>
    createTelegramOwnerLinkChallengeStoreInput(
      makeInput(
        new Date(testNowMs + telegramOwnerLinkChallengeTtlMs + 1)
          .toISOString(),
      ),
      testNowMs,
    )
  );

  assert(expired instanceof TelegramOwnerLinkContractError, "Must reject.");
  assert(overlong instanceof TelegramOwnerLinkContractError, "Must reject.");
  assertEquals((expired as TelegramOwnerLinkContractError).statusCode, 400);
  assertEquals((overlong as TelegramOwnerLinkContractError).code, "invalid_owner_link");
});

Deno.test("telegram owner-link deep link contains only bot username and one-time challenge", () => {
  const deepLink = buildTelegramOwnerLinkDeepLink(
    "@Kyra_Demo_Bot",
    testChallenge,
  );

  assertEquals(
    deepLink,
    `https://t.me/kyra_demo_bot?start=${testChallenge}`,
  );
  assert(!deepLink.includes("botToken"), "Deep link must not include bot token.");
});

Deno.test("telegram owner-link parser hashes private chat start and link commands", async () => {
  const start = await parseAndHashTelegramOwnerLinkUpdate(
    createOwnerLinkUpdate(),
  );
  const link = await parseAndHashTelegramOwnerLinkUpdate(
    createOwnerLinkUpdate(`/link@Kyra_Demo_Bot ${testChallenge}`),
    { expectedBotUsername: "@kyra_demo_bot" },
  );
  const serialized = JSON.stringify({ start, link });

  assertEquals(start.telegramUpdateId, "9001");
  assertEquals(start.telegramUserId, "123456");
  assertEquals(start.telegramChatId, "123456");
  assertEquals(start.challengeHash, await hashTelegramOwnerLinkChallenge(testChallenge));
  assertEquals(link.challengeHash, start.challengeHash);
  assert(
    !serialized.includes(testChallenge),
    "Consume input must not include raw challenge.",
  );
  assert(
    !serialized.includes("/start") && !serialized.includes("/link"),
    "Consume input must not include command text.",
  );
});

Deno.test("telegram owner-link parser rejects groups, mismatched private ids, and unsafe commands", async () => {
  const cases = [
    createOwnerLinkUpdate(undefined, {
      chatId: -987654,
      chatType: "group",
    }),
    createOwnerLinkUpdate(undefined, { chatId: 654321 }),
    createOwnerLinkUpdate(`/start ${testChallenge} extra`),
    createOwnerLinkUpdate(`/start ${testChallenge.toUpperCase()}`),
    createOwnerLinkUpdate(`/status ${testChallenge}`),
    createOwnerLinkUpdate(`/start@Other_Bot ${testChallenge}`),
  ];

  for (const update of cases) {
    const error = await captureError(() =>
      parseAndHashTelegramOwnerLinkUpdate(update, {
        expectedBotUsername: "kyra_demo_bot",
      })
    );
    const serialized = JSON.stringify(error);

    assert(error instanceof TelegramOwnerLinkContractError, "Must reject.");
    assertEquals((error as TelegramOwnerLinkContractError).statusCode, 400);
    assertEquals((error as TelegramOwnerLinkContractError).code, "invalid_owner_link");
    assert(
      !serialized.includes(testChallenge),
      "Invalid error must not expose raw challenge.",
    );
  }
});

Deno.test("telegram owner-link parser sanitizes unexpected hash failures", async () => {
  const error = await captureError(() =>
    parseAndHashTelegramOwnerLinkUpdate(createOwnerLinkUpdate(), {
      hashChallenge: async () => {
        throw new Error(`raw hash failure ${testChallenge}`);
      },
    })
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof TelegramOwnerLinkContractError, "Must sanitize.");
  assertEquals((error as TelegramOwnerLinkContractError).statusCode, 500);
  assertEquals((error as TelegramOwnerLinkContractError).code, "server_error");
  assertEquals(
    (error as TelegramOwnerLinkContractError).message,
    "Telegram owner-link challenge processing failed.",
  );
  assert(
    !serialized.includes(testChallenge),
    "Sanitized error must not expose raw challenge.",
  );
});

Deno.test("telegram owner-link challenge validator requires exact lowercase hex", async () => {
  assertEquals(assertTelegramOwnerLinkChallenge(testChallenge), testChallenge);

  for (
    const value of [
      "",
      ` ${testChallenge}`,
      testChallenge.toUpperCase(),
      "a".repeat(63),
      "g".repeat(64),
    ]
  ) {
    const error = await captureError(() =>
      assertTelegramOwnerLinkChallenge(value)
    );
    assert(error instanceof TelegramOwnerLinkContractError, "Must reject.");
    assertEquals((error as TelegramOwnerLinkContractError).code, "invalid_owner_link");
  }
});

Deno.test("telegram owner-link sanitizer returns fixed safe error", () => {
  const error = sanitizeTelegramOwnerLinkContractError(
    new Error(`raw ${testChallenge} owner_user_id token_secret_ref`),
  );
  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
  });

  assertEquals(error.statusCode, 500);
  assertEquals(error.code, "server_error");
  assertEquals(
    error.message,
    "Telegram owner-link challenge processing failed.",
  );
  assert(!serialized.includes(testChallenge), "Must hide raw challenge.");
  assert(!serialized.includes("owner_user_id"), "Must hide owner internals.");
  assert(!serialized.includes("token_secret_ref"), "Must hide token refs.");
});
