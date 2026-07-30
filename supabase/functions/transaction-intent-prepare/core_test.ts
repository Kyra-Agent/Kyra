import {
  assertTransactionIntentPrepareBody,
  HttpError,
  matchesExistingIntent,
} from "./core.ts";
import {
  ownerTransactionPolicyVersion,
  ownerTransactionValueWei,
} from "../_shared/owner-transaction-policy.ts";
import {
  encodeKyraTransferData,
  kyraTokenAddress,
  transferTransactionPolicyVersion,
} from "../_shared/transfer-transaction-policy.ts";

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

const workspaceId = "11111111-1111-4111-8111-111111111111";
const agentId = "22222222-2222-4222-8222-222222222222";
const sender = "0x1111111111111111111111111111111111111111";
const recipient = "0x3333333333333333333333333333333333333333";

const validLegacyBody = {
  workspaceId,
  agentId,
  requestId: "phase8-agent-wallet",
  chainKey: "robinhood_mainnet",
  chainId: 4663,
  recipient,
  valueWei: ownerTransactionValueWei,
  data: "0x",
};

const validNativeBody = {
  workspaceId,
  agentId,
  requestId: "transfer-native-review",
  chainKey: "robinhood_mainnet",
  chainId: 4663,
  sender,
  recipient,
  assetKind: "native",
  tokenAddress: null,
  tokenSymbol: "ETH",
  tokenDecimals: 18,
  amountAtomic: "1000000000000000",
  valueWei: "1000000000000000",
  data: "0x",
  policyVersion: transferTransactionPolicyVersion,
};

const kyraAmount = "125000000000000000000";
const validKyraBody = {
  ...validNativeBody,
  requestId: "transfer-kyra-review",
  assetKind: "erc20",
  tokenAddress: kyraTokenAddress,
  tokenSymbol: "KYRA",
  amountAtomic: kyraAmount,
  valueWei: "0",
  data: encodeKyraTransferData(recipient, BigInt(kyraAmount)),
};

Deno.test("accepts the bounded legacy owner intent", () => {
  const body = assertTransactionIntentPrepareBody(validLegacyBody);
  assert(body.recipient === validLegacyBody.recipient, "recipient expected");
  assert(
    body.policyVersion === ownerTransactionPolicyVersion,
    "legacy policy expected",
  );
});

Deno.test("accepts native and allowlisted KYRA transfer intents", () => {
  const native = assertTransactionIntentPrepareBody(validNativeBody);
  assert(native.policyVersion === 3, "native T1 policy expected");
  assert(native.assetKind === "native", "native asset expected");

  const kyra = assertTransactionIntentPrepareBody(validKyraBody);
  assert(kyra.policyVersion === 3, "KYRA T1 policy expected");
  assert(kyra.assetKind === "erc20", "ERC20 asset expected");
  assert(kyra.tokenAddress === kyraTokenAddress, "official token expected");
});

Deno.test("rejects malformed, excessive, self, and arbitrary-token intents", () => {
  assertThrowsCode(
    () =>
      assertTransactionIntentPrepareBody({
        ...validLegacyBody,
        valueWei: "0",
      }),
    "invalid_transaction_intent",
  );
  assertThrowsCode(
    () =>
      assertTransactionIntentPrepareBody({
        ...validNativeBody,
        recipient: sender,
      }),
    "invalid_transaction_intent",
  );
  assertThrowsCode(
    () =>
      assertTransactionIntentPrepareBody({
        ...validNativeBody,
        amountAtomic: "5000000000000001",
        valueWei: "5000000000000001",
      }),
    "invalid_transaction_intent",
  );
  assertThrowsCode(
    () =>
      assertTransactionIntentPrepareBody({
        ...validKyraBody,
        tokenAddress: "0x4444444444444444444444444444444444444444",
      }),
    "invalid_transaction_intent",
  );
  assertThrowsCode(
    () =>
      assertTransactionIntentPrepareBody({
        ...validKyraBody,
        data: encodeKyraTransferData(recipient, 1n),
      }),
    "invalid_transaction_intent",
  );
  assertThrowsCode(
    () =>
      assertTransactionIntentPrepareBody({
        ...validNativeBody,
        privateKey: "secret",
      }),
    "invalid_transaction_intent",
  );
});

Deno.test("matches only immutable legacy and T1 stored intents", () => {
  for (const source of [validLegacyBody, validNativeBody, validKyraBody]) {
    const body = assertTransactionIntentPrepareBody(source);
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
      sender_address: body.sender,
      recipient: body.recipient,
      asset_kind: body.assetKind,
      token_address: body.tokenAddress,
      token_symbol: body.tokenSymbol,
      token_decimals: body.tokenDecimals,
      amount_atomic: body.amountAtomic,
      value_wei: body.valueWei,
      calldata: body.data,
      policy_version: body.policyVersion,
    };
    assert(matchesExistingIntent(stored, body), "stored intent should match");
    assert(
      !matchesExistingIntent({
        ...stored,
        amount_atomic: "1",
      }, body),
      "amount mutation must fail",
    );
    assert(
      !matchesExistingIntent({
        ...stored,
        sender_address: "0x4444444444444444444444444444444444444444",
      }, body),
      "sender mutation must fail",
    );
  }
});
