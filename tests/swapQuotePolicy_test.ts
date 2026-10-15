import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createReviewedSwapQuoteRequest,
  getSwapTokenSymbolForAddress,
  isProtectedSwapPairAvailable,
  kyraSwapMaxAtomic,
  swapQuoteMaximumSlippageBps,
  swapQuoteMinimumSlippageBps,
  swapQuotePolicyVersion,
  zeroExNativeTokenAddress,
} from "../src/config/swapQuotePolicy.ts";
import {
  configureOfficialKyraTokenAddressForTests,
  nativeTransferMaxAtomic,
} from "../src/config/transferTransactionPolicy.ts";
import { robinhoodChain } from "../src/config/productChains.ts";

// Synthetic checksummed fixture; never a published contract.
const kyraTokenAddress = "0x11bceD4Ed1b20eAE8aA4Ff840a5dCEB078C9cb53" as const;
configureOfficialKyraTokenAddressForTests(kyraTokenAddress);

const common = {
  workspaceId: "2094f3e1-3657-4754-98b9-470e8d72e14a",
  agentId: "2f538ddd-e2e8-4ba2-89a3-cab4a4a85799",
  requestId: "swap:frontend:0001",
  taker: "0x1111111111111111111111111111111111111111",
  slippageBps: 50,
} as const;

Deno.test("builds the exact capped ETH to KYRA request", () => {
  const result = createReviewedSwapQuoteRequest({
    ...common,
    sellTokenSymbol: "ETH",
    buyTokenSymbol: "KYRA",
    sellAmount: "0.005",
  });

  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.request.chainKey, "robinhood_mainnet");
  assertEquals(result.request.chainId, robinhoodChain.id);
  assertEquals(result.request.sellToken, zeroExNativeTokenAddress);
  assertEquals(result.request.buyToken, kyraTokenAddress);
  assertEquals(result.request.sellAmount, nativeTransferMaxAtomic.toString());
  assertEquals(result.request.policyVersion, swapQuotePolicyVersion);
});

Deno.test("builds the exact capped KYRA to ETH request", () => {
  const result = createReviewedSwapQuoteRequest({
    ...common,
    requestId: "swap:frontend:0002",
    sellTokenSymbol: "KYRA",
    buyTokenSymbol: "ETH",
    sellAmount: "10000",
    slippageBps: swapQuoteMaximumSlippageBps,
  });

  assertEquals(result.ok, true);
  if (!result.ok) return;
  assertEquals(result.request.sellToken, kyraTokenAddress);
  assertEquals(result.request.buyToken, zeroExNativeTokenAddress);
  assertEquals(result.request.sellAmount, kyraSwapMaxAtomic.toString());
});

Deno.test("rejects same-token, malformed, zero, and over-cap requests", () => {
  const invalid = [
    { sellTokenSymbol: "ETH", buyTokenSymbol: "ETH", sellAmount: "0.001" },
    {
      sellTokenSymbol: "ETH",
      buyTokenSymbol: "KYRA",
      sellAmount: "not-a-number",
    },
    { sellTokenSymbol: "ETH", buyTokenSymbol: "KYRA", sellAmount: "0" },
    {
      sellTokenSymbol: "ETH",
      buyTokenSymbol: "KYRA",
      sellAmount: "0.005000000000000001",
    },
    {
      sellTokenSymbol: "KYRA",
      buyTokenSymbol: "ETH",
      sellAmount: "10000.000000000000000001",
    },
  ] as const;

  for (const item of invalid) {
    const result = createReviewedSwapQuoteRequest({
      ...common,
      ...item,
    });
    assertEquals(result.ok, false);
  }
});

Deno.test("rejects invalid wallets and slippage outside the exact policy", () => {
  for (
    const input of [
      { taker: "not-an-address", slippageBps: 50 },
      { taker: common.taker, slippageBps: swapQuoteMinimumSlippageBps - 1 },
      { taker: common.taker, slippageBps: swapQuoteMaximumSlippageBps + 1 },
      { taker: common.taker, slippageBps: 50.5 },
    ]
  ) {
    const result = createReviewedSwapQuoteRequest({
      ...common,
      ...input,
      sellTokenSymbol: "ETH",
      buyTokenSymbol: "KYRA",
      sellAmount: "0.001",
    });
    assertEquals(result.ok, false);
  }
});

Deno.test("maps only the two approved token addresses", () => {
  assertEquals(getSwapTokenSymbolForAddress(zeroExNativeTokenAddress), "ETH");
  assertEquals(
    getSwapTokenSymbolForAddress(kyraTokenAddress.toUpperCase()),
    "KYRA",
  );
  assertEquals(
    getSwapTokenSymbolForAddress("0x0000000000000000000000000000000000000001"),
    null,
  );
  assertEquals(getSwapTokenSymbolForAddress(null), null);
});

Deno.test("fails closed while the official KYRA contract is unpublished", () => {
  configureOfficialKyraTokenAddressForTests(null);
  try {
    assertEquals(isProtectedSwapPairAvailable(), false);
    assertEquals(getSwapTokenSymbolForAddress(kyraTokenAddress), null);
    for (
      const direction of [
        { sellTokenSymbol: "ETH", buyTokenSymbol: "KYRA" },
        { sellTokenSymbol: "KYRA", buyTokenSymbol: "ETH" },
      ] as const
    ) {
      const result = createReviewedSwapQuoteRequest({
        ...common,
        ...direction,
        sellAmount: "0.001",
      });
      assertEquals(result.ok, false);
    }
  } finally {
    configureOfficialKyraTokenAddressForTests(kyraTokenAddress);
  }
});
