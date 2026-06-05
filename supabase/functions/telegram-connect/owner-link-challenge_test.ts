import { HttpError } from "./core.ts";
import {
  assertTelegramOwnerLinkIssueRow,
  assertTelegramOwnerLinkIssueRpcResult,
  issueTelegramOwnerLinkChallenge,
  sanitizeTelegramOwnerLinkIssueError,
  type TelegramOwnerLinkIssueRpcClient,
} from "./owner-link-challenge.ts";

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

const agentId = "11111111-1111-4111-8111-111111111111";
const telegramSessionId = "22222222-2222-4222-8222-222222222222";
const ownerUserId = "33333333-3333-4333-8333-333333333333";
const challengeHash = "ab".repeat(32);
const nowMs = Date.UTC(2026, 5, 5, 0, 0, 0);
const expiresAt = new Date(nowMs + 10 * 60 * 1000).toISOString();

Deno.test("owner-link issue adapter calls exact RPC with hash-only bounded args", async () => {
  const calls: Array<{
    functionName: string;
    args: Record<string, unknown>;
  }> = [];
  const rpcClient: TelegramOwnerLinkIssueRpcClient = {
    rpc(functionName, args) {
      calls.push({ functionName, args });
      return { data: [{ issued: true, status: "issued" }], error: null };
    },
  };

  const result = await issueTelegramOwnerLinkChallenge({
    agentId,
    telegramSessionId,
    issuedByUserId: ownerUserId,
    challengeHash,
    expiresAt,
    nowMs,
    rpcClient,
  });
  const serialized = JSON.stringify(result);

  assertEquals(calls.length, 1);
  assertEquals(calls[0]?.functionName, "issue_telegram_owner_link_challenge");
  assertEquals(calls[0]?.args.p_agent_id, agentId);
  assertEquals(calls[0]?.args.p_telegram_session_id, telegramSessionId);
  assertEquals(calls[0]?.args.p_issued_by_user_id, ownerUserId);
  assertEquals(calls[0]?.args.p_challenge_hash, challengeHash);
  assertEquals(calls[0]?.args.p_expires_at, expiresAt);
  assertEquals(result.issued, true);
  assertEquals(result.status, "issued");
  assert(!serialized.includes(agentId), "Result must not expose agent id.");
  assert(!serialized.includes(ownerUserId), "Result must not expose owner id.");
  assert(!serialized.includes(challengeHash), "Result must not expose hash.");
});

Deno.test("owner-link issue adapter rejects invalid input before RPC", async () => {
  let rpcCalled = false;
  const error = await captureError(() =>
    issueTelegramOwnerLinkChallenge({
      agentId: "invalid",
      telegramSessionId,
      issuedByUserId: ownerUserId,
      challengeHash,
      expiresAt,
      nowMs,
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
  assertEquals((error as HttpError).code, "invalid_owner_link");
  assert(!rpcCalled, "Invalid input must not call RPC.");
});

Deno.test("owner-link issue adapter maps empty rows to bounded unavailable error", async () => {
  const error = await captureError(() =>
    issueTelegramOwnerLinkChallenge({
      agentId,
      telegramSessionId,
      issuedByUserId: ownerUserId,
      challengeHash,
      expiresAt,
      nowMs,
      rpcClient: { rpc: () => ({ data: [], error: null }) },
    })
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "Expected HttpError.");
  assertEquals((error as HttpError).statusCode, 409);
  assertEquals((error as HttpError).code, "owner_link_unavailable");
  assert(!serialized.includes(agentId), "Error must hide agent id.");
  assert(!serialized.includes(ownerUserId), "Error must hide owner id.");
  assert(
    !serialized.includes(challengeHash),
    "Error must hide challenge hash.",
  );
});

Deno.test("owner-link issue adapter rejects malformed, duplicate, and extra-field rows", async () => {
  for (
    const data of [
      null,
      {},
      [{ issued: true, status: "issued" }, { issued: true, status: "issued" }],
      [{ issued: true, status: "issued", agent_id: agentId }],
      [{ issued: false, status: "issued" }],
    ]
  ) {
    const error = await captureError(() =>
      assertTelegramOwnerLinkIssueRpcResult({ data, error: null })
    );

    assert(error instanceof HttpError, "Expected HttpError.");
    assertEquals((error as HttpError).statusCode, 500);
    assertEquals((error as HttpError).code, "server_error");
  }
});

Deno.test("owner-link issue adapter sanitizes RPC and thrown errors", async () => {
  const raw = `owner_user_id ${ownerUserId} challenge_hash ${challengeHash}`;

  for (
    const action of [
      () =>
        assertTelegramOwnerLinkIssueRpcResult({
          data: null,
          error: { message: raw },
        }),
      () =>
        issueTelegramOwnerLinkChallenge({
          agentId,
          telegramSessionId,
          issuedByUserId: ownerUserId,
          challengeHash,
          expiresAt,
          nowMs,
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
    assert(!serialized.includes(ownerUserId), "Error must hide owner id.");
    assert(!serialized.includes(challengeHash), "Error must hide hash.");
  }
});

Deno.test("owner-link issue row and sanitizer expose only fixed result contracts", () => {
  const result = assertTelegramOwnerLinkIssueRow({
    issued: true,
    status: "issued",
  });
  const error = sanitizeTelegramOwnerLinkIssueError(
    new Error(`raw ${ownerUserId} ${challengeHash}`),
  );
  const serialized = JSON.stringify(error);

  assertEquals(JSON.stringify(result), '{"issued":true,"status":"issued"}');
  assertEquals(error.statusCode, 500);
  assertEquals(error.code, "server_error");
  assertEquals(error.message, "Telegram owner-link challenge issue failed.");
  assert(!serialized.includes(ownerUserId), "Error must hide owner id.");
  assert(!serialized.includes(challengeHash), "Error must hide hash.");
});
