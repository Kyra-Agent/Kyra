export type Phase8FundingReadinessStatus =
  | "wallet_required"
  | "address_required"
  | "checking"
  | "unavailable"
  | "empty"
  | "funded";

export interface Phase8FundingReadinessInput {
  walletConnected: boolean;
  baseAccountAddress: `0x${string}` | null;
  isLoading: boolean;
  isError: boolean;
  value: bigint | null;
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
  if (!input.walletConnected) {
    return createResult({
      status: "wallet_required",
      label: "wallet required",
      message: "Connect the owner Base Account before checking gas readiness.",
      ownerAction: "Connect the owner Base Account from the private dashboard.",
      canOpenSubmitter: false,
    });
  }

  if (!input.baseAccountAddress) {
    return createResult({
      status: "address_required",
      label: "address required",
      message: "Kyra needs the owner Base Account address before checking gas readiness.",
      ownerAction: "Reconnect the Base Account so Kyra can read the owner address.",
      canOpenSubmitter: false,
    });
  }

  if (input.isLoading) {
    return createResult({
      status: "checking",
      label: "checking",
      message: "Checking native ETH gas balance on Base before opening the submit prompt.",
      ownerAction: "Wait for the Base ETH balance check to finish.",
      canOpenSubmitter: false,
    });
  }

  if (input.isError || input.value === null) {
    return createResult({
      status: "unavailable",
      label: "check failed",
      message: "Kyra could not verify Base ETH gas readiness. Retry after the wallet connection refreshes.",
      ownerAction: "Refresh the wallet connection before submitting.",
      canOpenSubmitter: false,
    });
  }

  if (input.value <= 0n) {
    return createResult({
      status: "empty",
      label: "0 ETH",
      message: "Add native ETH on Base to the connected Base Account before submitting. The transaction is zero-value, but gas still requires ETH.",
      ownerAction: "Fund the connected Base Account with Base ETH, then refresh the dashboard.",
      canOpenSubmitter: false,
    });
  }

  return createResult({
    status: "funded",
    label: `${formatPhase8BaseEth(input.value)} ETH`,
    message: "Base ETH gas balance is present for the owner-controlled submit.",
    ownerAction: "No funding action is required before the controlled submit.",
    canOpenSubmitter: true,
  });
}

export function formatPhase8BaseEth(value: bigint) {
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
