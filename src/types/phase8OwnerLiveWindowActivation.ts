import type { Phase8ControlledSubmissionResult } from "./phase8ControlledSubmission";

export type Phase8OwnerLiveWindowActivationStatus = "locked" | "ready";

export type Phase8OwnerLiveWindowActivationBlockReason =
  | "runtime_window_disabled"
  | "controlled_submission_required"
  | "operator_ack_required"
  | "rollback_required"
  | "emergency_disable_required"
  | "post_transaction_audit_required"
  | "owner_dashboard_required";

export interface Phase8OwnerLiveWindowActivationInput {
  runtimeWindowEnabled: boolean;
  controlledSubmission: Phase8ControlledSubmissionResult;
  operatorAcknowledged: boolean;
  rollbackReady: boolean;
  emergencyDisableReady: boolean;
  postTransactionAuditReady: boolean;
  ownerDashboardSource: boolean;
}

export interface Phase8OwnerLiveWindowActivationResult {
  status: Phase8OwnerLiveWindowActivationStatus;
  ownerOnly: true;
  transactionSubmissionAllowed: boolean;
  reasons: Phase8OwnerLiveWindowActivationBlockReason[];
  message: string;
}

const blockMessages: Record<Phase8OwnerLiveWindowActivationBlockReason, string> = {
  runtime_window_disabled:
    "Phase 8 live-window runtime is disabled until the owner explicitly opens the controlled window.",
  controlled_submission_required:
    "Controlled submission must be ready before the live-window activation can arm the submitter.",
  operator_ack_required:
    "The owner operator must acknowledge the exact agent, action, Base Account, and rollback plan.",
  rollback_required: "Rollback readiness is required before live-window activation.",
  emergency_disable_required:
    "Emergency disablement readiness is required before live-window activation.",
  post_transaction_audit_required:
    "Post-transaction audit readiness is required before live-window activation.",
  owner_dashboard_required:
    "Live-window activation must come from the private owner dashboard only.",
};

export function evaluatePhase8OwnerLiveWindowActivation(
  input: Phase8OwnerLiveWindowActivationInput,
): Phase8OwnerLiveWindowActivationResult {
  const reasons: Phase8OwnerLiveWindowActivationBlockReason[] = [];

  if (!input.runtimeWindowEnabled) {
    reasons.push("runtime_window_disabled");
  }

  if (
    !input.controlledSubmission.transactionSubmissionAllowed ||
    input.controlledSubmission.status !== "ready_to_submit" ||
    input.controlledSubmission.reasons.length > 0
  ) {
    reasons.push("controlled_submission_required");
  }

  if (!input.operatorAcknowledged) {
    reasons.push("operator_ack_required");
  }

  if (!input.rollbackReady) {
    reasons.push("rollback_required");
  }

  if (!input.emergencyDisableReady) {
    reasons.push("emergency_disable_required");
  }

  if (!input.postTransactionAuditReady) {
    reasons.push("post_transaction_audit_required");
  }

  if (!input.ownerDashboardSource) {
    reasons.push("owner_dashboard_required");
  }

  const uniqueReasons = [...new Set(reasons)];

  if (uniqueReasons.length > 0) {
    return {
      status: "locked",
      ownerOnly: true,
      transactionSubmissionAllowed: false,
      reasons: uniqueReasons,
      message: blockMessages[uniqueReasons[0]],
    };
  }

  return {
    status: "ready",
    ownerOnly: true,
    transactionSubmissionAllowed: true,
    reasons: [],
    message:
      "Phase 8 Batch 6 live window is armed for one owner-controlled Base submit.",
  };
}

export function getPhase8OwnerLiveWindowActivationBlockMessage(
  reason: Phase8OwnerLiveWindowActivationBlockReason,
) {
  return blockMessages[reason];
}
