import { evaluatePhase9MonitoringSupport } from "../src/types/phase9MonitoringSupport.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const baselineInput = {
  incidentControlsCanProceed: true,
  phase9RuntimeEnabled: false,
  netlifyHealthReady: true,
  supabaseHealthReady: true,
  edgeFunctionHealthReady: true,
  transactionVerificationHealthReady: true,
  publicExecutionGateHealthReady: true,
  ownerSupportCopyReady: true,
  sanitizedDebugStates: true,
  aggregatedAnalyticsReady: true,
  rawWalletInternalsHidden: true,
  telegramTokensHidden: true,
  providerPayloadsHidden: true,
  secretsHidden: true,
  ownerEvidenceReady: true,
  publicAnalyticsPrivacyPreserving: true,
};

const ready = evaluatePhase9MonitoringSupport(baselineInput);
assert(ready.status === "ready_for_runtime", "monitoring support should be ready while runtime is disabled");
assert(!ready.publicExecutionAllowed, "disabled runtime must not allow public execution");
assert(ready.canProceedToPrivacyGate, "clean monitoring support should allow Batch 9E work");
assert(ready.supportReady, "support copy should be ready");
assert(ready.monitoringReady, "production health monitoring should be ready");
assert(ready.privacyPreserving, "analytics and support evidence should preserve privacy");
assert(ready.ownerOnly === true, "monitoring support evidence must stay owner-only");
assert(ready.reasons.includes("runtime_disabled"), "runtime disabled reason required");
assert(ready.controls.length >= 6, "monitoring support should expose checklist evidence");

const observable = evaluatePhase9MonitoringSupport({
  ...baselineInput,
  phase9RuntimeEnabled: true,
});
assert(observable.status === "observable", "runtime-enabled clean monitoring should become observable");
assert(observable.publicExecutionAllowed, "observable path can allow public execution lane");
assert(observable.reasons.length === 0, "observable path must have no reasons");

const missingHealth = evaluatePhase9MonitoringSupport({
  ...baselineInput,
  phase9RuntimeEnabled: true,
  netlifyHealthReady: false,
  supabaseHealthReady: false,
  edgeFunctionHealthReady: false,
  transactionVerificationHealthReady: false,
  publicExecutionGateHealthReady: false,
});
for (const reason of [
  "netlify_health_required",
  "supabase_health_required",
  "edge_function_health_required",
  "transaction_verification_health_required",
  "public_execution_gate_health_required",
]) {
  assert(missingHealth.reasons.includes(reason), `${reason} should block`);
}
assert(!missingHealth.monitoringReady, "missing health evidence should not be monitoring-ready");

const unsafeSupport = evaluatePhase9MonitoringSupport({
  ...baselineInput,
  phase9RuntimeEnabled: true,
  ownerSupportCopyReady: false,
  sanitizedDebugStates: false,
  ownerEvidenceReady: false,
});
assert(unsafeSupport.reasons.includes("owner_support_copy_required"), "owner support copy required");
assert(unsafeSupport.reasons.includes("sanitized_debug_state_required"), "sanitized debug states required");
assert(unsafeSupport.reasons.includes("owner_evidence_required"), "owner evidence required");
assert(!unsafeSupport.supportReady, "unsafe support should not be support-ready");

const privacyLeak = evaluatePhase9MonitoringSupport({
  ...baselineInput,
  phase9RuntimeEnabled: true,
  aggregatedAnalyticsReady: false,
  rawWalletInternalsHidden: false,
  telegramTokensHidden: false,
  providerPayloadsHidden: false,
  secretsHidden: false,
  publicAnalyticsPrivacyPreserving: false,
});
for (const reason of [
  "aggregated_analytics_required",
  "raw_wallet_internals_forbidden",
  "telegram_token_exposure_forbidden",
  "provider_payload_exposure_forbidden",
  "secret_exposure_forbidden",
  "public_analytics_privacy_required",
]) {
  assert(privacyLeak.reasons.includes(reason), `${reason} should block`);
}
assert(!privacyLeak.privacyPreserving, "privacy leak should not be privacy-preserving");

const missingIncident = evaluatePhase9MonitoringSupport({
  ...baselineInput,
  incidentControlsCanProceed: false,
});
assert(missingIncident.reasons.includes("incident_controls_required"), "Batch 9C incident controls should be required");

console.log("Phase 9D monitoring and support checks passed.");