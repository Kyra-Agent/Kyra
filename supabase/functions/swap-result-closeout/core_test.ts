import {
  assertExistingSwapResultScope,
  assertStoredSwapExecutionIntent,
  assertSwapResultCloseoutBody,
  canTransitionSwapExecutionResult,
  deriveVerifiedSwapExecutionResult,
  type ExistingSwapExecutionResult,
  HttpError,
  isStaleSubmittedSwapResult,
  nextSwapExecutionAction,
  reconcileSwapExecutionResultStatus,
  type StoredSwapExecutionIntent,
} from "./core.ts";
import {
  kyraTokenAddress,
  robinhoodMainnetChainId,
  robinhoodMainnetChainKey,
} from "../_shared/transfer-transaction-policy.ts";
import { swapExecutionPolicyVersion } from "../_shared/swap-execution-policy.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrowsCode(run: () => unknown, code: string) {
  try {
    run();
  } catch (error) {
    assert(error instanceof HttpError, "expected HttpError");
    assert(error.code === code, `expected ${code}, received ${error.code}`);
    return;
  }
  throw new Error("expected function to throw");
}

const ownerUserId = "11111111-1111-4111-8111-111111111111";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const agentId = "33333333-3333-4333-8333-333333333333";
const intentRecordId = "44444444-4444-4444-8444-444444444444";
const quoteReviewId = "55555555-5555-4555-8555-555555555555";
const sender = "0x1111111111111111111111111111111111111111";
const target = "0x2222222222222222222222222222222222222222";
const spender = "0x0000000000001fF3684f28c67538d4D072C22734";
const txHash = `0x${"a".repeat(64)}`;
const requestId = "swap:closeout:0001";

const validBody = {
  workspaceId,
  agentId,
  intentRecordId,
  requestId,
  txHash,
};

function intent(
  step: "allowance_set" | "swap" | "allowance_revoke" = "swap",
): StoredSwapExecutionIntent {
  return {
    id: intentRecordId,
    owner_user_id: ownerUserId,
    workspace_id: workspaceId,
    agent_id: agentId,
    quote_review_id: quoteReviewId,
    request_id: requestId,
    step,
    chain_key: robinhoodMainnetChainKey,
    chain_id: robinhoodMainnetChainId,
    sender_address: sender,
    transaction_to: step === "swap" ? target : kyraTokenAddress,
    transaction_data: "0x1234",
    transaction_value_wei: step === "swap" ? "7" : "0",
    token_address: step === "swap" ? null : kyraTokenAddress,
    spender_address: step === "swap" ? null : spender,
    allowance_amount_atomic: step === "swap"
      ? null
      : step === "allowance_set"
      ? "1000000000000000000"
      : "0",
    status: "approved",
    policy_version: swapExecutionPolicyVersion,
    expires_at: "2030-01-01T00:00:00.000Z",
  };
}

Deno.test("closeout accepts only owner scope, intent, request, and tx hash", () => {
  const parsed = assertSwapResultCloseoutBody(validBody);
  assert(parsed.txHash === txHash, "normalized transaction hash expected");
  assertThrowsCode(
    () => assertSwapResultCloseoutBody({ ...validBody, status: "confirmed" }),
    "invalid_swap_closeout_request",
  );
});

Deno.test("stored swap steps enforce immutable policy shape", () => {
  for (const step of ["allowance_set", "swap", "allowance_revoke"] as const) {
    const stored = intent(step);
    const parsed = assertStoredSwapExecutionIntent(stored, {
      ...validBody,
      ownerUserId,
    });
    assert(parsed.step === step, `expected ${step}`);
  }

  assertThrowsCode(
    () =>
      assertStoredSwapExecutionIntent(
        { ...intent("allowance_set"), allowance_amount_atomic: "0" },
        { ...validBody, ownerUserId },
      ),
    "swap_execution_intent_invalid",
  );
  assertThrowsCode(
    () =>
      assertStoredSwapExecutionIntent(
        { ...intent("allowance_revoke"), allowance_amount_atomic: "1" },
        { ...validBody, ownerUserId },
      ),
    "swap_execution_intent_invalid",
  );
});

Deno.test("receipt state is derived only from RPC receipt data", () => {
  const confirmed = deriveVerifiedSwapExecutionResult({
    status: "0x1",
    blockNumber: "0x2a",
  });
  assert(confirmed.status === "confirmed", "confirmation expected");
  assert(confirmed.blockNumber === 42, "block number expected");

  const failed = deriveVerifiedSwapExecutionResult({
    status: "0x0",
    blockNumber: "0x2b",
  });
  assert(failed.status === "failed", "reverted transaction must fail");
  assert(
    failed.failureCode === "transaction_reverted",
    "sanitized failure expected",
  );

  const submitted = deriveVerifiedSwapExecutionResult(null);
  assert(submitted.status === "submitted", "pending receipt expected");
});

Deno.test("terminal swap result state cannot be reversed", () => {
  assert(
    canTransitionSwapExecutionResult("submitted", "confirmed"),
    "submitted may confirm",
  );
  assert(
    canTransitionSwapExecutionResult("submitted", "failed"),
    "submitted may fail",
  );
  assert(
    !canTransitionSwapExecutionResult("confirmed", "failed"),
    "confirmed cannot fail later",
  );
  assert(
    !canTransitionSwapExecutionResult("failed", "confirmed"),
    "failed cannot confirm later",
  );
  assert(
    isStaleSubmittedSwapResult("confirmed", "submitted"),
    "late pending state must not reopen confirmation",
  );
});

Deno.test("closeout reconciliation is idempotent across duplicate requests", () => {
  const unchanged = reconcileSwapExecutionResultStatus(
    "confirmed",
    "submitted",
  );
  assert(unchanged.status === "confirmed", "terminal status must be preserved");
  assert(!unchanged.shouldUpdate, "stale receipt must not write");

  const advanced = reconcileSwapExecutionResultStatus("submitted", "confirmed");
  assert(advanced.status === "confirmed", "submitted result should confirm");
  assert(advanced.shouldUpdate, "forward transition must persist");

  const replay = reconcileSwapExecutionResultStatus("failed", "failed");
  assert(
    replay.status === "failed",
    "identical terminal replay must be accepted",
  );
  assert(!replay.shouldUpdate, "identical replay must not rewrite");

  assertThrowsCode(
    () => reconcileSwapExecutionResultStatus("confirmed", "failed"),
    "swap_status_transition_forbidden",
  );
});

Deno.test("next actions require fresh quote and eventual allowance revoke", () => {
  assert(
    nextSwapExecutionAction({
      step: "allowance_set",
      status: "confirmed",
      erc20AllowanceLineage: true,
    }) === "request_fresh_quote",
    "allowance confirmation must refresh quote",
  );
  assert(
    nextSwapExecutionAction({
      step: "swap",
      status: "confirmed",
      erc20AllowanceLineage: true,
    }) === "revoke_allowance",
    "ERC20 swap confirmation must revoke allowance",
  );
  assert(
    nextSwapExecutionAction({
      step: "swap",
      status: "failed",
      erc20AllowanceLineage: true,
    }) === "revoke_allowance",
    "failed ERC20 swap must still revoke allowance",
  );
  assert(
    nextSwapExecutionAction({
      step: "allowance_revoke",
      status: "confirmed",
      erc20AllowanceLineage: true,
    }) === "complete",
    "revoke confirmation completes the flow",
  );
  assert(
    nextSwapExecutionAction({
      step: "swap",
      status: "confirmed",
      erc20AllowanceLineage: false,
    }) === "complete",
    "native swap confirmation completes directly",
  );
});

Deno.test("existing closeout replay cannot mutate owner scope", () => {
  const storedIntent = intent();
  const existing: ExistingSwapExecutionResult = {
    id: "66666666-6666-4666-8666-666666666666",
    owner_user_id: ownerUserId,
    workspace_id: workspaceId,
    agent_id: agentId,
    intent_id: intentRecordId,
    request_id: requestId,
    step: "swap",
    chain_key: robinhoodMainnetChainKey,
    chain_id: robinhoodMainnetChainId,
    submission_key: "b".repeat(64),
    tx_hash: txHash,
    status: "submitted",
  };
  assertThrowsCode(
    () =>
      assertExistingSwapResultScope(existing, {
        ownerUserId,
        body: { ...validBody, txHash: `0x${"c".repeat(64)}` },
        intent: storedIntent,
        submissionKey: existing.submission_key,
      }),
    "swap_closeout_scope_conflict",
  );
});
