export type Phase8LowValueTransactionReadinessStatus =
  | "ready_for_low_value_review"
  | "blocked";

export type Phase8LowValueTransactionReadinessReason =
  | "owner_session_required"
  | "private_dashboard_required"
  | "agent_required"
  | "base_account_required"
  | "base_chain_required"
  | "prepared_action_required"
  | "owner_approval_required"
  | "value_required"
  | "value_cap_exceeded"
  | "gas_estimate_required"
  | "gas_balance_required"
  | "calldata_forbidden"
  | "token_approval_forbidden"
  | "swap_forbidden"
  | "telegram_forbidden"
  | "public_profile_forbidden";

export interface Phase8LowValueTransactionReadinessInput {
  ownerSignedIn: boolean;
  privateDashboard: boolean;
  selectedAgent: boolean;
  baseAccountConnected: boolean;
  chainId: number | null | undefined;
  preparedActionId: string | null | undefined;
  ownerApprovalRecorded: boolean;
  requestedValueWei: string | null | undefined;
  estimatedGasFeeWei: string | null | undefined;
  availableGasBalanceWei: string | null | undefined;
  data: string | null | undefined;
  includesTokenApproval: boolean;
  includesSwap: boolean;
  requestedFromTelegram: boolean;
  visibleInPublicProfile: boolean;
}

export interface Phase8LowValueTransactionReadinessResult {
  status: Phase8LowValueTransactionReadinessStatus;
  canEnterLowValueReview: boolean;
  maxValueWei: "100000000000000";
  maxValueLabel: "0.0001 ETH";
  requiredBalanceWei: string;
  reasons: Phase8LowValueTransactionReadinessReason[];
  message: string;
}

const baseChainId = 8453;
const maxLowValueWei = 100_000_000_000_000n;

const blockMessages: Record<Phase8LowValueTransactionReadinessReason, string> = {
  owner_session_required:
    "A signed-in owner session is required before low-value transaction review.",
  private_dashboard_required:
    "Low-value transaction review is restricted to the private owner dashboard.",
  agent_required:
    "A selected deployed agent is required before low-value transaction review.",
  base_account_required:
    "A connected Base Account is required before low-value transaction review.",
  base_chain_required:
    "Low-value transaction review is restricted to Base.",
  prepared_action_required:
    "A reviewed prepared action is required before low-value transaction review.",
  owner_approval_required:
    "Explicit owner approval is required before low-value transaction review.",
  value_required:
    "A positive transaction value is required for low-value transaction review.",
  value_cap_exceeded:
    "Requested value exceeds the Phase 8 low-value cap.",
  gas_estimate_required:
    "A gas estimate is required before low-value transaction review.",
  gas_balance_required:
    "The connected Base Account needs enough Base ETH for value plus gas.",
  calldata_forbidden:
    "Calldata remains disabled for the low-value readiness gate.",
  token_approval_forbidden:
    "Token approvals remain disabled for the low-value readiness gate.",
  swap_forbidden:
    "Swaps remain disabled for the low-value readiness gate.",
  telegram_forbidden:
    "Telegram cannot request, approve, or submit low-value transactions.",
  public_profile_forbidden:
    "Public profiles cannot expose or trigger low-value transactions.",
};

export function evaluatePhase8LowValueTransactionReadiness(
  input: Phase8LowValueTransactionReadinessInput,
): Phase8LowValueTransactionReadinessResult {
  const reasons: Phase8LowValueTransactionReadinessReason[] = [];
  const requestedValue = parseNonNegativeWei(input.requestedValueWei);
  const estimatedGasFee = parseNonNegativeWei(input.estimatedGasFeeWei);
  const availableGasBalance = parseNonNegativeWei(input.availableGasBalanceWei);

  if (!input.ownerSignedIn) reasons.push("owner_session_required");
  if (!input.privateDashboard) reasons.push("private_dashboard_required");
  if (!input.selectedAgent) reasons.push("agent_required");
  if (!input.baseAccountConnected) reasons.push("base_account_required");
  if (input.chainId !== baseChainId) reasons.push("base_chain_required");
  if (!input.preparedActionId?.trim()) reasons.push("prepared_action_required");
  if (!input.ownerApprovalRecorded) reasons.push("owner_approval_required");
  if (requestedValue === null || requestedValue <= 0n) reasons.push("value_required");
  if (requestedValue !== null && requestedValue > maxLowValueWei) {
    reasons.push("value_cap_exceeded");
  }
  if (estimatedGasFee === null || estimatedGasFee <= 0n) {
    reasons.push("gas_estimate_required");
  }

  const requiredBalance =
    requestedValue !== null && estimatedGasFee !== null
      ? requestedValue + estimatedGasFee
      : 0n;

  if (
    requiredBalance > 0n &&
    (availableGasBalance === null || availableGasBalance < requiredBalance)
  ) {
    reasons.push("gas_balance_required");
  }

  if (normalizeCalldata(input.data) !== "0x") reasons.push("calldata_forbidden");
  if (input.includesTokenApproval) reasons.push("token_approval_forbidden");
  if (input.includesSwap) reasons.push("swap_forbidden");
  if (input.requestedFromTelegram) reasons.push("telegram_forbidden");
  if (input.visibleInPublicProfile) reasons.push("public_profile_forbidden");

  const uniqueReasons = [...new Set(reasons)];

  if (uniqueReasons.length) {
    return {
      status: "blocked",
      canEnterLowValueReview: false,
      maxValueWei: "100000000000000",
      maxValueLabel: "0.0001 ETH",
      requiredBalanceWei: requiredBalance.toString(),
      reasons: uniqueReasons,
      message: blockMessages[uniqueReasons[0]],
    };
  }

  return {
    status: "ready_for_low_value_review",
    canEnterLowValueReview: true,
    maxValueWei: "100000000000000",
    maxValueLabel: "0.0001 ETH",
    requiredBalanceWei: requiredBalance.toString(),
    reasons: [],
    message:
      "Low-value transaction readiness is policy-ready for owner review only. Submit execution is still gated.",
  };
}

export function getPhase8LowValueTransactionReadinessBlockMessage(
  reason: Phase8LowValueTransactionReadinessReason,
) {
  return blockMessages[reason];
}

function parseNonNegativeWei(value: string | null | undefined) {
  if (!value || !/^\d+$/u.test(value)) return null;

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function normalizeCalldata(data: string | null | undefined) {
  return data?.trim().toLowerCase() || "0x";
}
