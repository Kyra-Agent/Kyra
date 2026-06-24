import {
  reviewPreparedActionAllowlist,
  type PreparedActionAllowlistInput,
  type PreparedActionAllowlistResult,
} from "./preparedAction";
import {
  reviewPreparedActionRisk,
  type RiskReviewResult,
} from "./riskReview";

export type PreparedActionPolicyBlockReason =
  | "owner_session_required"
  | "agent_binding_required"
  | "allowlist_rejected"
  | "prepared_action_storage_disabled"
  | "risk_review_blocked"
  | "owner_approval_required";

export type PreparedActionPolicyStatus =
  | "read_only_ready"
  | "owner_review_required"
  | "blocked";

export interface PreparedActionPolicyInput extends PreparedActionAllowlistInput {
  ownerSignedIn: boolean;
  selectedAgent: boolean;
  preparedActionStorageEnabled: boolean;
  ownerApprovalRecorded: boolean;
}

export interface PreparedActionPolicyResult {
  status: PreparedActionPolicyStatus;
  allowedForStorage: boolean;
  allowlist: PreparedActionAllowlistResult;
  riskReview: RiskReviewResult | null;
  reasons: PreparedActionPolicyBlockReason[];
  message: string;
}

const policyBlockMessages: Record<PreparedActionPolicyBlockReason, string> = {
  owner_session_required:
    "A signed-in owner session is required before prepared-action policy review.",
  agent_binding_required:
    "A selected deployed agent is required before prepared-action policy review.",
  allowlist_rejected: "The prepared action failed the deterministic allowlist.",
  prepared_action_storage_disabled:
    "Prepared-action production storage is disabled until the owner-scoped storage gate is enabled.",
  risk_review_blocked: "NYX-05 risk review blocked this prepared action.",
  owner_approval_required:
    "Owner approval is required before any wallet prompt or signing handoff.",
};

export function evaluatePreparedActionPolicy(
  input: PreparedActionPolicyInput,
): PreparedActionPolicyResult {
  const reasons: PreparedActionPolicyBlockReason[] = [];
  const allowlist = reviewPreparedActionAllowlist(input);

  if (!input.ownerSignedIn) {
    reasons.push("owner_session_required");
  }

  if (!input.selectedAgent) {
    reasons.push("agent_binding_required");
  }

  if (!allowlist.allowed || !allowlist.canonical) {
    reasons.push("allowlist_rejected");
  }

  const riskReview = allowlist.canonical
    ? reviewPreparedActionRisk({
      actionKind: allowlist.canonical.actionKind,
      chainId: input.chainId,
      routeSummary: allowlist.canonical.routeSummary,
      valueSummary: allowlist.canonical.valueSummary,
      valueWei: allowlist.canonical.valueWei,
      data: allowlist.canonical.data,
      requiresWallet: allowlist.canonical.requiresWallet,
    })
    : null;

  if (riskReview?.status === "blocked") {
    reasons.push("risk_review_blocked");
  }

  if (allowlist.requiresWallet && !input.preparedActionStorageEnabled) {
    reasons.push("prepared_action_storage_disabled");
  }

  if (allowlist.requiresWallet && !input.ownerApprovalRecorded) {
    reasons.push("owner_approval_required");
  }

  const uniqueReasons = [...new Set(reasons)];

  if (uniqueReasons.length > 0) {
    return {
      status: "blocked",
      allowedForStorage: false,
      allowlist,
      riskReview,
      reasons: uniqueReasons,
      message: policyBlockMessages[uniqueReasons[0]],
    };
  }

  if (!allowlist.requiresWallet) {
    return {
      status: "read_only_ready",
      allowedForStorage: false,
      allowlist,
      riskReview,
      reasons: [],
      message: "Read-only prepared action is policy ready.",
    };
  }

  return {
    status: "owner_review_required",
    allowedForStorage: true,
    allowlist,
    riskReview,
    reasons: [],
    message: "Prepared action passed policy review and requires owner approval.",
  };
}

export function getPreparedActionPolicyBlockMessage(
  reason: PreparedActionPolicyBlockReason,
) {
  return policyBlockMessages[reason];
}
