import {
  assertExistingScope,
  assertStoredTransactionIntent,
  assertTransactionResultCloseoutBody,
  canTransitionExecutionResult,
  deriveVerifiedResult,
  HttpError,
  isStaleSubmittedResult,
} from "./core.ts";
import {
  ownerTransactionPolicyVersion,
  ownerTransactionValueWei,
} from "../_shared/owner-transaction-policy.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrowsCode(run: () => unknown, code: string) {
  try {
    run();
  } catch (error) {
    assert(error instanceof HttpError, "expected HttpError");
    assert(
      error.code === code,
      "expected " + code + ", received " + error.code,
    );
    return;
  }
  throw new Error("expected function to throw");
}

const validBody = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  agentId: "22222222-2222-4222-8222-222222222222",
  preparedActionId: "phase8-agent-1",
  txHash: "0x" + "a".repeat(64),
};

Deno.test("closeout accepts only sanitized owner-scoped transaction references", () => {
  const result = assertTransactionResultCloseoutBody(validBody);
  assert(result.txHash === validBody.txHash, "hash must be normalized");
});

Deno.test("closeout rejects malformed references and client-authored result state", () => {
  assertThrowsCode(
    () =>
      assertTransactionResultCloseoutBody({ ...validBody, txHash: "secret" }),
    "transaction_hash_required",
  );
  assertThrowsCode(
    () =>
      assertTransactionResultCloseoutBody({
        ...validBody,
        status: "confirmed",
      }),
    "invalid_body",
  );
  assertThrowsCode(
    () =>
      assertTransactionResultCloseoutBody({
        ...validBody,
        failureCode: "raw_provider_error",
      }),
    "invalid_body",
  );
});

Deno.test("stored intent is immutable, owner-scoped, and unexpired", () => {
  const stored = {
    id: "44444444-4444-4444-8444-444444444444",
    workspace_id: validBody.workspaceId,
    agent_id: validBody.agentId,
    request_id: validBody.preparedActionId,
    action_kind: "robinhood_reviewed_transaction" as const,
    chain_key: "robinhood_mainnet" as const,
    chain_id: 4663 as const,
    status: "approved" as const,
    sender_address: "0x1111111111111111111111111111111111111111",
    recipient: "0x1111111111111111111111111111111111111111",
    asset_kind: "native" as const,
    token_address: null,
    token_symbol: "ETH" as const,
    token_decimals: 18 as const,
    amount_atomic: ownerTransactionValueWei,
    value_wei: ownerTransactionValueWei,
    calldata: "0x" as const,
    policy_version: ownerTransactionPolicyVersion,
    expires_at: "2026-07-26T13:00:00.000Z",
  };
  const result = assertStoredTransactionIntent(stored, {
    workspaceId: validBody.workspaceId,
    agentId: validBody.agentId,
    preparedActionId: validBody.preparedActionId,
  }, new Date("2026-07-26T12:00:00.000Z"));
  assert(result.id === stored.id, "matching prepared intent expected");
  assertThrowsCode(
    () =>
      assertStoredTransactionIntent({ ...stored, value_wei: "0" }, {
        workspaceId: validBody.workspaceId,
        agentId: validBody.agentId,
        preparedActionId: validBody.preparedActionId,
      }, new Date("2026-07-26T12:00:00.000Z")),
    "transaction_intent_invalid",
  );
  assertThrowsCode(
    () =>
      assertStoredTransactionIntent({ ...stored, policy_version: 1 }, {
        workspaceId: validBody.workspaceId,
        agentId: validBody.agentId,
        preparedActionId: validBody.preparedActionId,
      }, new Date("2026-07-26T12:00:00.000Z")),
    "transaction_intent_invalid",
  );
  assertThrowsCode(
    () =>
      assertStoredTransactionIntent(stored, {
        workspaceId: validBody.workspaceId,
        agentId: validBody.agentId,
        preparedActionId: validBody.preparedActionId,
      }, new Date("2026-07-26T14:00:00.000Z")),
    "transaction_intent_invalid",
  );
  const existingResultIntent = assertStoredTransactionIntent(
    stored,
    {
      workspaceId: validBody.workspaceId,
      agentId: validBody.agentId,
      preparedActionId: validBody.preparedActionId,
    },
    new Date("2026-07-26T14:00:00.000Z"),
    true,
  );
  assert(
    existingResultIntent.id === stored.id,
    "expired intent may refresh only an already-persisted result",
  );
});

Deno.test("receipt status is derived from chain data", () => {
  const confirmed = deriveVerifiedResult(
    { status: "0x1", blockNumber: "0x2a" },
    "2026-07-26T12:00:00.000Z",
  );
  assert(
    confirmed.status === "confirmed" && confirmed.blockNumber === 42,
    "confirmation expected",
  );
  const failed = deriveVerifiedResult({ status: "0x0", blockNumber: "0x2b" });
  assert(failed.status === "failed", "reverted transaction must fail");
  assert(
    failed.failureCode === "transaction_reverted",
    "sanitized server failure expected",
  );
  const submitted = deriveVerifiedResult(null);
  assert(
    submitted.status === "submitted" && submitted.blockNumber === null,
    "pending receipt expected",
  );
});

Deno.test("closeout status transitions are terminal", () => {
  assert(
    canTransitionExecutionResult("submitted", "confirmed"),
    "confirmation should pass",
  );
  assert(
    canTransitionExecutionResult("submitted", "failed"),
    "failure should pass",
  );
  assert(
    canTransitionExecutionResult("confirmed", "confirmed"),
    "idempotent confirm should pass",
  );
  assert(
    !canTransitionExecutionResult("confirmed", "failed"),
    "confirmed result cannot fail later",
  );
  assert(
    !canTransitionExecutionResult("failed", "confirmed"),
    "failed result cannot confirm later",
  );
  assert(
    isStaleSubmittedResult("confirmed", "submitted"),
    "late submitted event should be ignored",
  );
  assert(
    isStaleSubmittedResult("failed", "submitted"),
    "late submitted event should not reopen failure",
  );
  assert(
    !isStaleSubmittedResult("submitted", "submitted"),
    "current submitted event is idempotent",
  );
});

Deno.test("closeout rejects replay scope mutation", () => {
  const existing = {
    id: "44444444-4444-4444-8444-444444444444",
    owner_user_id: "55555555-5555-4555-8555-555555555555",
    workspace_id: validBody.workspaceId,
    agent_id: validBody.agentId,
    prepared_action_id: validBody.preparedActionId,
    prepared_action_record_id: "66666666-6666-4666-8666-666666666666",
    submission_key: "b".repeat(64),
    tx_hash: validBody.txHash,
    status: "submitted" as const,
  };
  assertThrowsCode(
    () =>
      assertExistingScope(existing, {
        ownerUserId: existing.owner_user_id,
        workspaceId: existing.workspace_id,
        agentId: existing.agent_id,
        preparedActionId: "different-action",
        preparedActionRecordId: existing.prepared_action_record_id,
        submissionKey: existing.submission_key,
        txHash: existing.tx_hash,
      }),
    "closeout_scope_conflict",
  );
});
