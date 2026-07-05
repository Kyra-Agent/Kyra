export type Phase8UserSafeTransactionPolicyStatus =
  | "ready_for_owner_review"
  | "blocked";

export type Phase8UserSafeTransactionPolicyReason =
  | "owner_session_required"
  | "private_dashboard_required"
  | "agent_required"
  | "base_account_required"
  | "base_chain_required"
  | "prepared_action_required"
  | "unsupported_action_kind"
  | "non_zero_value_forbidden"
  | "calldata_forbidden"
  | "token_approval_forbidden"
  | "swap_forbidden"
  | "telegram_forbidden"
  | "public_profile_forbidden"
  | "cooldown_required";

export interface Phase8UserSafeTransactionPolicyInput {
  ownerSignedIn: boolean;
  privateDashboard: boolean;
  selectedAgent: boolean;
  baseAccountConnected: boolean;
  chainId: number | null | undefined;
  preparedActionId: string | null | undefined;
  actionKind: string | null | undefined;
  valueWei: string | null | undefined;
  data: string | null | undefined;
  includesTokenApproval: boolean;
  includesSwap: boolean;
  requestedFromTelegram: boolean;
  visibleInPublicProfile: boolean;
  cooldownSatisfied: boolean;
}

export interface Phase8UserSafeTransactionPolicyResult {
  status: Phase8UserSafeTransactionPolicyStatus;
  canEnterOwnerReview: boolean;
  maxValueWei: "0";
  allowedActionKinds: readonly ["base_reviewed_transaction"];
  reasons: Phase8UserSafeTransactionPolicyReason[];
  message: string;
}

const baseChainId = 8453;

const blockMessages: Record<Phase8UserSafeTransactionPolicyReason, string> = {
  owner_session_required:
    "A signed-in owner session is required before user-safe transaction review.",
  private_dashboard_required:
    "User-safe transaction review is restricted to the private owner dashboard.",
  agent_required:
    "A selected deployed agent is required before user-safe transaction review.",
  base_account_required:
    "A connected Base Account is required before user-safe transaction review.",
  base_chain_required:
    "User-safe transaction review is restricted to Base.",
  prepared_action_required:
    "A reviewed prepared action is required before user-safe transaction review.",
  unsupported_action_kind:
    "Only the controlled Base reviewed transaction kind is allowed.",
  non_zero_value_forbidden:
    "Non-zero value remains disabled until the next explicit expansion gate.",
  calldata_forbidden:
    "Calldata remains disabled until the next explicit expansion gate.",
  token_approval_forbidden:
    "Token approvals remain disabled until the next explicit expansion gate.",
  swap_forbidden:
    "Swaps remain disabled until the next explicit expansion gate.",
  telegram_forbidden:
    "Telegram cannot request, approve, or submit user transactions.",
  public_profile_forbidden:
    "Public profiles cannot expose or trigger user transactions.",
  cooldown_required:
    "The owner transaction cooldown must be satisfied before review.",
};

export function evaluatePhase8UserSafeTransactionPolicy(
  input: Phase8UserSafeTransactionPolicyInput,
): Phase8UserSafeTransactionPolicyResult {
  const reasons: Phase8UserSafeTransactionPolicyReason[] = [];

  if (!input.ownerSignedIn) reasons.push("owner_session_required");
  if (!input.privateDashboard) reasons.push("private_dashboard_required");
  if (!input.selectedAgent) reasons.push("agent_required");
  if (!input.baseAccountConnected) reasons.push("base_account_required");
  if (input.chainId !== baseChainId) reasons.push("base_chain_required");
  if (!input.preparedActionId?.trim()) reasons.push("prepared_action_required");
  if (input.actionKind !== "base_reviewed_transaction") {
    reasons.push("unsupported_action_kind");
  }
  if (input.valueWei !== "0") reasons.push("non_zero_value_forbidden");
  if (normalizeCalldata(input.data) !== "0x") reasons.push("calldata_forbidden");
  if (input.includesTokenApproval) reasons.push("token_approval_forbidden");
  if (input.includesSwap) reasons.push("swap_forbidden");
  if (input.requestedFromTelegram) reasons.push("telegram_forbidden");
  if (input.visibleInPublicProfile) reasons.push("public_profile_forbidden");
  if (!input.cooldownSatisfied) reasons.push("cooldown_required");

  const uniqueReasons = [...new Set(reasons)];

  if (uniqueReasons.length) {
    return {
      status: "blocked",
      canEnterOwnerReview: false,
      maxValueWei: "0",
      allowedActionKinds: ["base_reviewed_transaction"],
      reasons: uniqueReasons,
      message: blockMessages[uniqueReasons[0]],
    };
  }

  return {
    status: "ready_for_owner_review",
    canEnterOwnerReview: true,
    maxValueWei: "0",
    allowedActionKinds: ["base_reviewed_transaction"],
    reasons: [],
    message:
      "User-safe transaction policy is ready for owner review under zero-value, no-calldata limits.",
  };
}

export function getPhase8UserSafeTransactionPolicyBlockMessage(
  reason: Phase8UserSafeTransactionPolicyReason,
) {
  return blockMessages[reason];
}

function normalizeCalldata(data: string | null | undefined) {
  return data?.trim().toLowerCase() || "0x";
}
