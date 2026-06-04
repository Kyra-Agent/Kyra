import { HttpError } from "./core.ts";
import {
  assertTelegramUpdateClaimResult,
  sanitizeTelegramUpdateClaimError,
  shouldProcessTelegramUpdateClaim,
} from "./idempotency.ts";

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

function assertThrowsServerError(action: () => unknown) {
  let error: unknown;

  try {
    action();
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof HttpError, "Expected action to throw HttpError.");
  assertEquals((error as HttpError).statusCode, 500);
  assertEquals((error as HttpError).code, "server_error");
  assertEquals(
    (error as HttpError).message,
    "Telegram update claim validation failed.",
  );

  return error as HttpError;
}

Deno.test("telegram update claim accepts a newly claimed update", () => {
  const result = assertTelegramUpdateClaimResult({
    claimed: true,
    status: "claimed",
  });

  assertEquals(result.claimed, true);
  assertEquals(result.status, "claimed");
  assertEquals(shouldProcessTelegramUpdateClaim(result), true);
});

Deno.test("telegram update claim accepts a duplicate as a no-op decision", () => {
  const result = assertTelegramUpdateClaimResult({
    claimed: false,
    status: "duplicate",
  });

  assertEquals(result.claimed, false);
  assertEquals(result.status, "duplicate");
  assertEquals(shouldProcessTelegramUpdateClaim(result), false);
});

Deno.test("telegram update claim rejects inconsistent states", () => {
  assertThrowsServerError(() =>
    assertTelegramUpdateClaimResult({
      claimed: true,
      status: "duplicate",
    })
  );
  assertThrowsServerError(() =>
    assertTelegramUpdateClaimResult({
      claimed: false,
      status: "claimed",
    })
  );
});

Deno.test("telegram update claim rejects malformed values", () => {
  for (
    const value of [
      null,
      undefined,
      [],
      "claimed",
      { claimed: true },
      { status: "duplicate" },
      { claimed: "true", status: "claimed" },
    ]
  ) {
    assertThrowsServerError(() => assertTelegramUpdateClaimResult(value));
  }
});

Deno.test("telegram update claim rejects extra raw result details", () => {
  const rawError = "database secret raw detail";
  const error = assertThrowsServerError(() =>
    assertTelegramUpdateClaimResult({
      claimed: true,
      status: "claimed",
      error: rawError,
    })
  );

  assert(!error.message.includes(rawError), "Error must hide raw details.");
});

Deno.test("telegram update claim sanitizer never returns raw errors", () => {
  const rawError = "rpc failed with private table details";
  const error = sanitizeTelegramUpdateClaimError(new Error(rawError));

  assertEquals(error.statusCode, 500);
  assertEquals(error.code, "server_error");
  assertEquals(error.message, "Telegram update claim validation failed.");
  assert(!error.message.includes(rawError), "Error must hide raw details.");
});

Deno.test("telegram update claim sanitizes errors thrown by input objects", () => {
  const rawError = "private proxy detail";
  const value = new Proxy({}, {
    ownKeys() {
      throw new HttpError(418, "raw_error", rawError);
    },
  });
  const error = assertThrowsServerError(() =>
    assertTelegramUpdateClaimResult(value)
  );

  assert(!error.message.includes(rawError), "Error must hide raw details.");
});
