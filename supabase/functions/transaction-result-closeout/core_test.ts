import {
  assertExistingScope,
  assertTransactionResultCloseoutBody,
  canTransitionExecutionResult,
  HttpError,
  isStaleSubmittedResult,
} from "./core.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrowsCode(run: () => unknown, code: string) {
  try {
    run();
  } catch (error) {
    assert(error instanceof HttpError, "expected HttpError");
    assert(error.code === code, "expected " + code + ", received " + error.code);
    return;
  }
  throw new Error("expected function to throw");
}

const validBody = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  agentId: "22222222-2222-4222-8222-222222222222",
  preparedActionId: "phase8-agent-1",
  submissionNonce: "phase8-submit-33333333-3333-4333-8333-333333333333",
  txHash: "0x" + "a".repeat(64),
  status: "submitted",
  failureCode: null,
};

Deno.test("closeout accepts sanitized owner-scoped submitted result", () => {
  const result = assertTransactionResultCloseoutBody(validBody);
  assert(result.status === "submitted", "submitted status expected");
  assert(result.txHash === validBody.txHash, "hash must be normalized");
});

Deno.test("closeout rejects raw or malformed references", () => {
  assertThrowsCode(
    () => assertTransactionResultCloseoutBody({ ...validBody, txHash: "secret" }),
    "transaction_hash_required",
  );
  assertThrowsCode(
    () => assertTransactionResultCloseoutBody({
      ...validBody,
      failureCode: "raw_provider_error",
    }),
    "failure_code_invalid",
  );
});

Deno.test("closeout requires a sanitized failure code for failed status", () => {
  assertThrowsCode(
    () => assertTransactionResultCloseoutBody({
      ...validBody,
      status: "failed",
      failureCode: null,
    }),
    "failure_code_invalid",
  );
  const failed = assertTransactionResultCloseoutBody({
    ...validBody,
    status: "failed",
    failureCode: "transaction_reverted",
  });
  assert(failed.failureCode === "transaction_reverted", "sanitized code expected");
});

Deno.test("closeout status transitions are terminal", () => {
  assert(canTransitionExecutionResult("submitted", "confirmed"), "confirmation should pass");
  assert(canTransitionExecutionResult("submitted", "failed"), "failure should pass");
  assert(canTransitionExecutionResult("confirmed", "confirmed"), "idempotent confirm should pass");
  assert(!canTransitionExecutionResult("confirmed", "failed"), "confirmed result cannot fail later");
  assert(!canTransitionExecutionResult("failed", "confirmed"), "failed result cannot confirm later");
  assert(isStaleSubmittedResult("confirmed", "submitted"), "late submitted event should be ignored");
  assert(isStaleSubmittedResult("failed", "submitted"), "late submitted event should not reopen failure");
  assert(!isStaleSubmittedResult("submitted", "submitted"), "current submitted event is idempotent");
});

Deno.test("closeout rejects replay scope mutation", () => {
  const existing = {
    id: "44444444-4444-4444-8444-444444444444",
    owner_user_id: "55555555-5555-4555-8555-555555555555",
    workspace_id: validBody.workspaceId,
    agent_id: validBody.agentId,
    prepared_action_id: validBody.preparedActionId,
    submission_key: "b".repeat(64),
    tx_hash: validBody.txHash,
    status: "submitted" as const,
  };
  assertThrowsCode(
    () => assertExistingScope(existing, {
      ownerUserId: existing.owner_user_id,
      workspaceId: existing.workspace_id,
      agentId: existing.agent_id,
      preparedActionId: "different-action",
      submissionKey: existing.submission_key,
      txHash: existing.tx_hash,
    }),
    "closeout_scope_conflict",
  );
});