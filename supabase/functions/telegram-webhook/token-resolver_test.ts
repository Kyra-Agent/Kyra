import { HttpError } from "./core.ts";
import {
  assertResolvedTelegramDeliveryBotToken,
  assertTelegramDeliveryTokenResolverRpcResult,
  resolveTelegramDeliveryBotToken,
  sanitizeTelegramDeliveryTokenResolverError,
  sanitizeTelegramDeliveryTokenResolverRpcError,
  type TelegramDeliveryTokenResolverRpcClient,
} from "./token-resolver.ts";

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

const testTelegramSessionId = "11111111-1111-4111-8111-111111111111";
const testBotToken = "123456789:abcdefghijklmnopqrstuvwxyzABCDE";

Deno.test("telegram delivery token resolver calls exact RPC with bounded session id", async () => {
  const calls: Array<{
    functionName: string;
    args: Record<string, unknown>;
  }> = [];
  const rpcClient: TelegramDeliveryTokenResolverRpcClient = {
    rpc(functionName, args) {
      calls.push({ functionName, args });
      return { data: testBotToken, error: null };
    },
  };

  const result = await resolveTelegramDeliveryBotToken({
    telegramSessionId: testTelegramSessionId,
    rpcClient,
  });

  assertEquals(result.botToken, testBotToken);
  assertEquals(calls.length, 1);
  assertEquals(calls[0]?.functionName, "resolve_telegram_delivery_token");
  assertEquals(calls[0]?.args.p_telegram_session_id, testTelegramSessionId);
  assertEquals(
    Object.keys(calls[0]?.args ?? {}).join(","),
    "p_telegram_session_id",
  );

  const serialized = JSON.stringify(result);

  assert(!serialized.includes("token_secret_ref"), "Result must hide token refs.");
});

Deno.test("telegram delivery token resolver rejects invalid session id before RPC", async () => {
  let rpcCalled = false;

  const error = await assertRejectsHttpError(
    () =>
      resolveTelegramDeliveryBotToken({
        telegramSessionId: "telegram-session-1",
        rpcClient: {
          rpc() {
            rpcCalled = true;
            return { data: testBotToken, error: null };
          },
        },
      }),
    500,
    "server_error",
  );

  const serialized = JSON.stringify(error);

  assert(!rpcCalled, "Invalid session id must not call RPC.");
  assertEquals(error.message, "Telegram delivery token resolution failed.");
  assert(
    !serialized.includes("telegram-session-1"),
    "Error must hide session id.",
  );
});

Deno.test("telegram delivery token resolver sanitizes RPC errors", async () => {
  const rawDetails =
    `${testBotToken} token_secret_ref owner_user_id workspace_id`;
  const error = await assertRejectsHttpError(
    () =>
      resolveTelegramDeliveryBotToken({
        telegramSessionId: testTelegramSessionId,
        rpcClient: {
          rpc() {
            return { data: null, error: { message: rawDetails } };
          },
        },
      }),
    503,
    "telegram_unavailable",
  );

  const serialized = JSON.stringify(error);

  assertEquals(error.message, "Telegram delivery token is unavailable.");
  assert(!serialized.includes(testBotToken), "Error must hide raw token.");
  assert(!serialized.includes("token_secret_ref"), "Error must hide token refs.");
  assert(!serialized.includes("owner_user_id"), "Error must hide owner data.");
});

Deno.test("telegram delivery token resolver sanitizes thrown RPC errors", async () => {
  const error = await assertRejectsHttpError(
    () =>
      resolveTelegramDeliveryBotToken({
        telegramSessionId: testTelegramSessionId,
        rpcClient: {
          rpc() {
            throw new Error(
              `${testBotToken} ${testTelegramSessionId} token_secret_ref`,
            );
          },
        },
      }),
    500,
    "server_error",
  );

  const serialized = JSON.stringify(error);

  assertEquals(error.message, "Telegram delivery token resolution failed.");
  assert(!serialized.includes(testBotToken), "Error must hide raw token.");
  assert(
    !serialized.includes(testTelegramSessionId),
    "Error must hide session id.",
  );
  assert(!serialized.includes("token_secret_ref"), "Error must hide token refs.");
});

Deno.test("telegram delivery token resolver sanitizes invalid token responses", async () => {
  for (
    const data of [
      null,
      "",
      "not-a-token",
      [],
      { botToken: testBotToken },
    ]
  ) {
    const error = await assertRejectsHttpError(
      () =>
        assertTelegramDeliveryTokenResolverRpcResult({
          data,
          error: null,
        }),
      503,
      "telegram_unavailable",
    );

    assertEquals(error.message, "Telegram delivery token is unavailable.");
  }
});

Deno.test("telegram delivery token resolver accepts only a raw token result", () => {
  const result = assertResolvedTelegramDeliveryBotToken(testBotToken);

  assertEquals(result.botToken, testBotToken);
  assertEquals(Object.keys(result).join(","), "botToken");
});

Deno.test("telegram delivery token resolver sanitizers return fixed errors", () => {
  const rawDetails = `${testBotToken} token_secret_ref owner_user_id`;
  const runtimeError = sanitizeTelegramDeliveryTokenResolverError(
    new Error(rawDetails),
  );
  const rpcError = sanitizeTelegramDeliveryTokenResolverRpcError(
    new Error(rawDetails),
  );
  const serialized = JSON.stringify({ runtimeError, rpcError });

  assertEquals(runtimeError.statusCode, 500);
  assertEquals(runtimeError.code, "server_error");
  assertEquals(
    runtimeError.message,
    "Telegram delivery token resolution failed.",
  );
  assertEquals(rpcError.statusCode, 503);
  assertEquals(rpcError.code, "telegram_unavailable");
  assertEquals(rpcError.message, "Telegram delivery token is unavailable.");
  assert(!serialized.includes(testBotToken), "Errors must hide raw token.");
  assert(!serialized.includes("token_secret_ref"), "Errors must hide token refs.");
});
