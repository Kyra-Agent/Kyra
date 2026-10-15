import { getAddress, isAddress } from "npm:viem@2.57.7";
import {
  getOfficialKyraTokenAddress,
  kyraTokenDecimals,
  kyraTokenSymbol,
  nativeTransferMaxAtomic,
  robinhoodMainnetChainId,
  robinhoodMainnetChainKey,
} from "./transfer-transaction-policy.ts";

export const swapQuotePolicyVersion = 1 as const;
export const zeroExNativeTokenAddress =
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee" as const;
export const swapQuoteLifetimeMs = 75_000;
export const swapQuoteMinimumSlippageBps = 10;
export const swapQuoteMaximumSlippageBps = 300;

export type SwapTokenSymbol = "ETH" | typeof kyraTokenSymbol;
export type SwapTokenAddress = `0x${string}`;

export interface SwapToken {
  address: SwapTokenAddress;
  symbol: SwapTokenSymbol;
  decimals: 18;
  maxSellAmountAtomic: bigint;
}

export const kyraSwapMaxSellAmountAtomic = 10_000n * 10n ** 18n;

const nativeSwapToken: SwapToken = Object.freeze({
  address: zeroExNativeTokenAddress,
  symbol: "ETH",
  decimals: 18,
  maxSellAmountAtomic: nativeTransferMaxAtomic,
});

export interface SwapQuoteRequest {
  workspaceId: string;
  agentId: string;
  requestId: string;
  chainKey: typeof robinhoodMainnetChainKey;
  chainId: typeof robinhoodMainnetChainId;
  taker: `0x${string}`;
  sellToken: SwapTokenAddress;
  buyToken: SwapTokenAddress;
  sellAmount: string;
  slippageBps: number;
  policyVersion: typeof swapQuotePolicyVersion;
}

export type SwapQuotePolicyError =
  | "invalid_scope"
  | "official_token_unavailable"
  | "invalid_taker"
  | "unsupported_chain"
  | "unsupported_token"
  | "same_token_pair"
  | "invalid_sell_amount"
  | "sell_limit_exceeded"
  | "invalid_slippage"
  | "invalid_policy_version";

export type SwapQuotePolicyResult =
  | { ok: true; request: SwapQuoteRequest }
  | { ok: false; error: SwapQuotePolicyError };

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/u;

export function createSwapQuoteRequest(input: {
  workspaceId: unknown;
  agentId: unknown;
  requestId: unknown;
  chainKey: unknown;
  chainId: unknown;
  taker: unknown;
  sellToken: unknown;
  buyToken: unknown;
  sellAmount: unknown;
  slippageBps: unknown;
  policyVersion: unknown;
}): SwapQuotePolicyResult {
  if (
    typeof input.workspaceId !== "string" ||
    !uuidPattern.test(input.workspaceId) ||
    typeof input.agentId !== "string" ||
    !uuidPattern.test(input.agentId) ||
    typeof input.requestId !== "string" ||
    !requestIdPattern.test(input.requestId)
  ) {
    return { ok: false, error: "invalid_scope" };
  }
  if (
    input.chainKey !== robinhoodMainnetChainKey ||
    input.chainId !== robinhoodMainnetChainId
  ) {
    return { ok: false, error: "unsupported_chain" };
  }
  if (input.policyVersion !== swapQuotePolicyVersion) {
    return { ok: false, error: "invalid_policy_version" };
  }
  if (getOfficialKyraTokenAddress() === null) {
    return { ok: false, error: "official_token_unavailable" };
  }

  const taker = readChecksummedAddress(input.taker);
  if (!taker) return { ok: false, error: "invalid_taker" };

  const sellToken = readSwapToken(input.sellToken);
  const buyToken = readSwapToken(input.buyToken);
  if (!sellToken || !buyToken) {
    return { ok: false, error: "unsupported_token" };
  }
  if (sellToken.address === buyToken.address) {
    return { ok: false, error: "same_token_pair" };
  }

  const sellAmount = readPositiveAtomicAmount(input.sellAmount);
  if (sellAmount === null) {
    return { ok: false, error: "invalid_sell_amount" };
  }
  if (sellAmount > sellToken.maxSellAmountAtomic) {
    return { ok: false, error: "sell_limit_exceeded" };
  }
  if (
    !Number.isInteger(input.slippageBps) ||
    Number(input.slippageBps) < swapQuoteMinimumSlippageBps ||
    Number(input.slippageBps) > swapQuoteMaximumSlippageBps
  ) {
    return { ok: false, error: "invalid_slippage" };
  }

  return {
    ok: true,
    request: {
      workspaceId: input.workspaceId.toLowerCase(),
      agentId: input.agentId.toLowerCase(),
      requestId: input.requestId,
      chainKey: robinhoodMainnetChainKey,
      chainId: robinhoodMainnetChainId,
      taker,
      sellToken: sellToken.address,
      buyToken: buyToken.address,
      sellAmount: sellAmount.toString(),
      slippageBps: Number(input.slippageBps),
      policyVersion: swapQuotePolicyVersion,
    },
  };
}

export function getSwapToken(address: SwapTokenAddress): SwapToken {
  const token = readSwapToken(address);
  if (!token) throw new Error("Unsupported protected swap token.");
  return token;
}

export function readSwapToken(value: unknown): SwapToken | null {
  if (value === zeroExNativeTokenAddress) return nativeSwapToken;
  const officialTokenAddress = getOfficialKyraTokenAddress();
  if (officialTokenAddress !== null && value === officialTokenAddress) {
    return {
      address: officialTokenAddress,
      symbol: kyraTokenSymbol,
      decimals: kyraTokenDecimals,
      maxSellAmountAtomic: kyraSwapMaxSellAmountAtomic,
    };
  }
  return null;
}

function readChecksummedAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== "string" || !isAddress(value, { strict: true })) {
    return null;
  }
  try {
    const checksummed = getAddress(value);
    return checksummed === value ? checksummed : null;
  } catch {
    return null;
  }
}

function readPositiveAtomicAmount(value: unknown) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/u.test(value)) {
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}
