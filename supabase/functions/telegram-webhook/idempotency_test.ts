import { HttpError } from "./core.ts";
import {
  assertTelegramUpdateClaimRows,
  assertTelegramUpdateClaimRpcResult,
  assertTelegramUpdateClaimResult,
  claimTelegramUpdate,
  sanitizeTelegramUpdateClaimError,
  sanitizeTelegramUpdateClaimRpcError,
  shouldProcessTelegramUpdateClaim,
  type TelegramUpdateClaimRpcClient,
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

async function assertRejectsHttpError(
  action: () => Promise<unknown> | unknown,
  expectedStatusCode: number,
  expectedCode: string,
) {
  let error: unknown;

  try {
    await action();
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof HttpError, "Expected action to throw HttpError.");
  assertEquals((error as HttpError).statusCode, expectedStatusCode);
  assertEquals((error as HttpError).code, expectedCode);

  return error as HttpError;
}

const testTelegramSessionId = "11111111-1111-4111-8111-111111111111";

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

Deno.test("telegram update claim adapter calls exact RPC with bounded args", async () => {
  const calls: Array<{
    functionName: string;
    args: Record<string, unknown>;
  }> = [];
  const rpcClient: TelegramUpdateClaimRpcClient = {
    rpc(functionName, args) {
      calls.push({ functionName, args });
      return {
        data: [{ claimed: true, status: "claimed" }],
        error: null,
      };
    },
  };

  const result = await claimTelegramUpdate({
    telegramSessionId: testTelegramSessionId,
    telegramUpdateId: "9001",
    rpcClient,
  });

  assertEquals(result.claimed, true);
  assertEquals(result.status, "claimed");
  assertEquals(calls.length, 1);
  assertEquals(calls[0]?.functionName, "claim_telegram_update");
  assertEquals(calls[0]?.args.p_telegram_session_id, testTelegramSessionId);
  assertEquals(calls[0]?.args.p_telegram_update_id, 9001);
});

Deno.test("telegram update claim adapter maps duplicate rows to no-op result", async () => {
  const result = await claimTelegramUpdate({
    telegramSessionId: testTelegramSessionId,
    telegramUpdateId: 9001,
    rpcClient: {
      rpc: () => ({
        data: [{ claimed: false, status: "duplicate" }],
        error: null,
      }),
    },
  });

  assertEquals(result.claimed, false);
  assertEquals(result.status, "duplicate");
});

Deno.test("telegram update claim adapter maps empty rows to session not found", async () => {
  const error = await assertRejectsHttpError(
    () => assertTelegramUpdateClaimRows([]),
    404,
    "session_not_found",
  );

  assertEquals(error.message, "Telegram webhook session was not found.");
});

Deno.test("telegram update claim adapter sanitizes duplicate and non-array rows", async () => {
  const duplicateError = await assertRejectsHttpError(
    () =>
      assertTelegramUpdateClaimRows([
        { claimed: true, status: "claimed" },
        { claimed: false, status: "duplicate" },
      ]),
    500,
    "server_error",
  );

  assertEquals(duplicateError.message, "Telegram update claim failed.");

  const nonArrayError = await assertRejectsHttpError(
    () =>
      assertTelegramUpdateClaimRpcResult({
        data: { claimed: true, status: "claimed" },
        error: null,
      }),
    500,
    "server_error",
  );

  assertEquals(nonArrayError.message, "Telegram update claim failed.");
});

Deno.test("telegram update claim adapter sanitizes RPC errors and invalid rows", async () => {
  const rawDetails =
    "raw DB owner_user_id workspace-1 token_secret_ref webhook_secret_hash";
  const rpcError = await assertRejectsHttpError(
    () =>
      assertTelegramUpdateClaimRpcResult({
        data: null,
        error: { message: rawDetails },
      }),
    500,
    "server_error",
  );
  const serializedRpcError = JSON.stringify(rpcError);

  assertEquals(rpcError.message, "Telegram update claim failed.");
  assert(
    !serializedRpcError.includes("owner_user_id"),
    "RPC error must hide owner data.",
  );
  assert(
    !serializedRpcError.includes("token_secret_ref"),
    "RPC error must hide token refs.",
  );

  const invalidRowError = await assertRejectsHttpError(
    () =>
      assertTelegramUpdateClaimRows([
        { claimed: true, status: "claimed", raw: rawDetails },
      ]),
    500,
    "server_error",
  );

  assertEquals(
    invalidRowError.message,
    "Telegram update claim validation failed.",
  );
});

Deno.test("telegram update claim adapter sanitizes thrown RPC errors", async () => {
  const error = await assertRejectsHttpError(
    () =>
      claimTelegramUpdate({
        telegramSessionId: testTelegramSessionId,
        telegramUpdateId: 9001,
        rpcClient: {
          rpc: () => {
            throw new Error("raw update 9001 owner_user_id");
          },
        },
      }),
    500,
    "server_error",
  );
  const serialized = JSON.stringify(error);

  assertEquals(error.message, "Telegram update claim failed.");
  assert(!serialized.includes("9001"), "Error must hide update id.");
  assert(!serialized.includes("owner_user_id"), "Error must hide owner data.");
});

Deno.test("telegram update claim adapter rejects invalid update ids before RPC", async () => {
  let rpcCalled = false;

  await assertRejectsHttpError(
    () =>
      claimTelegramUpdate({
        telegramSessionId: testTelegramSessionId,
        telegramUpdateId: "-1",
        rpcClient: {
          rpc: () => {
            rpcCalled = true;
            return { data: [], error: null };
          },
        },
      }),
    400,
    "invalid_update",
  );

  assert(!rpcCalled, "Invalid update id must not call RPC.");
});

Deno.test("telegram update claim RPC sanitizer returns fixed error", () => {
  const error = sanitizeTelegramUpdateClaimRpcError(
    new Error("raw owner_user_id workspace-1 token_secret_ref"),
  );
  const serialized = JSON.stringify(error);

  assertEquals(error.statusCode, 500);
  assertEquals(error.code, "server_error");
  assertEquals(error.message, "Telegram update claim failed.");
  assert(!serialized.includes("owner_user_id"), "Error must hide owner data.");
  assert(!serialized.includes("token_secret_ref"), "Error must hide token refs.");
});
