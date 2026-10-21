import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  robinhoodMainnetChainId,
  robinhoodMainnetChainKey,
} from "../_shared/transfer-transaction-policy.ts";
import {
  nativeSwapTokenAddress,
  usdgTokenAddress,
} from "../_shared/swap-quote-policy.ts";
import { uniswapSwapRouter02Address } from "../_shared/uniswap-robinhood.ts";
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
const spender = uniswapSwapRouter02Address;
const target = uniswapSwapRouter02Address;
const routerWord = "000000000000000000000000caf681a66d020601342297493863e78c959e5cb2";
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
    sell_token_address: usdgTokenAddress,
    sell_token_symbol: "USDG",
    buy_token_address: nativeSwapTokenAddress,
    sell_amount_atomic: "1000000",
    allowance_target: spender,
    transaction_to: target,
    transaction_data: "0x1234",
    transaction_value_wei: "0",
    status: "allowance_required",
    policy_version: 2,
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
  assertEquals(intent.transaction_to, usdgTokenAddress);
  assertEquals(intent.spender_address, spender);
  assertEquals(intent.allowance_amount_atomic, "1000000");
  assertEquals(
    intent.transaction_data,
    `0x095ea7b3${routerWord}00000000000000000000000000000000000000000000000000000000000f4240`,
  );
});

Deno.test("refuses an allowance for any spender other than the Uniswap router", () => {
  assertThrows(
    () =>
      prepareSwapExecutionIntent({
        body: body("allowance_set"),
        ownerUserId,
        quote: quote({ allowance_target: "0x0000000000001fF3684f28c67538d4D072C22734" }),
        now,
      }),
    HttpError,
    "stored quote",
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
  assertEquals(intent.spender_address, null);
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
    `0x095ea7b3${routerWord}${"0".repeat(64)}`,
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
          sell_token_address: nativeSwapTokenAddress,
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
