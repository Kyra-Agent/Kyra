import {
  assertTransactionIntentPrepareBody,
  HttpError,
  matchesExistingIntent,
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
    assert(error.code === code, `expected ${code}, received ${error.code}`);
    return;
  }
  throw new Error("expected function to throw");
}

const validBody = {
  workspaceId: "11111111-1111-4111-8111-111111111111",
  agentId: "22222222-2222-4222-8222-222222222222",
  requestId: "phase8-agent-wallet",
  chainKey: "robinhood_mainnet",
  chainId: 4663,
  recipient: "0x3333333333333333333333333333333333333333",
  valueWei: ownerTransactionValueWei,
  data: "0x",
};

Deno.test("accepts the bounded fixed-value owner intent", () => {
  const body = assertTransactionIntentPrepareBody(validBody);
  assert(body.recipient === validBody.recipient, "recipient expected");
  assert(
    body.policyVersion === ownerTransactionPolicyVersion,
    "current policy version expected",
  );
});

Deno.test("rejects value, calldata, chain, and extra fields", () => {
  assertThrowsCode(
    () => assertTransactionIntentPrepareBody({ ...validBody, valueWei: "0" }),
    "invalid_transaction_intent",
  );
  assertThrowsCode(
    () =>
      assertTransactionIntentPrepareBody({
        ...validBody,
        valueWei: "99999999999999",
      }),
    "invalid_transaction_intent",
  );
  assertThrowsCode(
    () =>
      assertTransactionIntentPrepareBody({
        ...validBody,
        valueWei: "100000000000001",
      }),
    "invalid_transaction_intent",
  );
  assertThrowsCode(
    () => assertTransactionIntentPrepareBody({ ...validBody, data: "0x01" }),
    "invalid_transaction_intent",
  );
  assertThrowsCode(
    () => assertTransactionIntentPrepareBody({ ...validBody, chainId: 8453 }),
    "invalid_transaction_intent",
  );
  assertThrowsCode(
    () =>
      assertTransactionIntentPrepareBody({
        ...validBody,
        privateKey: "secret",
      }),
    "invalid_transaction_intent",
  );
});

Deno.test("matches only the immutable stored intent", () => {
  const body = assertTransactionIntentPrepareBody(validBody);
  const stored = {
    workspace_id: body.workspaceId,
    agent_id: body.agentId,
    request_id: body.requestId,
    action_kind: "robinhood_reviewed_transaction",
    chain_key: body.chainKey,
    chain_id: body.chainId,
    status: "approved",
    risk: "review",
    provider: "owner_dashboard",
    recipient: body.recipient,
    value_wei: body.valueWei,
    calldata: body.data,
    policy_version: body.policyVersion,
  };
  assert(matchesExistingIntent(stored, body), "stored intent should match");
  assert(
    !matchesExistingIntent({
      ...stored,
      recipient: "0x4444444444444444444444444444444444444444",
    }, body),
    "recipient mutation must fail",
  );
  assert(
    !matchesExistingIntent({
      ...stored,
      policy_version: 1,
    }, body),
    "legacy policy mutation must fail",
  );
});