import {
  assertTelegramChatAuthorizationLookupResult,
  assertTelegramChatAuthorizationLookupRows,
  HttpError,
  lookupTelegramChatAuthorization,
  sanitizeTelegramChatAuthorizationLookupError,
  type TelegramChatAuthorizationLookupRpcClient,
} from "./index.ts";

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

const testAgentId = "11111111-1111-4111-8111-111111111111";
const testTelegramUserId = "123456";
const testTelegramChatId = "-987654";

Deno.test("telegram chat authorization lookup calls exact RPC with bounded args", async () => {
  const calls: Array<{
    functionName: string;
    args: Record<string, unknown>;
  }> = [];
  const rpcClient: TelegramChatAuthorizationLookupRpcClient = {
    rpc(functionName, args) {
      calls.push({ functionName, args });
      return {
        data: [{ authorized: true, role: "owner" }],
        error: null,
      };
    },
  };

  const authorization = await lookupTelegramChatAuthorization({
    agentId: testAgentId,
    telegramUserId: testTelegramUserId,
    telegramChatId: testTelegramChatId,
    commandKind: "read_only",
    rpcClient,
  });

  assertEquals(authorization.authorized, true);
  assertEquals(authorization.role, "owner");
  assertEquals(calls.length, 1);
  assertEquals(calls[0]?.functionName, "resolve_telegram_chat_authorization");
  assertEquals(calls[0]?.args.p_agent_id, testAgentId);
  assertEquals(calls[0]?.args.p_telegram_user_id, testTelegramUserId);
  assertEquals(calls[0]?.args.p_telegram_chat_id, testTelegramChatId);
  assertEquals(calls[0]?.args.p_command_kind, "read_only");
});

Deno.test("telegram chat authorization lookup maps missing rows to unauthorized", async () => {
  await assertRejectsHttpError(
    () =>
      lookupTelegramChatAuthorization({
        agentId: testAgentId,
        telegramUserId: testTelegramUserId,
        telegramChatId: testTelegramChatId,
        commandKind: "read_only",
        rpcClient: {
          rpc: () => ({ data: [], error: null }),
        },
      }),
    403,
    "chat_not_authorized",
  );

  await assertRejectsHttpError(
    () =>
      lookupTelegramChatAuthorization({
        agentId: testAgentId,
        telegramUserId: testTelegramUserId,
        telegramChatId: testTelegramChatId,
        commandKind: "read_only",
        rpcClient: {
          rpc: () => ({ data: null, error: null }),
        },
      }),
    403,
    "chat_not_authorized",
  );
});

Deno.test("telegram chat authorization lookup maps false authorization to unauthorized", async () => {
  await assertRejectsHttpError(
    () =>
      assertTelegramChatAuthorizationLookupRows([
        { authorized: false, role: "owner" },
      ]),
    403,
    "chat_not_authorized",
  );
});

Deno.test("telegram chat authorization lookup sanitizes duplicate rows", async () => {
  const error = await assertRejectsHttpError(
    () =>
      assertTelegramChatAuthorizationLookupRows([
        { authorized: true, role: "owner" },
        { authorized: true, role: "owner" },
      ]),
    500,
    "server_error",
  );

  assertEquals(error.message, "Telegram chat authorization lookup failed.");
});

Deno.test("telegram chat authorization lookup sanitizes invalid row shape", async () => {
  const rawUserId = "123456";
  const rawChatId = "-987654";
  const error = await assertRejectsHttpError(
    () =>
      assertTelegramChatAuthorizationLookupResult({
        data: [
          {
            authorized: true,
            role: `admin-${rawUserId}-${rawChatId}`,
          },
        ],
      }),
    500,
    "server_error",
  );
  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
  });

  assertEquals(error.message, "Telegram chat authorization lookup failed.");
  assert(!serialized.includes(rawUserId), "Error must not expose user id.");
  assert(!serialized.includes(rawChatId), "Error must not expose chat id.");
});

Deno.test("telegram chat authorization lookup sanitizes non-array data and RPC errors", async () => {
  await assertRejectsHttpError(
    () =>
      assertTelegramChatAuthorizationLookupResult({
        data: { authorized: true, role: "owner" },
      }),
    500,
    "server_error",
  );

  const rawDetails =
    "raw DB owner_user_id workspace-1 token_secret_ref webhook_secret_hash";
  const error = await assertRejectsHttpError(
    () =>
      assertTelegramChatAuthorizationLookupResult({
        data: null,
        error: { message: rawDetails },
      }),
    500,
    "server_error",
  );
  const serialized = JSON.stringify(error);

  assertEquals(error.message, "Telegram chat authorization lookup failed.");
  assert(!serialized.includes("owner_user_id"), "Error must hide owner data.");
  assert(!serialized.includes("token_secret_ref"), "Error must hide token refs.");
  assert(
    !serialized.includes("webhook_secret_hash"),
    "Error must hide webhook hashes.",
  );
});

Deno.test("telegram chat authorization lookup sanitizes thrown RPC errors", async () => {
  const error = await assertRejectsHttpError(
    () =>
      lookupTelegramChatAuthorization({
        agentId: testAgentId,
        telegramUserId: testTelegramUserId,
        telegramChatId: testTelegramChatId,
        commandKind: "read_only",
        rpcClient: {
          rpc: () => {
            throw new Error("raw chat id -987654 owner_user_id");
          },
        },
      }),
    500,
    "server_error",
  );
  const serialized = JSON.stringify(error);

  assertEquals(error.message, "Telegram chat authorization lookup failed.");
  assert(!serialized.includes("-987654"), "Error must hide chat id.");
  assert(!serialized.includes("owner_user_id"), "Error must hide owner data.");
});

Deno.test("telegram chat authorization lookup rejects invalid command kind before RPC", async () => {
  let rpcCalled = false;

  await assertRejectsHttpError(
    () =>
      lookupTelegramChatAuthorization({
        agentId: testAgentId,
        telegramUserId: testTelegramUserId,
        telegramChatId: testTelegramChatId,
        commandKind: "admin",
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

  assert(!rpcCalled, "Invalid command kind must not call RPC.");
});

Deno.test("telegram chat authorization lookup sanitizer returns fixed error", () => {
  const error = sanitizeTelegramChatAuthorizationLookupError(
    new Error("raw owner_user_id workspace-1 token_secret_ref"),
  );
  const serialized = JSON.stringify(error);

  assertEquals(error.statusCode, 500);
  assertEquals(error.code, "server_error");
  assertEquals(error.message, "Telegram chat authorization lookup failed.");
  assert(!serialized.includes("owner_user_id"), "Error must hide owner data.");
  assert(!serialized.includes("token_secret_ref"), "Error must hide token refs.");
});
