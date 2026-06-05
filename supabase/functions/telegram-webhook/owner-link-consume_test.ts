import { HttpError } from "./core.ts";
import {
  assertTelegramOwnerLinkConsumeRow,
  assertTelegramOwnerLinkConsumeRpcResult,
  consumeTelegramOwnerLinkChallenge,
  sanitizeTelegramOwnerLinkConsumeError,
  type TelegramOwnerLinkConsumeRpcClient,
} from "./owner-link-consume.ts";

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

const telegramSessionId = "22222222-2222-4222-8222-222222222222";
const telegramUpdateId = 9001;
const telegramUserId = "123456789";
const challengeHash = "cd".repeat(32);

Deno.test("owner-link consume adapter calls exact RPC with bounded hash-only args", async () => {
  const calls: Array<{
    functionName: string;
    args: Record<string, unknown>;
  }> = [];
  const rpcClient: TelegramOwnerLinkConsumeRpcClient = {
    rpc(functionName, args) {
      calls.push({ functionName, args });
      return { data: [{ linked: true, status: "linked" }], error: null };
    },
  };

  const result = await consumeTelegramOwnerLinkChallenge({
    telegramSessionId,
    telegramUpdateId: String(telegramUpdateId),
    telegramUserId,
    telegramChatId: telegramUserId,
    challengeHash,
    rpcClient,
  });
  const serialized = JSON.stringify(result);

  assertEquals(calls.length, 1);
  assertEquals(calls[0]?.functionName, "consume_telegram_owner_link_challenge");
  assertEquals(calls[0]?.args.p_telegram_session_id, telegramSessionId);
  assertEquals(calls[0]?.args.p_telegram_update_id, telegramUpdateId);
  assertEquals(calls[0]?.args.p_telegram_user_id, telegramUserId);
  assertEquals(calls[0]?.args.p_telegram_chat_id, telegramUserId);
  assertEquals(calls[0]?.args.p_challenge_hash, challengeHash);
  assertEquals(result.linked, true);
  assertEquals(result.status, "linked");
  assert(!serialized.includes(telegramUserId), "Result must hide Telegram id.");
  assert(
    !serialized.includes(challengeHash),
    "Result must hide challenge hash.",
  );
});

Deno.test("owner-link consume adapter maps duplicate and empty rows to no-op", async () => {
  const duplicate = assertTelegramOwnerLinkConsumeRpcResult({
    data: [{ linked: false, status: "duplicate" }],
    error: null,
  });
  const missing = assertTelegramOwnerLinkConsumeRpcResult({
    data: [],
    error: null,
  });

  assertEquals(duplicate.linked, false);
  assertEquals(duplicate.status, "duplicate");
  assertEquals(missing.linked, false);
  assertEquals(missing.status, "not_linked");
});

Deno.test("owner-link consume adapter rejects unsafe identities and inputs before RPC", async () => {
  for (
    const override of [
      { telegramSessionId: "invalid" },
      { telegramUpdateId: "-1" },
      { telegramUserId: "0123" },
      { telegramChatId: "987654321" },
      { challengeHash: challengeHash.toUpperCase() },
    ]
  ) {
    let rpcCalled = false;
    const error = await captureError(() =>
      consumeTelegramOwnerLinkChallenge({
        telegramSessionId,
        telegramUpdateId,
        telegramUserId,
        telegramChatId: telegramUserId,
        challengeHash,
        ...override,
        rpcClient: {
          rpc() {
            rpcCalled = true;
            return { data: [], error: null };
          },
        },
      })
    );

    assert(error instanceof HttpError, "Expected HttpError.");
    assertEquals((error as HttpError).statusCode, 400);
    assertEquals((error as HttpError).code, "invalid_update");
    assert(!rpcCalled, "Invalid input must not call RPC.");
  }
});

Deno.test("owner-link consume adapter rejects malformed, duplicate, and extra-field rows", async () => {
  for (
    const data of [
      null,
      {},
      [{ linked: true, status: "linked" }, {
        linked: false,
        status: "duplicate",
      }],
      [{ linked: true, status: "linked", agent_id: "private" }],
      [{ linked: false, status: "linked" }],
    ]
  ) {
    const error = await captureError(() =>
      assertTelegramOwnerLinkConsumeRpcResult({ data, error: null })
    );

    assert(error instanceof HttpError, "Expected HttpError.");
    assertEquals((error as HttpError).statusCode, 500);
    assertEquals((error as HttpError).code, "server_error");
  }
});

Deno.test("owner-link consume adapter sanitizes RPC and thrown errors", async () => {
  const raw =
    `owner_user_id ${telegramUserId} workspace_id token_secret_ref ${challengeHash}`;

  for (
    const action of [
      () =>
        assertTelegramOwnerLinkConsumeRpcResult({
          data: null,
          error: { message: raw },
        }),
      () =>
        consumeTelegramOwnerLinkChallenge({
          telegramSessionId,
          telegramUpdateId,
          telegramUserId,
          telegramChatId: telegramUserId,
          challengeHash,
          rpcClient: {
            rpc() {
              throw new Error(raw);
            },
          },
        }),
    ]
  ) {
    const error = await captureError(action);
    const serialized = JSON.stringify(error);

    assert(error instanceof HttpError, "Expected HttpError.");
    assertEquals((error as HttpError).statusCode, 500);
    assertEquals((error as HttpError).code, "server_error");
    assert(
      !serialized.includes(telegramUserId),
      "Error must hide Telegram id.",
    );
    assert(!serialized.includes(challengeHash), "Error must hide hash.");
    assert(
      !serialized.includes("token_secret_ref"),
      "Error must hide token ref.",
    );
  }
});

Deno.test("owner-link consume row and sanitizer expose only fixed contracts", () => {
  const linked = assertTelegramOwnerLinkConsumeRow({
    linked: true,
    status: "linked",
  });
  const error = sanitizeTelegramOwnerLinkConsumeError(
    new Error(`raw ${telegramUserId} ${challengeHash}`),
  );
  const serialized = JSON.stringify(error);

  assertEquals(JSON.stringify(linked), '{"linked":true,"status":"linked"}');
  assertEquals(error.statusCode, 500);
  assertEquals(error.code, "server_error");
  assertEquals(error.message, "Telegram owner-link consume failed.");
  assert(!serialized.includes(telegramUserId), "Error must hide Telegram id.");
  assert(!serialized.includes(challengeHash), "Error must hide hash.");
});
