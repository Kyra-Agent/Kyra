import { evaluatePhase9IncidentControls } from "../src/types/phase9IncidentControls.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const baseInput = {
  abuseCanProceed: true,
  phase9RuntimeEnabled: false,
  emergencyDisableReady: true,
  rollbackRunbookReady: true,
  manualRecoveryReady: true,
  goNoGoRulesReady: true,
  rejectedPromptHandled: true,
  insufficientGasHandled: true,
  revertedTransactionHandled: true,
  providerOutageHandled: true,
  chainMismatchHandled: true,
  staleApprovalHandled: true,
  staleActionHandled: true,
  stuckReceiptHandled: true,
  postIncidentAuditReady: true,
  ownerOnlyAudit: true,
  sanitizedIncidentEvidence: true,
  visibleInPublicProfile: false,
  telegramCanControlIncident: false,
};

const ready = evaluatePhase9IncidentControls(baseInput);
assert(ready.status === "ready_for_runtime", "incident controls should be ready while runtime is disabled");
assert(!ready.publicExecutionAllowed, "disabled runtime must not allow public execution");
assert(ready.canProceedToMonitoring, "clean incident controls should allow Batch 9D work");
assert(ready.emergencyDisableArmed, "emergency disable should be armed structurally");
assert(ready.rollbackReady, "rollback should be ready structurally");
assert(ready.reasons.includes("runtime_disabled"), "runtime disabled reason required");
assert(ready.ownerOnly === true, "incident evidence must stay owner-only");
assert(ready.controls.length >= 9, "incident controls should expose checklist evidence");

const armed = evaluatePhase9IncidentControls({
  ...baseInput,
  phase9RuntimeEnabled: true,
});
assert(armed.status === "armed", "runtime-enabled clean controls should arm");
assert(armed.publicExecutionAllowed, "armed controls can allow public execution lane");
assert(armed.reasons.length === 0, "armed path must have no reasons");

const missingOps = evaluatePhase9IncidentControls({
  ...baseInput,
  phase9RuntimeEnabled: true,
  emergencyDisableReady: false,
  rollbackRunbookReady: false,
  manualRecoveryReady: false,
  goNoGoRulesReady: false,
});
for (const reason of [
  "emergency_disable_required",
  "rollback_runbook_required",
  "manual_recovery_required",
  "go_no_go_required",
]) {
  assert(missingOps.reasons.includes(reason), `${reason} should block`);
}

const failureHandlers = evaluatePhase9IncidentControls({
  ...baseInput,
  phase9RuntimeEnabled: true,
  rejectedPromptHandled: false,
  insufficientGasHandled: false,
  revertedTransactionHandled: false,
  providerOutageHandled: false,
  chainMismatchHandled: false,
  staleApprovalHandled: false,
  staleActionHandled: false,
  stuckReceiptHandled: false,
});
for (const reason of [
  "rejected_prompt_handler_required",
  "insufficient_gas_handler_required",
  "reverted_transaction_handler_required",
  "provider_outage_handler_required",
  "chain_mismatch_handler_required",
  "stale_approval_handler_required",
  "stale_action_handler_required",
  "stuck_receipt_handler_required",
]) {
  assert(failureHandlers.reasons.includes(reason), `${reason} should block`);
}

const unsafeAudit = evaluatePhase9IncidentControls({
  ...baseInput,
  phase9RuntimeEnabled: true,
  postIncidentAuditReady: false,
  ownerOnlyAudit: false,
  sanitizedIncidentEvidence: false,
});
assert(unsafeAudit.reasons.includes("post_incident_audit_required"), "post-incident audit required");
assert(unsafeAudit.reasons.includes("owner_only_audit_required"), "owner-only audit required");
assert(unsafeAudit.reasons.includes("unsanitized_incident_forbidden"), "unsanitized incident evidence forbidden");

const publicIncident = evaluatePhase9IncidentControls({
  ...baseInput,
  phase9RuntimeEnabled: true,
  visibleInPublicProfile: true,
  telegramCanControlIncident: true,
});
assert(publicIncident.reasons.includes("public_incident_visibility_forbidden"), "public incident visibility should block");
assert(publicIncident.reasons.includes("telegram_incident_authority_forbidden"), "Telegram incident authority should block");

const missingAbuse = evaluatePhase9IncidentControls({
  ...baseInput,
  abuseCanProceed: false,
});
assert(missingAbuse.reasons.includes("abuse_hardening_required"), "Batch 9B abuse hardening should be required");

console.log("Phase 9C incident controls checks passed.");