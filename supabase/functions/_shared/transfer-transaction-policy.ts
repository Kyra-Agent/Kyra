import {
  encodeFunctionData,
  erc20Abi,
  getAddress,
  isAddress,
} from "npm:viem@2.52.2";

export const transferTransactionPolicyVersion = 3 as const;
export const robinhoodMainnetChainKey = "robinhood_mainnet" as const;
export const robinhoodMainnetChainId = 4663 as const;

export const kyraTokenAddress =
  "0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1" as const;
export const kyraTokenSymbol = "KYRA" as const;
export const kyraTokenDecimals = 18 as const;

export const nativeTransferMaxAtomic = 5_000_000_000_000_000n;
export const nativeTransferDailyMaxAtomic = 20_000_000_000_000_000n;
export const kyraTransferMaxAtomic = 10_000n * 10n ** 18n;
export const kyraTransferDailyMaxAtomic = 50_000n * 10n ** 18n;

export type TransferAssetKind = "native" | "erc20";

export interface TransferTransactionShape {
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

export type TransferPolicyError =
  | "invalid_sender"
  | "invalid_recipient"
  | "self_transfer_not_allowed"
  | "unsupported_asset"
  | "invalid_amount"
  | "action_limit_exceeded"
  | "transaction_shape_mismatch";

export type TransferPolicyResult =
  | { ok: true; transaction: TransferTransactionShape }
  | { ok: false; error: TransferPolicyError };

export function createTransferTransactionShape(input: {
  sender: unknown;
  recipient: unknown;
  assetKind: unknown;
  tokenAddress: unknown;
  tokenSymbol: unknown;
  tokenDecimals: unknown;
  amountAtomic: unknown;
  valueWei: unknown;
  data: unknown;
  policyVersion: unknown;
}): TransferPolicyResult {
  const sender = readChecksummedAddress(input.sender);
  if (!sender) return { ok: false, error: "invalid_sender" };

  const recipient = readChecksummedAddress(input.recipient);
  if (!recipient) return { ok: false, error: "invalid_recipient" };
  if (sender === recipient) {
    return { ok: false, error: "self_transfer_not_allowed" };
  }

  if (
    input.policyVersion !== transferTransactionPolicyVersion ||
    (input.assetKind !== "native" && input.assetKind !== "erc20")
  ) {
    return { ok: false, error: "unsupported_asset" };
  }

  const amount = readPositiveAtomicAmount(input.amountAtomic);
  if (amount === null) return { ok: false, error: "invalid_amount" };

  if (input.assetKind === "native") {
    if (amount > nativeTransferMaxAtomic) {
      return { ok: false, error: "action_limit_exceeded" };
    }
    if (
      input.tokenAddress !== null ||
      input.tokenSymbol !== "ETH" ||
      input.tokenDecimals !== 18 ||
      input.valueWei !== amount.toString() ||
      input.data !== "0x"
    ) {
      return { ok: false, error: "transaction_shape_mismatch" };
    }

    return {
      ok: true,
      transaction: {
        sender,
        recipient,
        assetKind: "native",
        tokenAddress: null,
        tokenSymbol: "ETH",
        tokenDecimals: 18,
        amountAtomic: amount.toString(),
        valueWei: amount.toString(),
        data: "0x",
        policyVersion: transferTransactionPolicyVersion,
      },
    };
  }

  if (
    input.tokenAddress !== kyraTokenAddress ||
    input.tokenSymbol !== kyraTokenSymbol ||
    input.tokenDecimals !== kyraTokenDecimals
  ) {
    return { ok: false, error: "unsupported_asset" };
  }
  if (amount > kyraTransferMaxAtomic) {
    return { ok: false, error: "action_limit_exceeded" };
  }

  const expectedData = encodeKyraTransferData(recipient, amount);
  if (input.valueWei !== "0" || input.data !== expectedData) {
    return { ok: false, error: "transaction_shape_mismatch" };
  }

  return {
    ok: true,
    transaction: {
      sender,
      recipient,
      assetKind: "erc20",
      tokenAddress: kyraTokenAddress,
      tokenSymbol: kyraTokenSymbol,
      tokenDecimals: kyraTokenDecimals,
      amountAtomic: amount.toString(),
      valueWei: "0",
      data: expectedData,
      policyVersion: transferTransactionPolicyVersion,
    },
  };
}

export function encodeKyraTransferData(
  recipient: `0x${string}`,
  amountAtomic: bigint,
) {
  return encodeFunctionData({
    abi: erc20Abi,
    functionName: "transfer",
    args: [recipient, amountAtomic],
  }).toLowerCase() as `0x${string}`;
}

export function getTransferDailyLimit(assetKind: TransferAssetKind) {
  return assetKind === "native"
    ? nativeTransferDailyMaxAtomic
    : kyraTransferDailyMaxAtomic;
}

export function readChecksummedAddress(value: unknown): `0x${string}` | null {
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
