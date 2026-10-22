import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createReviewedSwapQuoteRequest,
  formatSwapAmount,
  getSwapTokenDecimals,
  getSwapTokenSymbolForAddress,
  nativeSwapTokenAddress,
  swapQuoteMaximumSlippageBps,
  swapQuoteMinimumSlippageBps,
  swapQuotePolicyVersion,
  usdgSwapMaxAtomic,
  usdgTokenAddress,
} from "../src/config/swapQuotePolicy.ts";
import { nativeTransferMaxAtomic } from "../src/config/transferTransactionPolicy.ts";
import { robinhoodChain } from "../src/config/productChains.ts";

const common = {
  workspaceId: "2094f3e1-3657-4754-98b9-470e8d72e14a",
  agentId: "2f538ddd-e2e8-4ba2-89a3-cab4a4a85799",
  requestId: "swap:frontend:0001",
  taker: "0x1111111111111111111111111111111111111111",
  slippageBps: 50,
} as const;

Deno.test("builds the exact capped ETH to USDG request", () => {
  const result = createReviewedSwapQuoteRequest({
    ...common,
    sellTokenSymbol: "ETH",
    buyTokenSymbol: "USDG",
    sellAmount: "0.005",
  });

  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.request.chainKey, "robinhood_mainnet");
  assertEquals(result.request.chainId, robinhoodChain.id);
  assertEquals(result.request.sellToken, nativeSwapTokenAddress);
  assertEquals(result.request.buyToken, usdgTokenAddress);
  assertEquals(result.request.sellAmount, nativeTransferMaxAtomic.toString());
  assertEquals(result.request.policyVersion, swapQuotePolicyVersion);
  assertEquals(result.request.policyVersion, 2);
});

Deno.test("builds the exact capped USDG to ETH request with six decimals", () => {
  const result = createReviewedSwapQuoteRequest({
    ...common,
    requestId: "swap:frontend:0002",
    sellTokenSymbol: "USDG",
    buyTokenSymbol: "ETH",
    sellAmount: "12.5",
    slippageBps: swapQuoteMaximumSlippageBps,
  });

  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.request.sellToken, usdgTokenAddress);
  assertEquals(result.request.buyToken, nativeSwapTokenAddress);
  assertEquals(result.request.sellAmount, usdgSwapMaxAtomic.toString());
  assertEquals(result.request.sellAmount, "12500000");
  assertEquals(getSwapTokenDecimals("USDG"), 6);
});

Deno.test("rejects same-token, malformed, zero, over-cap, and too-precise requests", () => {
  const invalid = [
    { sellTokenSymbol: "ETH", buyTokenSymbol: "ETH", sellAmount: "0.001" },
    { sellTokenSymbol: "ETH", buyTokenSymbol: "USDG", sellAmount: "not-a-number" },
    { sellTokenSymbol: "ETH", buyTokenSymbol: "USDG", sellAmount: "0" },
    { sellTokenSymbol: "ETH", buyTokenSymbol: "USDG", sellAmount: "0.005000000000000001" },
    { sellTokenSymbol: "USDG", buyTokenSymbol: "ETH", sellAmount: "12.500001" },
    { sellTokenSymbol: "USDG", buyTokenSymbol: "ETH", sellAmount: "1.0000001" },
  ] as const;

  for (const item of invalid) {
    const result = createReviewedSwapQuoteRequest({ ...common, ...item });
    assertEquals(result.ok, false, JSON.stringify(item));
  }
});

Deno.test("keeps slippage inside the reviewed bounds", () => {
  for (const slippageBps of [swapQuoteMinimumSlippageBps - 1, swapQuoteMaximumSlippageBps + 1, 12.5]) {
    const result = createReviewedSwapQuoteRequest({
      ...common,
      slippageBps,
      sellTokenSymbol: "ETH",
      buyTokenSymbol: "USDG",
      sellAmount: "0.001",
    });
    assertEquals(result.ok, false);
  }
});

Deno.test("maps only ETH and USDG addresses to swap symbols", () => {
  assertEquals(getSwapTokenSymbolForAddress(nativeSwapTokenAddress), "ETH");
  assertEquals(getSwapTokenSymbolForAddress(usdgTokenAddress), "USDG");
  assertEquals(getSwapTokenSymbolForAddress(usdgTokenAddress.toLowerCase()), "USDG");
  assertEquals(getSwapTokenSymbolForAddress("0x11bceD4Ed1b20eAE8aA4Ff840a5dCEB078C9cb53"), null);
  assertEquals(getSwapTokenSymbolForAddress(42), null);
});

Deno.test("shortens swap amounts without ever rounding them up", () => {
  assertEquals(formatSwapAmount("84263068703674", 18), "0.000084263");
  assertEquals(formatSwapAmount("83420438016637", 18), "0.0000834204");
  assertEquals(formatSwapAmount("237367", 6), "0.237367");
  assertEquals(formatSwapAmount("12500000", 6), "12.5");
  assertEquals(formatSwapAmount("1999999999999999999", 18), "1.999999");
  assertEquals(formatSwapAmount("5000000000000000", 18), "0.005");
});
