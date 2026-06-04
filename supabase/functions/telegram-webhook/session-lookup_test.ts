import {
  hashTelegramWebhookSecretHeader,
  HttpError,
  lookupTelegramWebhookSessionBySecretHeader,
  type TelegramWebhookSessionLookupRpcClient,
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
  action: () => Promise<unknown>,
  expectedStatusCode: number,
  expectedCode: string,
) {
  let error: unknown;

  try {
    await action();
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof HttpError, "Expected action to reject HttpError.");
  assertEquals((error as HttpError).statusCode, expectedStatusCode);
  assertEquals((error as HttpError).code, expectedCode);

  return error as HttpError;
}

const testWebhookSecretHeader = "test-webhook-secret";
const testWebhookSecretHash =
  "d4d0f3c54b0f3c0b500bf62607b52f14d91882a1fa855c210f36e649cc32430c";

const activeLookupRow = {
  session_id: "telegram-session-1",
  agent_id: "agent-1",
  workspace_id: "workspace-1",
  owner_user_id: "owner-1",
  bot_handle: "@kyra_test_bot",
  webhook_status: "active",
};

Deno.test("telegram webhook session lookup hashes secret header as lowercase sha256 hex", async () => {
  assertEquals(
    await hashTelegramWebhookSecretHeader(testWebhookSecretHeader),
    testWebhookSecretHash,
  );
});

Deno.test("telegram webhook session lookup rejects missing or blank secret headers", async () => {
  const missing = await assertRejectsHttpError(
    () => hashTelegramWebhookSecretHeader(null),
    401,
    "webhook_verification_failed",
  );
  const blank = await assertRejectsHttpError(
    () => hashTelegramWebhookSecretHeader("   "),
    401,
    "webhook_verification_failed",
  );

  assertEquals(missing.message, "Telegram webhook verification failed.");
  assertEquals(blank.message, "Telegram webhook verification failed.");
});

Deno.test("telegram webhook session lookup calls only exact RPC with hashed header", async () => {
  const capturedCalls: {
    functionName: string;
    args: { p_webhook_secret_hash: string };
  }[] = [];

  const rpcClient: TelegramWebhookSessionLookupRpcClient = {
    rpc(functionName, args) {
      capturedCalls.push({ functionName, args });

      return { data: [activeLookupRow] };
    },
  };

  const session = await lookupTelegramWebhookSessionBySecretHeader({
    webhookSecretHeader: testWebhookSecretHeader,
    rpcClient,
  });

  assertEquals(capturedCalls.length, 1);
  assertEquals(
    capturedCalls[0].functionName,
    "resolve_telegram_webhook_session",
  );
  assertEquals(
    capturedCalls[0].args.p_webhook_secret_hash,
    testWebhookSecretHash,
  );
  assertEquals(
    Object.keys(capturedCalls[0].args).join(","),
    "p_webhook_secret_hash",
  );
  assertEquals(session.sessionId, "telegram-session-1");
  assertEquals(session.agentId, "agent-1");

  const serializedSession = JSON.stringify(session);
  assert(
    !serializedSession.includes(testWebhookSecretHeader),
    "Session result must not expose raw webhook secret header.",
  );
  assert(
    !serializedSession.includes(testWebhookSecretHash),
    "Session result must not expose webhook secret hash.",
  );
});

Deno.test("telegram webhook session lookup maps missing rows to sanitized not found", async () => {
  const error = await assertRejectsHttpError(
    () =>
      lookupTelegramWebhookSessionBySecretHeader({
        webhookSecretHeader: testWebhookSecretHeader,
        rpcClient: {
          rpc() {
            return { data: [] };
          },
        },
      }),
    404,
    "session_not_found",
  );

  assertEquals(error.message, "Telegram webhook session was not found.");
});

Deno.test("telegram webhook session lookup sanitizes rpc failures", async () => {
  const error = await assertRejectsHttpError(
    () =>
      lookupTelegramWebhookSessionBySecretHeader({
        webhookSecretHeader: testWebhookSecretHeader,
        rpcClient: {
          rpc() {
            throw new Error(
              `raw failure ${testWebhookSecretHeader} ${testWebhookSecretHash} owner-1 workspace-1 token_secret_ref`,
            );
          },
        },
      }),
    500,
    "server_error",
  );

  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
  });

  assertEquals(error.message, "Telegram webhook session lookup failed.");
  assert(
    !serialized.includes(testWebhookSecretHeader),
    "RPC errors must not expose raw webhook secret header.",
  );
  assert(
    !serialized.includes(testWebhookSecretHash),
    "RPC errors must not expose webhook secret hash.",
  );
  assert(
    !serialized.includes("token_secret_ref"),
    "RPC errors must not expose token refs.",
  );
});

Deno.test("telegram webhook session lookup sanitizes duplicate rows", async () => {
  const error = await assertRejectsHttpError(
    () =>
      lookupTelegramWebhookSessionBySecretHeader({
        webhookSecretHeader: testWebhookSecretHeader,
        rpcClient: {
          rpc() {
            return { data: [activeLookupRow, activeLookupRow] };
          },
        },
      }),
    500,
    "server_error",
  );

  assertEquals(error.message, "Telegram webhook session lookup failed.");
});

Deno.test("telegram webhook session lookup sanitizes invalid row shape", async () => {
  const error = await assertRejectsHttpError(
    () =>
      lookupTelegramWebhookSessionBySecretHeader({
        webhookSecretHeader: testWebhookSecretHeader,
        rpcClient: {
          rpc() {
            return {
              data: [{
                ...activeLookupRow,
                owner_user_id: testWebhookSecretHash,
                workspace_id: "",
              }],
            };
          },
        },
      }),
    500,
    "server_error",
  );

  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
  });

  assertEquals(error.message, "Telegram webhook session lookup failed.");
  assert(
    !serialized.includes(testWebhookSecretHash),
    "Invalid row errors must not expose webhook secret hash.",
  );
});
