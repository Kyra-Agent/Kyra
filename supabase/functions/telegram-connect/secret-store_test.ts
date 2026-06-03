import { HttpError } from "./core.ts";
import {
  assertTokenSecretRef,
  createMockTelegramBotTokenSecretStore,
  sanitizeSecretStoreError,
} from "./secret-store.ts";

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

const testAgentId = "11111111-1111-4111-8111-111111111111";
const testOwnerUserId = "33333333-3333-4333-8333-333333333333";
const testTelegramBotId = "987654321";
const testBotToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";

Deno.test("mock telegram secret store returns opaque token ref", async () => {
  const store = createMockTelegramBotTokenSecretStore();

  const result = await store.storeTelegramBotToken({
    agentId: testAgentId,
    ownerUserId: testOwnerUserId,
    telegramBotId: testTelegramBotId,
    botToken: testBotToken,
  });
  const serialized = JSON.stringify(result);

  assertEquals(result.provider, "mock");
  assert(
    result.tokenSecretRef.startsWith("mock_telegram_token_ref_"),
    "Token ref must be mock namespaced.",
  );
  assert(
    !serialized.includes(testBotToken),
    "Store result must not expose botToken.",
  );
  assert(
    !serialized.includes(testAgentId),
    "Mock token ref must not encode agentId.",
  );
  assert(
    !serialized.includes(testOwnerUserId),
    "Mock token ref must not encode ownerUserId.",
  );
  assert(
    !serialized.includes(testTelegramBotId),
    "Mock token ref must not encode telegramBotId.",
  );
});

Deno.test("mock telegram secret store resolves token only by opaque ref", async () => {
  const store = createMockTelegramBotTokenSecretStore();
  const stored = await store.storeTelegramBotToken({
    agentId: testAgentId,
    ownerUserId: testOwnerUserId,
    telegramBotId: testTelegramBotId,
    botToken: testBotToken,
  });

  const resolved = await store.resolveTelegramBotToken({
    tokenSecretRef: stored.tokenSecretRef,
  });

  assertEquals(resolved.botToken, testBotToken);
});

Deno.test("mock telegram secret store revokes token ref", async () => {
  const store = createMockTelegramBotTokenSecretStore();
  const stored = await store.storeTelegramBotToken({
    agentId: testAgentId,
    ownerUserId: testOwnerUserId,
    telegramBotId: testTelegramBotId,
    botToken: testBotToken,
  });

  const revoked = await store.revokeTelegramBotToken({
    tokenSecretRef: stored.tokenSecretRef,
  });
  const error = await captureError(() =>
    store.resolveTelegramBotToken({
      tokenSecretRef: stored.tokenSecretRef,
    })
  );

  assertEquals(revoked.revoked, true);
  assert(
    error instanceof HttpError,
    "Missing revoked secret must throw HttpError.",
  );
  assertEquals((error as HttpError).statusCode, 404);
  assertEquals((error as HttpError).code, "secret_not_found");
});

Deno.test("mock telegram secret store rejects invalid tokenSecretRef", async () => {
  const store = createMockTelegramBotTokenSecretStore();
  const error = await captureError(() =>
    store.resolveTelegramBotToken({
      tokenSecretRef: "../secret",
    })
  );

  assert(error instanceof HttpError, "Invalid ref must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
  assertEquals((error as HttpError).message, "tokenSecretRef is invalid.");
});

Deno.test("mock telegram secret store validates required input without leaking token", async () => {
  const store = createMockTelegramBotTokenSecretStore();
  const error = await captureError(() =>
    store.storeTelegramBotToken({
      agentId: testAgentId,
      ownerUserId: testOwnerUserId,
      telegramBotId: testTelegramBotId,
      botToken: "",
    })
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "Missing botToken must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
  assertEquals((error as HttpError).message, "botToken is required.");
  assert(!serialized.includes(testBotToken), "Error must not expose botToken.");
});

Deno.test("telegram token secret ref validator accepts opaque refs", () => {
  const tokenSecretRef = assertTokenSecretRef("mock_telegram_token_ref_000001");

  assertEquals(tokenSecretRef, "mock_telegram_token_ref_000001");
});

Deno.test("telegram token secret ref validator rejects missing refs", async () => {
  const error = await captureError(() => assertTokenSecretRef(""));

  assert(error instanceof HttpError, "Missing token ref must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
  assertEquals((error as HttpError).message, "tokenSecretRef is required.");
});

Deno.test("secret store sanitizer keeps HttpError but hides unexpected failures", () => {
  const known = new HttpError(
    503,
    "secret_store_unavailable",
    "Secret store unavailable.",
  );
  const unknown = new Error(`raw failure for ${testBotToken}`);

  const knownResult = sanitizeSecretStoreError(known);
  const unknownResult = sanitizeSecretStoreError(unknown);
  const serializedUnknown = JSON.stringify(unknownResult);

  assertEquals(knownResult, known);
  assertEquals(unknownResult.statusCode, 500);
  assertEquals(unknownResult.code, "server_error");
  assertEquals(unknownResult.message, "Telegram token secret store failed.");
  assert(
    !serializedUnknown.includes(testBotToken),
    "Sanitized error must not expose botToken.",
  );
});
