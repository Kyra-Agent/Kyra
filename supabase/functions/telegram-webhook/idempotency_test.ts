import { HttpError } from "./core.ts";
import {
  assertTelegramUpdateClaimResult,
  assertTelegramUpdateClaimRows,
  assertTelegramUpdateClaimRpcResult,
  assertTelegramUpdateDeliveryMarkResult,
  assertTelegramUpdateDeliveryMarkRpcResult,
  claimTelegramUpdate,
  markTelegramUpdateDelivered,
  sanitizeTelegramUpdateClaimError,
  sanitizeTelegramUpdateClaimRpcError,
  sanitizeTelegramUpdateDeliveryMarkError,
  sanitizeTelegramUpdateDeliveryMarkRpcError,
  shouldProcessTelegramUpdateClaim,
  type TelegramUpdateClaimRpcClient,
  type TelegramUpdateDeliveryMarkRpcClient,
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
  assert(
    !serialized.includes("token_secret_ref"),
    "Error must hide token refs.",
  );
});

Deno.test("telegram delivery completion accepts delivered and duplicate states", () => {
  const delivered = assertTelegramUpdateDeliveryMarkResult({
    marked: true,
    status: "delivered",
  });
  const duplicate = assertTelegramUpdateDeliveryMarkResult({
    marked: false,
    status: "duplicate",
  });

  assertEquals(delivered.marked, true);
  assertEquals(delivered.status, "delivered");
  assertEquals(duplicate.marked, false);
  assertEquals(duplicate.status, "duplicate");
});

Deno.test("telegram delivery completion rejects inconsistent or extra states", async () => {
  const inconsistent = await assertRejectsHttpError(
    () =>
      assertTelegramUpdateDeliveryMarkResult({
        marked: false,
        status: "delivered",
      }),
    500,
    "server_error",
  );
  const extra = await assertRejectsHttpError(
    () =>
      assertTelegramUpdateDeliveryMarkResult({
        marked: true,
        status: "delivered",
        owner_user_id: "private",
      }),
    500,
    "server_error",
  );

  assertEquals(
    inconsistent.message,
    "Telegram delivery completion validation failed.",
  );
  assertEquals(
    extra.message,
    "Telegram delivery completion validation failed.",
  );
  assert(
    !JSON.stringify(extra).includes("owner_user_id"),
    "Validation error must hide owner data.",
  );
});

Deno.test("telegram delivery completion adapter calls exact RPC", async () => {
  const calls: Array<{
    functionName: string;
    args: Record<string, unknown>;
  }> = [];
  const rpcClient: TelegramUpdateDeliveryMarkRpcClient = {
    rpc(functionName, args) {
      calls.push({ functionName, args });
      return {
        data: [{ marked: true, status: "delivered" }],
        error: null,
      };
    },
  };

  const result = await markTelegramUpdateDelivered({
    telegramSessionId: testTelegramSessionId,
    telegramUpdateId: "9001",
    rpcClient,
  });

  assertEquals(result.marked, true);
  assertEquals(result.status, "delivered");
  assertEquals(calls.length, 1);
  assertEquals(calls[0]?.functionName, "mark_telegram_update_delivered");
  assertEquals(calls[0]?.args.p_telegram_session_id, testTelegramSessionId);
  assertEquals(calls[0]?.args.p_telegram_update_id, 9001);
});

Deno.test("telegram delivery completion sanitizes malformed RPC results", async () => {
  const rowError = await assertRejectsHttpError(
    () =>
      assertTelegramUpdateDeliveryMarkRpcResult({
        data: [],
        error: null,
      }),
    500,
    "server_error",
  );
  const rpcError = await assertRejectsHttpError(
    () =>
      assertTelegramUpdateDeliveryMarkRpcResult({
        data: null,
        error: { message: "raw owner_user_id token_secret_ref" },
      }),
    500,
    "server_error",
  );

  assertEquals(rowError.message, "Telegram delivery completion failed.");
  assertEquals(rpcError.message, "Telegram delivery completion failed.");
  assert(
    !JSON.stringify(rpcError).includes("owner_user_id"),
    "RPC error must hide owner data.",
  );
});

Deno.test("telegram delivery completion sanitizers return fixed errors", () => {
  const validationError = sanitizeTelegramUpdateDeliveryMarkError(
    new Error("raw validation detail"),
  );
  const rpcError = sanitizeTelegramUpdateDeliveryMarkRpcError(
    new Error("raw rpc detail"),
  );

  assertEquals(
    validationError.message,
    "Telegram delivery completion validation failed.",
  );
  assertEquals(rpcError.message, "Telegram delivery completion failed.");
});

Deno.test("telegram delivery completion sanitizes thrown RPC errors", async () => {
  const error = await assertRejectsHttpError(
    () =>
      markTelegramUpdateDelivered({
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

  assertEquals(error.message, "Telegram delivery completion failed.");
  assert(
    !JSON.stringify(error).includes("9001"),
    "Thrown RPC error must hide update id.",
  );
});
