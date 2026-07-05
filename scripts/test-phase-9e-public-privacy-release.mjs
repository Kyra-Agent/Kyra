import { evaluatePhase9PublicPrivacyRelease } from "../src/types/phase9PublicPrivacyRelease.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const baseInput = {
  monitoringSupportCanProceed: true,
  phase9RuntimeEnabled: false,
  landingPageAudited: true,
  publicAgentProfilesAudited: true,
  telegramResponsesAudited: true,
  dashboardCopyAudited: true,
  logsAudited: true,
  docsAudited: true,
  edgeFunctionErrorsAudited: true,
  walletAddressesHiddenUnlessOwnerApproved: true,
  tokenRefsHidden: true,
  sessionIdsHidden: true,
  internalIdsHidden: true,
  providerPayloadRefsHidden: true,
  transactionIntentInternalsHidden: true,
  rawErrorDetailsHidden: true,
  releaseDecisionRecorded: true,
};

const ready = evaluatePhase9PublicPrivacyRelease(baseInput);
assert(ready.status === "ready_for_runtime", "privacy release gate should be ready while runtime is disabled");
assert(!ready.publicExecutionAllowed, "disabled runtime must not allow public execution");
assert(ready.phase9CanClose, "clean public privacy gate should allow Phase 9 closeout");
assert(ready.canProceedToPhase10, "clean public privacy gate should allow Phase 10 work");
assert(ready.surfacesAudited, "all public surfaces should be audited");
assert(ready.sensitiveDataHidden, "all sensitive data should be hidden");
assert(ready.ownerOnly === true, "privacy release evidence must stay owner-only");
assert(ready.reasons.includes("runtime_disabled"), "runtime disabled reason required");
assert(ready.controls.length >= 5, "privacy release should expose checklist evidence");

const releaseReady = evaluatePhase9PublicPrivacyRelease({
  ...baseInput,
  phase9RuntimeEnabled: true,
});
assert(releaseReady.status === "release_ready", "runtime-enabled clean gate should become release-ready");
assert(releaseReady.publicExecutionAllowed, "release-ready path can allow public execution lane");
assert(releaseReady.reasons.length === 0, "release-ready path must have no reasons");

const missingSurfaces = evaluatePhase9PublicPrivacyRelease({
  ...baseInput,
  phase9RuntimeEnabled: true,
  landingPageAudited: false,
  publicAgentProfilesAudited: false,
  telegramResponsesAudited: false,
  dashboardCopyAudited: false,
  logsAudited: false,
  docsAudited: false,
  edgeFunctionErrorsAudited: false,
});
for (const reason of [
  "landing_audit_required",
  "public_profile_audit_required",
  "telegram_response_audit_required",
  "dashboard_copy_audit_required",
  "log_audit_required",
  "docs_audit_required",
  "edge_error_audit_required",
]) {
  assert(missingSurfaces.reasons.includes(reason), `${reason} should block`);
}
assert(!missingSurfaces.surfacesAudited, "missing surface audits should not pass");

const sensitiveLeak = evaluatePhase9PublicPrivacyRelease({
  ...baseInput,
  phase9RuntimeEnabled: true,
  walletAddressesHiddenUnlessOwnerApproved: false,
  tokenRefsHidden: false,
  sessionIdsHidden: false,
  internalIdsHidden: false,
  providerPayloadRefsHidden: false,
  transactionIntentInternalsHidden: false,
  rawErrorDetailsHidden: false,
});
for (const reason of [
  "wallet_address_exposure_forbidden",
  "token_ref_exposure_forbidden",
  "session_id_exposure_forbidden",
  "internal_id_exposure_forbidden",
  "provider_payload_exposure_forbidden",
  "transaction_intent_internal_exposure_forbidden",
  "raw_error_detail_exposure_forbidden",
]) {
  assert(sensitiveLeak.reasons.includes(reason), `${reason} should block`);
}
assert(!sensitiveLeak.sensitiveDataHidden, "sensitive data leak should not pass");

const missingDependencies = evaluatePhase9PublicPrivacyRelease({
  ...baseInput,
  monitoringSupportCanProceed: false,
  releaseDecisionRecorded: false,
});
assert(missingDependencies.reasons.includes("monitoring_support_required"), "Batch 9D monitoring support should be required");
assert(missingDependencies.reasons.includes("release_decision_required"), "release decision should be required");

console.log("Phase 9E public privacy release checks passed.");