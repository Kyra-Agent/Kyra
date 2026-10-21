import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
} from "npm:viem@2.57.7";
import {
  robinhoodMainnetChainId,
  robinhoodMainnetChainKey,
} from "./transfer-transaction-policy.ts";
import { usdgTokenAddress } from "./swap-quote-policy.ts";
import { uniswapSwapRouter02Address } from "./uniswap-robinhood.ts";

export const swapExecutionPolicyVersion = 2 as const;
export const swapExecutionIntentLifetimeMs = 10 * 60 * 1000;
export const swapExecutionSteps = [
  "allowance_set",
  "swap",
  "allowance_revoke",
] as const;

export type SwapExecutionStep = typeof swapExecutionSteps[number];

export interface SwapExecutionTransaction {
  chainKey: typeof robinhoodMainnetChainKey;
  chainId: typeof robinhoodMainnetChainId;
  to: `0x${string}`;
  data: `0x${string}`;
  valueWei: string;
  tokenAddress: `0x${string}` | null;
  spenderAddress: `0x${string}` | null;
  allowanceAmountAtomic: string | null;
}

export function createExactAllowanceTransaction(input: {
  tokenAddress: unknown;
  spenderAddress: unknown;
  amountAtomic: unknown;
}): SwapExecutionTransaction | null {
  const tokenAddress = readAddress(input.tokenAddress);
  const spenderAddress = readAddress(input.spenderAddress);
  const amount = readAtomicAmount(input.amountAtomic);
  // USDG is the only token a swap sells besides native ETH, and only the
  // Uniswap router may spend it.
  if (
    tokenAddress?.toLowerCase() !== usdgTokenAddress.toLowerCase() ||
    spenderAddress?.toLowerCase() !== uniswapSwapRouter02Address.toLowerCase() ||
    amount === null
  ) {
    return null;
  }

  return {
    chainKey: robinhoodMainnetChainKey,
    chainId: robinhoodMainnetChainId,
    to: tokenAddress,
    data: encodeFunctionData({
      abi: erc20Abi,
      functionName: "approve",
      args: [spenderAddress, amount],
    }),
    valueWei: "0",
    tokenAddress,
    spenderAddress,
    allowanceAmountAtomic: amount.toString(),
  };
}

export function readAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== "string" || !isAddress(value, { strict: false })) {
    return null;
  }
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

function readAtomicAmount(value: unknown) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}
