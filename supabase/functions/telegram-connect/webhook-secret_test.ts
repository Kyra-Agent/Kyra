import {
  assertActivateTelegramSessionResult,
  assertRevokeTelegramWebhookSecretResult,
  assertStoreTelegramWebhookSecretResult,
  assertTelegramSessionId,
  assertTelegramWebhookSecretHash,
  assertTelegramWebhookSecretRef,
  assertTelegramWebhookSecretToken,
  createTelegramWebhookSecretMaterial,
  createTelegramWebhookSecretStoreInput,
  generateTelegramWebhookSecretRef,
  generateTelegramWebhookSecretToken,
  hashTelegramWebhookSecretToken,
  sanitizeTelegramSessionActivationError,
  sanitizeTelegramWebhookSecretPersistenceError,
} from "./webhook-secret.ts";
import { HttpError } from "./core.ts";

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

const testSessionId = "66666666-6666-4666-8666-666666666666";
const testWebhookSecretToken =
  "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const testWebhookSecretHash =
  "ffe054fe7ae0cb6dc65c3af9b61d5209f439851db43d0ba5997337df154668eb";
const testWebhookSecretRef =
  "webhook:telegram:77777777-7777-4777-8777-777777777777";

Deno.test("telegram webhook secret token generation uses 32 random bytes as lowercase hex", () => {
  const token = generateTelegramWebhookSecretToken((bytes) => {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = index;
    }

    return bytes;
  });

  assertEquals(
    token,
    "000102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f",
  );
});

Deno.test("telegram webhook secret token validator accepts exact lowercase hex only", async () => {
  assertEquals(
    assertTelegramWebhookSecretToken(testWebhookSecretToken),
    testWebhookSecretToken,
  );

  const shortError = await captureError(() =>
    assertTelegramWebhookSecretToken("a".repeat(63))
  );
  const uppercaseError = await captureError(() =>
    assertTelegramWebhookSecretToken("A".repeat(64))
  );

  assert(shortError instanceof HttpError, "Short token must be rejected.");
  assert(uppercaseError instanceof HttpError, "Uppercase token must reject.");
  assertEquals((shortError as HttpError).statusCode, 400);
  assertEquals(
    (uppercaseError as HttpError).message,
    "webhookSecretToken is invalid.",
  );
});

Deno.test("telegram webhook secret hash is deterministic SHA-256 lowercase hex", async () => {
  const hash = await hashTelegramWebhookSecretToken(testWebhookSecretToken);

  assertEquals(hash, testWebhookSecretHash);
  assertEquals(assertTelegramWebhookSecretHash(hash), testWebhookSecretHash);
});

Deno.test("telegram webhook secret ref generation uses approved backend ref format", () => {
  const ref = generateTelegramWebhookSecretRef(() =>
    "77777777-7777-4777-8777-777777777777"
  );

  assertEquals(ref, testWebhookSecretRef);
  assertEquals(assertTelegramWebhookSecretRef(ref), testWebhookSecretRef);
});

Deno.test("telegram webhook secret ref validator rejects non-v4 or non-telegram refs", async () => {
  const wrongPrefixError = await captureError(() =>
    assertTelegramWebhookSecretRef(
      "vault:telegram:77777777-7777-4777-8777-777777777777",
    )
  );
  const wrongVersionError = await captureError(() =>
    assertTelegramWebhookSecretRef(
      "webhook:telegram:77777777-7777-5777-8777-777777777777",
    )
  );

  assert(wrongPrefixError instanceof HttpError, "Wrong prefix must reject.");
  assert(
    wrongVersionError instanceof HttpError,
    "Wrong UUID version must reject.",
  );
  assertEquals(
    (wrongPrefixError as HttpError).message,
    "webhookSecretRef is invalid.",
  );
  assertEquals((wrongVersionError as HttpError).statusCode, 400);
});

Deno.test("telegram webhook secret material returns raw token only for setWebhook boundary", async () => {
  const material = await createTelegramWebhookSecretMaterial({
    webhookSecretToken: testWebhookSecretToken,
    webhookSecretRef: testWebhookSecretRef,
  });

  assertEquals(material.webhookSecretToken, testWebhookSecretToken);
  assertEquals(material.webhookSecretHash, testWebhookSecretHash);
  assertEquals(material.webhookSecretRef, testWebhookSecretRef);
});

Deno.test("telegram webhook secret store input excludes raw secret token", () => {
  const input = createTelegramWebhookSecretStoreInput({
    telegramSessionId: testSessionId,
    webhookSecretHash: testWebhookSecretHash,
    webhookSecretRef: testWebhookSecretRef,
  });
  const serialized = JSON.stringify(input);

  assertEquals(input.telegramSessionId, testSessionId);
  assertEquals(input.webhookSecretHash, testWebhookSecretHash);
  assertEquals(input.webhookSecretRef, testWebhookSecretRef);
  assert(
    !serialized.includes(testWebhookSecretToken),
    "Store input must not include raw webhook secret token.",
  );
  assertEquals(
    Object.keys(input).sort().join(","),
    "telegramSessionId,webhookSecretHash,webhookSecretRef",
  );
});

Deno.test("telegram webhook secret store input validates session id and hashes safely", async () => {
  assertEquals(assertTelegramSessionId(testSessionId), testSessionId);

  const badSessionError = await captureError(() =>
    createTelegramWebhookSecretStoreInput({
      telegramSessionId: "not-a-uuid",
      webhookSecretHash: testWebhookSecretHash,
      webhookSecretRef: testWebhookSecretRef,
    })
  );
  const badHashError = await captureError(() =>
    createTelegramWebhookSecretStoreInput({
      telegramSessionId: testSessionId,
      webhookSecretHash: "raw-secret",
      webhookSecretRef: testWebhookSecretRef,
    })
  );

  assert(badSessionError instanceof HttpError, "Bad session id must reject.");
  assert(badHashError instanceof HttpError, "Bad hash must reject.");
  assertEquals(
    (badSessionError as HttpError).message,
    "telegramSessionId is invalid.",
  );
  assertEquals(
    (badHashError as HttpError).message,
    "webhookSecretHash is invalid.",
  );
});

Deno.test("telegram webhook secret store result validates expected opaque ref", async () => {
  const result = assertStoreTelegramWebhookSecretResult(
    { webhookSecretRef: testWebhookSecretRef },
    testWebhookSecretRef,
  );
  const wrongRefError = await captureError(() =>
    assertStoreTelegramWebhookSecretResult(
      { webhookSecretRef: testWebhookSecretRef },
      "webhook:telegram:88888888-8888-4888-8888-888888888888",
    )
  );

  assertEquals(result.webhookSecretRef, testWebhookSecretRef);
  assert(
    wrongRefError instanceof Error,
    "Unexpected webhook secret ref must reject.",
  );
  assert(
    !String((wrongRefError as Error).message).includes(testWebhookSecretRef),
    "Unexpected ref errors must not expose webhookSecretRef.",
  );
});

Deno.test("telegram webhook secret revoke result requires explicit revoked true", async () => {
  assertEquals(
    assertRevokeTelegramWebhookSecretResult({ revoked: true }).revoked,
    true,
  );

  const notRevokedError = await captureError(() =>
    assertRevokeTelegramWebhookSecretResult({ revoked: false })
  );

  assert(
    notRevokedError instanceof Error,
    "Non-revoked result must reject.",
  );
  assertEquals(
    (notRevokedError as Error).message,
    "Telegram webhook secret was not revoked.",
  );
});

Deno.test("telegram session activation result requires exact expected session id", async () => {
  const result = assertActivateTelegramSessionResult(
    { activated: true, telegramSessionId: testSessionId },
    testSessionId,
  );
  const mismatchError = await captureError(() =>
    assertActivateTelegramSessionResult(
      {
        activated: true,
        telegramSessionId: "88888888-8888-4888-8888-888888888888",
      },
      testSessionId,
    )
  );
  const inactiveError = await captureError(() =>
    assertActivateTelegramSessionResult(
      { activated: false, telegramSessionId: testSessionId },
      testSessionId,
    )
  );

  assertEquals(result.activated, true);
  assertEquals(result.telegramSessionId, testSessionId);
  assert(mismatchError instanceof Error, "Mismatched activation must reject.");
  assert(inactiveError instanceof Error, "Inactive activation must reject.");
  assert(
    !String((mismatchError as Error).message).includes(testSessionId),
    "Activation mismatch errors must not expose session id.",
  );
});

Deno.test("telegram webhook secret persistence sanitizers hide raw internals", () => {
  const rawSecretError = new Error(
    `raw ${testWebhookSecretRef} ${testWebhookSecretHash} ${testSessionId}`,
  );
  const persistenceError = sanitizeTelegramWebhookSecretPersistenceError(
    rawSecretError,
  );
  const activationError = sanitizeTelegramSessionActivationError(
    rawSecretError,
  );
  const serialized = JSON.stringify({
    persistence: {
      code: persistenceError.code,
      message: persistenceError.message,
    },
    activation: {
      code: activationError.code,
      message: activationError.message,
    },
  });

  assertEquals(persistenceError.statusCode, 500);
  assertEquals(
    persistenceError.message,
    "Telegram webhook secret persistence failed.",
  );
  assertEquals(activationError.statusCode, 500);
  assertEquals(activationError.message, "Telegram session activation failed.");
  assert(
    !serialized.includes(testWebhookSecretRef),
    "Sanitized errors must not expose webhookSecretRef.",
  );
  assert(
    !serialized.includes(testWebhookSecretHash),
    "Sanitized errors must not expose webhookSecretHash.",
  );
  assert(
    !serialized.includes(testSessionId),
    "Sanitized errors must not expose telegramSessionId.",
  );
});
