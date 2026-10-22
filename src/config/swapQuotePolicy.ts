import { formatUnits, getAddress, parseUnits } from "viem";
import {
  type EvmAddress,
  nativeTransferMaxAtomic,
} from "./transferTransactionPolicy";
import { robinhoodChain } from "./productChains";

// Mirrors supabase/functions/_shared/swap-quote-policy.ts (version 2): ETH
// and USDG through Uniswap V3 on Robinhood Chain.
export const swapQuotePolicyVersion = 2 as const;
export const nativeSwapTokenAddress =
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;
export const usdgTokenAddress =
  "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168" as const;
export const uniswapSwapRouter02Address =
  "0xCaf681a66D020601342297493863E78C959E5cb2" as const;
export const swapQuoteMinimumSlippageBps = 10;
export const swapQuoteMaximumSlippageBps = 300;
export const usdgSwapMaxAtomic = 12_500_000n;

export type SwapTokenSymbol = "ETH" | "USDG";
export type SwapTokenAddress = EvmAddress;

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

interface SwapTokenPolicy {
  address: SwapTokenAddress;
  decimals: 18 | 6;
  maxSellAmountAtomic: bigint;
  maxSellLabel: string;
}

const swapTokenPolicies: Record<SwapTokenSymbol, SwapTokenPolicy> = {
  ETH: {
    address: nativeSwapTokenAddress,
    decimals: 18,
    maxSellAmountAtomic: nativeTransferMaxAtomic,
    maxSellLabel: "0.005 ETH",
  },
  USDG: {
    address: usdgTokenAddress,
    decimals: 6,
    maxSellAmountAtomic: usdgSwapMaxAtomic,
    maxSellLabel: "12.5 USDG",
  },
};

export function getSwapTokenDecimals(symbol: SwapTokenSymbol) {
  return swapTokenPolicies[symbol].decimals;
}

export function getSwapTokenMaxSellLabel(symbol: SwapTokenSymbol) {
  return swapTokenPolicies[symbol].maxSellLabel;
}

export function getSwapTokenSymbolForAddress(
  address: unknown,
): SwapTokenSymbol | null {
  if (typeof address !== "string") return null;
  const normalized = address.toLowerCase();
  if (normalized === nativeSwapTokenAddress) return "ETH";
  if (normalized === usdgTokenAddress.toLowerCase()) return "USDG";
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
    return { ok: false, message: "Choose two different assets." };
  }

  let taker: `0x${string}`;
  try {
    taker = getAddress(input.taker);
  } catch {
    return { ok: false, message: "Connect a valid Robinhood Chain wallet." };
  }

  const sellToken = swapTokenPolicies[input.sellTokenSymbol];
  const buyToken = swapTokenPolicies[input.buyTokenSymbol];
  if (!sellToken || !buyToken) {
    return { ok: false, message: "Choose ETH or USDG." };
  }
  // parseUnits rounds extra decimals, which would swap a different amount
  // than the one typed, so more precision than the token has is refused.
  const typedAmount = input.sellAmount.trim();
  const fraction = /^\d+(?:\.(\d+))?$/u.exec(typedAmount)?.[1] ?? "";
  if (fraction.length > sellToken.decimals) {
    return {
      ok: false,
      message: `${input.sellTokenSymbol} supports up to ${sellToken.decimals} decimal places.`,
    };
  }
  let sellAmountAtomic: bigint;
  try {
    sellAmountAtomic = parseUnits(typedAmount, sellToken.decimals);
  } catch {
    return { ok: false, message: "Enter a valid positive sell amount." };
  }

  if (sellAmountAtomic <= 0n) {
    return { ok: false, message: "Sell amount must be greater than zero." };
  }
  if (sellAmountAtomic > sellToken.maxSellAmountAtomic) {
    return {
      ok: false,
      message: `${input.sellTokenSymbol} sell amount exceeds the ${sellToken.maxSellLabel} swap limit.`,
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

// Shows up to six significant digits after any leading zeros, cut off rather
// than rounded so an amount never looks larger than it is.
export function formatSwapAmount(atomic: string, decimals: number) {
  const [whole, fraction = ""] = formatUnits(BigInt(atomic), decimals).split(".");
  if (!fraction) return whole;
  const firstSignificant = fraction.search(/[1-9]/u);
  const keep = whole !== "0" ? 6 : firstSignificant < 0 ? 0 : firstSignificant + 6;
  const shortened = fraction.slice(0, keep).replace(/0+$/u, "");
  return shortened ? `${whole}.${shortened}` : whole;
}
