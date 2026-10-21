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
  swapQuotePolicyVersion,
  type SwapQuoteRequest,
  usdgTokenAddress,
} from "../_shared/swap-quote-policy.ts";
import {
  assertSwapQuotePrepareBody,
  HttpError,
  matchesExistingSwapQuote,
} from "./core.ts";

const workspaceId = "2094f3e1-3657-4754-98b9-470e8d72e14a";
const agentId = "2f538ddd-e2e8-4ba2-89a3-cab4a4a85799";
const taker = "0x2cfB1A2C7F70C2011C837b89d74a25b7bbfd0d2e";

function validRequest(): SwapQuoteRequest {
  return {
    workspaceId,
    agentId,
    requestId: "swap:test:0001",
    chainKey: robinhoodMainnetChainKey,
    chainId: robinhoodMainnetChainId,
    taker,
    sellToken: nativeSwapTokenAddress,
    buyToken: usdgTokenAddress,
    sellAmount: "1000000000000000",
    slippageBps: 50,
    policyVersion: swapQuotePolicyVersion,
  };
}

Deno.test("accepts an exact-input ETH to USDG quote request", () => {
  assertEquals(assertSwapQuotePrepareBody(validRequest()), validRequest());
});

Deno.test("accepts USDG to ETH within the USDG cap and rejects more", () => {
  const usdgSale = {
    ...validRequest(),
    sellToken: usdgTokenAddress,
    buyToken: nativeSwapTokenAddress,
    sellAmount: "12500000",
  };
  assertEquals(assertSwapQuotePrepareBody(usdgSale).sellAmount, "12500000");
  assertThrows(
    () => assertSwapQuotePrepareBody({ ...usdgSale, sellAmount: "12500001" }),
    HttpError,
  );
});

Deno.test("rejects extra request fields", () => {
  assertThrows(
    () =>
      assertSwapQuotePrepareBody({
        ...validRequest(),
        transactionData: "0x12",
      }),
    HttpError,
    "protected Robinhood Chain policy",
  );
});

Deno.test("rejects unsupported tokens, limits, slippage, and same-token pairs", () => {
  const invalidCases = [
    {
      ...validRequest(),
      buyToken: "0x0000000000000000000000000000000000000001",
    },
    { ...validRequest(), sellAmount: "5000000000000001" },
    { ...validRequest(), slippageBps: 301 },
    { ...validRequest(), buyToken: nativeSwapTokenAddress },
    { ...validRequest(), buyToken: usdgTokenAddress.toLowerCase() },
    { ...validRequest(), policyVersion: 1 },
  ];
  for (const value of invalidCases) {
    assertThrows(() => assertSwapQuotePrepareBody(value), HttpError);
  }
});

Deno.test("idempotency matching covers every immutable request field", () => {
  const request = assertSwapQuotePrepareBody(validRequest());
  const existing: Record<string, unknown> = {
    workspace_id: request.workspaceId,
    agent_id: request.agentId,
    request_id: request.requestId,
    chain_key: request.chainKey,
    chain_id: request.chainId,
    taker_address: request.taker,
    sell_token_address: request.sellToken,
    buy_token_address: request.buyToken,
    sell_amount_atomic: request.sellAmount,
    slippage_bps: request.slippageBps,
    policy_version: request.policyVersion,
    provider: "uniswap_v3_robinhood",
    status: "quote_ready",
  };
  assertEquals(matchesExistingSwapQuote(existing, request), true);
  assertEquals(
    matchesExistingSwapQuote({ ...existing, sell_amount_atomic: "2" }, request),
    false,
  );
  assertEquals(
    matchesExistingSwapQuote({ ...existing, provider: "0x_swap_api_v2" }, request),
    false,
  );
});
