import { getAddress, parseUnits } from "viem";
import {
  kyraTokenAddress,
  kyraTokenDecimals,
  kyraTokenSymbol,
  nativeTransferMaxAtomic,
} from "./transferTransactionPolicy";
import { robinhoodChain } from "./productChains";

export const swapQuotePolicyVersion = 1 as const;
export const zeroExNativeTokenAddress =
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;
export const swapQuoteMinimumSlippageBps = 10;
export const swapQuoteMaximumSlippageBps = 300;
export const kyraSwapMaxAtomic = 10_000n * 10n ** 18n;

export type SwapTokenSymbol = "ETH" | typeof kyraTokenSymbol;
export type SwapTokenAddress =
  | typeof zeroExNativeTokenAddress
  | typeof kyraTokenAddress;

export interface ReviewedSwapQuoteRequest {
  workspaceId: string;
  agentId: string;
  requestId: string;
  chainKey: "robinhood_mainnet";
  chainId: typeof robinhoodChain.id;
  taker: `0x${string}`;
  sellToken: SwapTokenAddress;
  buyToken: SwapTokenAddress;
  sellAmount: string;
  slippageBps: number;
  policyVersion: typeof swapQuotePolicyVersion;
}

export type ReviewedSwapQuoteRequestResult =
  | { ok: true; request: ReviewedSwapQuoteRequest }
  | { ok: false; message: string };

const tokens = {
  ETH: {
    address: zeroExNativeTokenAddress,
    decimals: 18,
    maxSellAmountAtomic: nativeTransferMaxAtomic,
  },
  KYRA: {
    address: kyraTokenAddress,
    decimals: kyraTokenDecimals,
    maxSellAmountAtomic: kyraSwapMaxAtomic,
  },
} as const;

export function getSwapTokenSymbolForAddress(
  address: unknown,
): SwapTokenSymbol | null {
  if (typeof address !== "string") return null;
  const normalized = address.toLowerCase();
  if (normalized === zeroExNativeTokenAddress) return "ETH";
  if (normalized === kyraTokenAddress.toLowerCase()) return "KYRA";
  return null;
}

export function createReviewedSwapQuoteRequest(input: {
  workspaceId: string;
  agentId: string;
  requestId: string;
  taker: string;
  sellTokenSymbol: SwapTokenSymbol;
  buyTokenSymbol: SwapTokenSymbol;
  sellAmount: string;
  slippageBps: number;
}): ReviewedSwapQuoteRequestResult {
  if (input.sellTokenSymbol === input.buyTokenSymbol) {
    return { ok: false, message: "Choose two different approved assets." };
  }

  let taker: `0x${string}`;
  try {
    taker = getAddress(input.taker);
  } catch {
    return { ok: false, message: "Connect a valid Robinhood Chain wallet." };
  }

  const sellToken = tokens[input.sellTokenSymbol];
  const buyToken = tokens[input.buyTokenSymbol];
  let sellAmountAtomic: bigint;
  try {
    sellAmountAtomic = parseUnits(input.sellAmount.trim(), sellToken.decimals);
  } catch {
    return { ok: false, message: "Enter a valid positive sell amount." };
  }

  if (sellAmountAtomic <= 0n) {
    return { ok: false, message: "Sell amount must be greater than zero." };
  }
  if (sellAmountAtomic > sellToken.maxSellAmountAtomic) {
    return {
      ok: false,
      message: input.sellTokenSymbol === "ETH"
        ? "ETH sell amount exceeds the 0.005 ETH review limit."
        : "KYRA sell amount exceeds the 10,000 KYRA review limit.",
    };
  }
  if (
    !Number.isInteger(input.slippageBps) ||
    input.slippageBps < swapQuoteMinimumSlippageBps ||
    input.slippageBps > swapQuoteMaximumSlippageBps
  ) {
    return {
      ok: false,
      message: "Slippage must be between 0.10% and 3.00%.",
    };
  }

  return {
    ok: true,
    request: {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      requestId: input.requestId,
      chainKey: "robinhood_mainnet",
      chainId: robinhoodChain.id,
      taker,
      sellToken: sellToken.address,
      buyToken: buyToken.address,
      sellAmount: sellAmountAtomic.toString(),
      slippageBps: input.slippageBps,
      policyVersion: swapQuotePolicyVersion,
    },
  };
}
