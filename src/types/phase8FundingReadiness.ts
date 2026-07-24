import {
  currentGasDisplayName,
  currentProductChain,
  currentWalletDisplayName,
} from "../config/productChains";

export type Phase8FundingReadinessStatus =
  | "wallet_required"
  | "address_required"
  | "checking"
  | "unavailable"
  | "empty"
  | "funded";

export interface Phase8FundingReadinessInput {
  walletConnected: boolean;
  ownerWalletAddress: `0x${string}` | null;
  isLoading: boolean;
  isError: boolean;
  value: bigint | null;
  networkName?: string;
  walletDisplayName?: string;
  gasDisplayName?: string;
}

export interface Phase8FundingReadinessResult {
  status: Phase8FundingReadinessStatus;
  label: string;
  message: string;
  ownerAction: string;
  canOpenSubmitter: boolean;
  privacyBoundary: string;
}

export function evaluatePhase8FundingReadiness(
  input: Phase8FundingReadinessInput,
): Phase8FundingReadinessResult {
  const networkName = input.networkName ?? currentProductChain.name;
  const walletDisplayName = input.walletDisplayName ?? currentWalletDisplayName;
  const gasDisplayName = input.gasDisplayName ?? currentGasDisplayName;

  if (!input.walletConnected) {
    return createResult({
      status: "wallet_required",
      label: "wallet required",
      message: `Connect the owner ${walletDisplayName} before checking gas readiness.`,
      ownerAction: `Connect the owner ${walletDisplayName} from the private dashboard.`,
      canOpenSubmitter: false,
    });
  }

  if (!input.ownerWalletAddress) {
    return createResult({
      status: "address_required",
      label: "address required",
      message: `Kyra needs the owner ${walletDisplayName} address before checking gas readiness.`,
      ownerAction: `Reconnect ${walletDisplayName} so Kyra can read the owner address.`,
      canOpenSubmitter: false,
    });
  }

  if (input.isLoading) {
    return createResult({
      status: "checking",
      label: "checking",
      message: `Checking native ETH gas balance on ${networkName} before opening the submit prompt.`,
      ownerAction: `Wait for the ${gasDisplayName} balance check to finish.`,
      canOpenSubmitter: false,
    });
  }

  if (input.isError || input.value === null) {
    return createResult({
      status: "unavailable",
      label: "check failed",
      message: `Kyra could not verify ${gasDisplayName} gas readiness. Retry after the wallet connection refreshes.`,
      ownerAction: "Refresh the wallet connection before submitting.",
      canOpenSubmitter: false,
    });
  }

  if (input.value <= 0n) {
    return createResult({
      status: "empty",
      label: "0 ETH",
      message: `Add native ETH on ${networkName} to the connected ${walletDisplayName} before submitting. The transaction is zero-value, but gas still requires ETH.`,
      ownerAction: `Fund the connected ${walletDisplayName} with ${gasDisplayName}, then refresh the dashboard.`,
      canOpenSubmitter: false,
    });
  }

  return createResult({
    status: "funded",
    label: `${formatPhase8NativeEth(input.value)} ETH`,
    message: `${gasDisplayName} gas balance is present for the owner-controlled submit.`,
    ownerAction: "No funding action is required before the controlled submit.",
    canOpenSubmitter: true,
  });
}

export function formatPhase8NativeEth(value: bigint) {
  const whole = value / 1_000_000_000_000_000_000n;
  const fractional = value % 1_000_000_000_000_000_000n;
  const fractionText = fractional.toString().padStart(18, "0").slice(0, 6).replace(/0+$/u, "");
  return fractionText ? `${whole}.${fractionText}` : whole.toString();
}

function createResult(
  input: Omit<Phase8FundingReadinessResult, "privacyBoundary">,
): Phase8FundingReadinessResult {
  return {
    ...input,
    privacyBoundary:
      "Funding guidance is owner-dashboard only. Kyra never stores private keys, never requests seed phrases, and never asks Telegram or public profiles to fund or submit.",
  };
}
