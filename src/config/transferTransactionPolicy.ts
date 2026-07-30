import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
  parseUnits,
} from "viem";

export const transferTransactionPolicyVersion = 3 as const;
export const kyraTokenAddress =
  "0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1" as const;
export const kyraTokenSymbol = "KYRA" as const;
export const kyraTokenDecimals = 18 as const;
export const nativeTransferMaxAtomic = 5_000_000_000_000_000n;
export const nativeTransferDailyMaxAtomic = 20_000_000_000_000_000n;
export const kyraTransferMaxAtomic = 10_000n * 10n ** 18n;
export const kyraTransferDailyMaxAtomic = 50_000n * 10n ** 18n;

export type TransferAssetKind = "native" | "erc20";

export interface ReviewedTransferTransaction {
  sender: `0x${string}`;
  recipient: `0x${string}`;
  assetKind: TransferAssetKind;
  tokenAddress: `0x${string}` | null;
  tokenSymbol: "ETH" | typeof kyraTokenSymbol;
  tokenDecimals: 18;
  amountAtomic: string;
  valueWei: string;
  data: `0x${string}`;
  policyVersion: typeof transferTransactionPolicyVersion;
}

export type ReviewedTransferResult =
  | { ok: true; transaction: ReviewedTransferTransaction }
  | { ok: false; message: string };

export function createReviewedTransfer(input: {
  sender: string;
  recipient: string;
  assetKind: TransferAssetKind;
  amount: string;
}): ReviewedTransferResult {
  const sender = normalizeChecksummedAddress(input.sender);
  if (!sender) return { ok: false, message: "Connect a valid sender wallet." };

  const recipient = normalizeChecksummedAddress(input.recipient);
  if (!recipient) {
    return {
      ok: false,
      message: "Enter a valid Robinhood Chain recipient address.",
    };
  }
  if (sender === recipient) {
    return {
      ok: false,
      message: "Recipient must be different from the connected wallet.",
    };
  }

  const decimals = 18;
  let amountAtomic: bigint;
  try {
    amountAtomic = parseUnits(input.amount.trim(), decimals);
  } catch {
    return { ok: false, message: "Enter a valid positive transfer amount." };
  }
  if (amountAtomic <= 0n) {
    return { ok: false, message: "Transfer amount must be greater than zero." };
  }

  if (input.assetKind === "native") {
    if (amountAtomic > nativeTransferMaxAtomic) {
      return {
        ok: false,
        message: "Native transfer exceeds the 0.005 ETH action limit.",
      };
    }
    return {
      ok: true,
      transaction: {
        sender,
        recipient,
        assetKind: "native",
        tokenAddress: null,
        tokenSymbol: "ETH",
        tokenDecimals: decimals,
        amountAtomic: amountAtomic.toString(),
        valueWei: amountAtomic.toString(),
        data: "0x",
        policyVersion: transferTransactionPolicyVersion,
      },
    };
  }

  if (amountAtomic > kyraTransferMaxAtomic) {
    return {
      ok: false,
      message: "KYRA transfer exceeds the 10,000 KYRA action limit.",
    };
  }
  const data = encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient, amountAtomic],
  }).toLowerCase() as `0x${string}`;
  return {
    ok: true,
    transaction: {
      sender,
      recipient,
      assetKind: "erc20",
      tokenAddress: kyraTokenAddress,
      tokenSymbol: kyraTokenSymbol,
      tokenDecimals: kyraTokenDecimals,
      amountAtomic: amountAtomic.toString(),
      valueWei: "0",
      data,
      policyVersion: transferTransactionPolicyVersion,
    },
  };
}

function normalizeChecksummedAddress(value: string): `0x${string}` | null {
  if (!isAddress(value, { strict: true })) return null;
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}
