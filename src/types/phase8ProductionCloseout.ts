export type Phase8ProductionCloseoutStatus =
  | "blocked"
  | "ready_for_owner_run"
  | "receipt_pending"
  | "complete";

export type Phase8ProductionCloseoutReason =
  | "owner_flow_required"
  | "security_hardening_required"
  | "low_value_readiness_required"
  | "submit_request_required"
  | "receipt_pending"
  | "receipt_failed"
  | "owner_closeout_required"
  | "public_execution_forbidden"
  | "telegram_execution_forbidden";

export interface Phase8ProductionCloseoutInput {
  userFlowStatus: "blocked" | "ready_to_start" | "in_progress" | "ready_to_submit" | "submitted" | "verifying" | "confirmed" | "failed";
  securityStatus: "blocked" | "ready_for_hardening" | "hardened" | "failed_safe";
  lowValueReadinessReady: boolean;
  submitRequestReady: boolean;
  transactionVerificationStatus: "not_started" | "pending_receipt" | "confirmed" | "failed" | "blocked";
  ownerCloseoutReady: boolean;
  publicExecutionEnabled: boolean;
  telegramExecutionEnabled: boolean;
}

export interface Phase8ProductionCloseoutChecklistItem {
  label: string;
  status: "pass" | "pending" | "blocked";
  detail: string;
}

export interface Phase8ProductionCloseoutResult {
  status: Phase8ProductionCloseoutStatus;
  ownerOnly: true;
  phase8ImplementationClosed: boolean;
  canContinueToPhase9: boolean;
  reasons: Phase8ProductionCloseoutReason[];
  checklist: Phase8ProductionCloseoutChecklistItem[];
  message: string;
}

export function evaluatePhase8ProductionCloseout(
  input: Phase8ProductionCloseoutInput,
): Phase8ProductionCloseoutResult {
  const reasons: Phase8ProductionCloseoutReason[] = [];

  if (input.publicExecutionEnabled) {
    reasons.push("public_execution_forbidden");
  }

  if (input.telegramExecutionEnabled) {
    reasons.push("telegram_execution_forbidden");
  }

  if (input.userFlowStatus === "blocked" || input.userFlowStatus === "failed") {
    reasons.push("owner_flow_required");
  }

  if (input.securityStatus !== "hardened") {
    reasons.push("security_hardening_required");
  }

  if (!input.lowValueReadinessReady) {
    reasons.push("low_value_readiness_required");
  }

  if (!input.submitRequestReady) {
    reasons.push("submit_request_required");
  }

  if (input.transactionVerificationStatus === "pending_receipt") {
    reasons.push("receipt_pending");
  }

  if (
    input.transactionVerificationStatus === "failed" ||
    input.transactionVerificationStatus === "blocked"
  ) {
    reasons.push("receipt_failed");
  }

  if (input.transactionVerificationStatus === "confirmed" && !input.ownerCloseoutReady) {
    reasons.push("owner_closeout_required");
  }

  const uniqueReasons = [...new Set(reasons)];
  const status = resolveStatus(input, uniqueReasons);

  return {
    status,
    ownerOnly: true,
    phase8ImplementationClosed: status === "ready_for_owner_run" || status === "complete",
    canContinueToPhase9: status === "ready_for_owner_run" || status === "complete",
    reasons: uniqueReasons,
    checklist: buildChecklist(input, uniqueReasons),
    message: getMessage(status),
  };
}

function resolveStatus(
  input: Phase8ProductionCloseoutInput,
  reasons: Phase8ProductionCloseoutReason[],
): Phase8ProductionCloseoutStatus {
  if (reasons.includes("public_execution_forbidden") || reasons.includes("telegram_execution_forbidden")) {
    return "blocked";
  }

  if (reasons.includes("receipt_failed")) {
    return "blocked";
  }

  if (reasons.includes("receipt_pending")) {
    return "receipt_pending";
  }

  if (input.transactionVerificationStatus === "confirmed" && input.ownerCloseoutReady && reasons.length === 0) {
    return "complete";
  }

  const implementationOnlyReasons = reasons.filter((reason) =>
    reason !== "owner_closeout_required",
  );

  return implementationOnlyReasons.length === 0 ? "ready_for_owner_run" : "blocked";
}

function buildChecklist(
  input: Phase8ProductionCloseoutInput,
  reasons: Phase8ProductionCloseoutReason[],
): Phase8ProductionCloseoutChecklistItem[] {
  return [
    {
      label: "Owner flow",
      status: reasons.includes("owner_flow_required") ? "blocked" : "pass",
      detail: "Owner session, agent, Base Account, prepared action, approval, submitter, receipt, and closeout are mapped.",
    },
    {
      label: "Security hardening",
      status: reasons.includes("security_hardening_required") ? "blocked" : "pass",
      detail: "Replay, double-submit, public, Telegram, calldata, swap, and token approval boundaries are enforced.",
    },
    {
      label: "Low-value readiness",
      status: reasons.includes("low_value_readiness_required") || reasons.includes("submit_request_required") ? "blocked" : "pass",
      detail: "The only executable shape is the capped owner-controlled Base ETH transfer.",
    },
    {
      label: "Receipt path",
      status: input.transactionVerificationStatus === "confirmed" ? "pass" : input.transactionVerificationStatus === "pending_receipt" ? "pending" : "pending",
      detail: "Provider hash is not final proof; Base receipt verification closes the run.",
    },
    {
      label: "Owner closeout",
      status: reasons.includes("owner_closeout_required") ? "pending" : input.ownerCloseoutReady ? "pass" : "pending",
      detail: "Sanitized owner-only result remains private and auditable.",
    },
    {
      label: "Public/Telegram boundary",
      status: input.publicExecutionEnabled || input.telegramExecutionEnabled ? "blocked" : "pass",
      detail: "Public profiles and Telegram cannot start, inspect, approve, or execute Phase 8 transactions.",
    },
  ];
}

function getMessage(status: Phase8ProductionCloseoutStatus) {
  switch (status) {
    case "ready_for_owner_run":
      return "Phase 8 implementation is closed and ready for a funded owner-controlled run; public execution stays Phase 9.";
    case "receipt_pending":
      return "Phase 8 closeout is waiting for Base receipt verification.";
    case "complete":
      return "Phase 8 controlled live transaction is complete with owner-only verified closeout.";
    case "blocked":
      return "Phase 8 production closeout is blocked by a required safety or owner-only gate.";
  }
}