import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  kyraTokenAddress,
  robinhoodMainnetChainId,
  robinhoodMainnetChainKey,
} from "../_shared/transfer-transaction-policy.ts";
import { zeroExNativeTokenAddress } from "../_shared/swap-quote-policy.ts";
import {
  assertSwapExecutionPrepareBody,
  HttpError,
  matchesExistingSwapExecutionIntent,
  prepareSwapExecutionIntent,
  type StoredSwapQuote,
} from "./core.ts";

const workspaceId = "2094f3e1-3657-4754-98b9-470e8d72e14a";
const agentId = "2f538ddd-e2e8-4ba2-89a3-cab4a4a85799";
const quoteRecordId = "1f538ddd-e2e8-4ba2-89a3-cab4a4a85798";
const ownerUserId = "3f538ddd-e2e8-4ba2-89a3-cab4a4a85797";
const taker = "0x2cfB1A2C7F70C2011C837b89d74a25b7bbfd0d2e";
const spender = "0x0000000000001fF3684f28c67538d4D072C22734";
const target = "0x0000000000000000000000000000000000001234";
const now = new Date("2026-08-01T00:00:00.000Z");

function body(step: "allowance_set" | "swap" | "allowance_revoke") {
  return assertSwapExecutionPrepareBody({
    workspaceId,
    agentId,
    quoteRecordId,
    requestId: `swap:${step}:0001`,
    step,
  });
}

function quote(
  overrides: Partial<StoredSwapQuote> = {},
): StoredSwapQuote {
  return {
    id: quoteRecordId,
    workspace_id: workspaceId,
    agent_id: agentId,
    request_id: "swap:quote:0001",
    chain_key: robinhoodMainnetChainKey,
    chain_id: robinhoodMainnetChainId,
    taker_address: taker,
    sell_token_address: kyraTokenAddress,
    sell_token_symbol: "KYRA",
    buy_token_address: zeroExNativeTokenAddress,
    sell_amount_atomic: "1000000000000000000",
    allowance_target: spender,
    transaction_to: target,
    transaction_data: "0x1234",
    transaction_value_wei: "0",
    status: "allowance_required",
    policy_version: 1,
    quote_issued_at: "2026-08-01T00:00:00.000Z",
    expires_at: "2026-08-01T00:01:15.000Z",
    ...overrides,
  };
}

Deno.test("strict request body rejects browser-supplied transaction fields", () => {
  assertThrows(
    () =>
      assertSwapExecutionPrepareBody({
        ...body("swap"),
        to: target,
      }),
    HttpError,
    "owner-scoped",
  );
});

Deno.test("prepares exact allowance and never unlimited approval", () => {
  const intent = prepareSwapExecutionIntent({
    body: body("allowance_set"),
    ownerUserId,
    quote: quote(),
    now,
  });
  assertEquals(intent.step, "allowance_set");
  assertEquals(intent.transaction_to, kyraTokenAddress);
  assertEquals(intent.spender_address, spender);
  assertEquals(intent.allowance_amount_atomic, "1000000000000000000");
  assertEquals(
    intent.transaction_data,
    "0x095ea7b30000000000000000000000000000000000001ff3684f28c67538d4d072c227340000000000000000000000000000000000000000000000000de0b6b3a7640000",
  );
});

Deno.test("prepares only the immutable backend-reviewed swap payload", () => {
  const reviewed = quote({
    status: "quote_ready",
    transaction_value_wei: "7",
  });
  const intent = prepareSwapExecutionIntent({
    body: body("swap"),
    ownerUserId,
    quote: reviewed,
    now,
  });
  assertEquals(intent.transaction_to, target);
  assertEquals(intent.transaction_data, "0x1234");
  assertEquals(intent.transaction_value_wei, "7");
  assertEquals(intent.token_address, null);
});

Deno.test("prepares revoke as exact zero allowance", () => {
  const intent = prepareSwapExecutionIntent({
    body: body("allowance_revoke"),
    ownerUserId,
    quote: quote(),
    now,
  });
  assertEquals(intent.allowance_amount_atomic, "0");
  assertEquals(
    intent.transaction_data,
    "0x095ea7b30000000000000000000000000000000000001ff3684f28c67538d4d072c227340000000000000000000000000000000000000000000000000000000000000000",
  );
});

Deno.test("rejects expired, wrong-scope, and inapplicable steps", () => {
  assertThrows(
    () =>
      prepareSwapExecutionIntent({
        body: body("allowance_set"),
        ownerUserId,
        quote: quote(),
        now: new Date("2026-08-01T00:01:16.000Z"),
      }),
    HttpError,
    "expired",
  );
  assertThrows(
    () =>
      prepareSwapExecutionIntent({
        body: body("swap"),
        ownerUserId,
        quote: quote({ workspace_id: ownerUserId, status: "quote_ready" }),
        now,
      }),
    HttpError,
    "stored quote",
  );
  assertThrows(
    () =>
      prepareSwapExecutionIntent({
        body: body("allowance_set"),
        ownerUserId,
        quote: quote({
          sell_token_address: zeroExNativeTokenAddress,
          sell_token_symbol: "ETH",
          allowance_target: null,
        }),
        now,
      }),
    HttpError,
    "does not require",
  );
});

Deno.test("idempotency matching covers every immutable intent field", () => {
  const intent = prepareSwapExecutionIntent({
    body: body("allowance_set"),
    ownerUserId,
    quote: quote(),
    now,
  });
  assertEquals(
    matchesExistingSwapExecutionIntent({ id: "ignored", ...intent }, intent),
    true,
  );
  assertEquals(
    matchesExistingSwapExecutionIntent({
      ...intent,
      allowance_amount_atomic: "2",
    }, intent),
    false,
  );
});
