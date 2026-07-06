export type Phase9IncidentControlStatus =
  | "blocked"
  | "ready_for_runtime"
  | "armed";

export type Phase9IncidentControlReason =
  | "abuse_hardening_required"
  | "runtime_disabled"
  | "emergency_disable_required"
  | "rollback_runbook_required"
  | "manual_recovery_required"
  | "go_no_go_required"
  | "rejected_prompt_handler_required"
  | "insufficient_gas_handler_required"
  | "reverted_transaction_handler_required"
  | "provider_outage_handler_required"
  | "chain_mismatch_handler_required"
  | "stale_approval_handler_required"
  | "stale_action_handler_required"
  | "stuck_receipt_handler_required"
  | "post_incident_audit_required"
  | "owner_only_audit_required"
  | "unsanitized_incident_forbidden"
  | "public_incident_visibility_forbidden"
  | "telegram_incident_authority_forbidden";

export interface Phase9IncidentControlInput {
  abuseCanProceed: boolean;
  phase9RuntimeEnabled: boolean;
  emergencyDisableReady: boolean;
  rollbackRunbookReady: boolean;
  manualRecoveryReady: boolean;
  goNoGoRulesReady: boolean;
  rejectedPromptHandled: boolean;
  insufficientGasHandled: boolean;
  revertedTransactionHandled: boolean;
  providerOutageHandled: boolean;
  chainMismatchHandled: boolean;
  staleApprovalHandled: boolean;
  staleActionHandled: boolean;
  stuckReceiptHandled: boolean;
  postIncidentAuditReady: boolean;
  ownerOnlyAudit: boolean;
  sanitizedIncidentEvidence: boolean;
  visibleInPublicProfile: boolean;
  telegramCanControlIncident: boolean;
}

export interface Phase9IncidentControlItem {
  label: string;
  status: "pass" | "pending" | "blocked";
  detail: string;
}

export interface Phase9IncidentControlResult {
  status: Phase9IncidentControlStatus;
  ownerOnly: true;
  emergencyDisableArmed: boolean;
  rollbackReady: boolean;
  canProceedToMonitoring: boolean;
  publicExecutionAllowed: boolean;
  reasons: Phase9IncidentControlReason[];
  controls: Phase9IncidentControlItem[];
  message: string;
}

export function evaluatePhase9IncidentControls(
  input: Phase9IncidentControlInput,
): Phase9IncidentControlResult {
  const reasons: Phase9IncidentControlReason[] = [];

  if (!input.abuseCanProceed) reasons.push("abuse_hardening_required");
  if (!input.phase9RuntimeEnabled) reasons.push("runtime_disabled");
  if (!input.emergencyDisableReady) reasons.push("emergency_disable_required");
  if (!input.rollbackRunbookReady) reasons.push("rollback_runbook_required");
  if (!input.manualRecoveryReady) reasons.push("manual_recovery_required");
  if (!input.goNoGoRulesReady) reasons.push("go_no_go_required");
  if (!input.rejectedPromptHandled) reasons.push("rejected_prompt_handler_required");
  if (!input.insufficientGasHandled) reasons.push("insufficient_gas_handler_required");
  if (!input.revertedTransactionHandled) reasons.push("reverted_transaction_handler_required");
  if (!input.providerOutageHandled) reasons.push("provider_outage_handler_required");
  if (!input.chainMismatchHandled) reasons.push("chain_mismatch_handler_required");
  if (!input.staleApprovalHandled) reasons.push("stale_approval_handler_required");
  if (!input.staleActionHandled) reasons.push("stale_action_handler_required");
  if (!input.stuckReceiptHandled) reasons.push("stuck_receipt_handler_required");
  if (!input.postIncidentAuditReady) reasons.push("post_incident_audit_required");
  if (!input.ownerOnlyAudit) reasons.push("owner_only_audit_required");
  if (!input.sanitizedIncidentEvidence) reasons.push("unsanitized_incident_forbidden");
  if (input.visibleInPublicProfile) reasons.push("public_incident_visibility_forbidden");
  if (input.telegramCanControlIncident) reasons.push("telegram_incident_authority_forbidden");

  const uniqueReasons = [...new Set(reasons)];
  const blockingWithoutRuntime = uniqueReasons.filter((reason) => reason !== "runtime_disabled");
  const publicExecutionAllowed = uniqueReasons.length === 0;

  return {
    status: resolveStatus(uniqueReasons, blockingWithoutRuntime),
    ownerOnly: true,
    emergencyDisableArmed: input.emergencyDisableReady && !input.visibleInPublicProfile && !input.telegramCanControlIncident,
    rollbackReady: input.rollbackRunbookReady && input.manualRecoveryReady && input.goNoGoRulesReady,
    canProceedToMonitoring: blockingWithoutRuntime.length === 0,
    publicExecutionAllowed,
    reasons: uniqueReasons,
    controls: buildControls(input, uniqueReasons),
    message: getMessage(uniqueReasons, blockingWithoutRuntime),
  };
}

function resolveStatus(
  reasons: Phase9IncidentControlReason[],
  blockingWithoutRuntime: Phase9IncidentControlReason[],
): Phase9IncidentControlStatus {
  if (reasons.length === 0) return "armed";
  return blockingWithoutRuntime.length === 0 ? "ready_for_runtime" : "blocked";
}

function buildControls(
  input: Phase9IncidentControlInput,
  reasons: Phase9IncidentControlReason[],
): Phase9IncidentControlItem[] {
  return [
    {
      label: "Abuse gate",
      status: input.abuseCanProceed ? "pass" : "blocked",
      detail: "Batch 9B abuse and rate-limit hardening must be clean first.",
    },
    {
      label: "Emergency disable",
      status: input.emergencyDisableReady ? "pass" : "blocked",
      detail: "Operator-facing disable switch must be ready before public execution.",
    },
    {
      label: "Rollback",
      status: input.rollbackRunbookReady && input.manualRecoveryReady && input.goNoGoRulesReady ? "pass" : "blocked",
      detail: "Rollback runbook, manual recovery, and go/no-go rules are required.",
    },
    {
      label: "Prompt and gas failures",
      status: reasons.some((reason) => ["rejected_prompt_handler_required", "insufficient_gas_handler_required"].includes(reason)) ? "blocked" : "pass",
      detail: "Rejected prompts and insufficient gas must fail closed with owner-safe copy.",
    },
    {
      label: "Provider and chain failures",
      status: reasons.some((reason) => ["reverted_transaction_handler_required", "provider_outage_handler_required", "chain_mismatch_handler_required"].includes(reason)) ? "blocked" : "pass",
      detail: "Reverts, provider outage, and chain mismatch must fail closed.",
    },
    {
      label: "Stale state",
      status: reasons.some((reason) => ["stale_approval_handler_required", "stale_action_handler_required", "stuck_receipt_handler_required"].includes(reason)) ? "blocked" : "pass",
      detail: "Stale approval, stale action, and stuck receipt states must not keep execution open.",
    },
    {
      label: "Post-incident audit",
      status: input.postIncidentAuditReady && input.ownerOnlyAudit && input.sanitizedIncidentEvidence ? "pass" : "blocked",
      detail: "Post-incident records must be sanitized and owner-only.",
    },
    {
      label: "Surface boundary",
      status: input.visibleInPublicProfile || input.telegramCanControlIncident ? "blocked" : "pass",
      detail: "Public profiles and Telegram cannot control incident state.",
    },
    {
      label: "Runtime",
      status: input.phase9RuntimeEnabled ? "pass" : "pending",
      detail: "Public execution runtime remains disabled until explicit release approval.",
    },
  ];
}

function getMessage(
  reasons: Phase9IncidentControlReason[],
  blockingWithoutRuntime: Phase9IncidentControlReason[],
) {
  if (reasons.length === 0) {
    return "Incident, rollback, and emergency controls are armed for the approved release lane.";
  }

  if (blockingWithoutRuntime.length === 0) {
    return "Incident controls are structurally ready, but runtime remains disabled.";
  }

  return "Incident controls are waiting on required safety checks.";
}