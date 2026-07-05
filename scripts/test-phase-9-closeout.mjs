import { evaluatePhase9Closeout } from "../src/types/phase9Closeout.ts";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const baseInput = {
  executionEligibilityReady: true,
  abuseRateLimitReady: true,
  incidentControlsReady: true,
  monitoringSupportReady: true,
  publicPrivacyReleaseReady: true,
  phase10ReadinessStarted: false,
};

const ready = evaluatePhase9Closeout(baseInput);
assert(ready.status === "structurally_complete", "Phase 9 should close structurally when 9A-9E are clean");
assert(ready.phase9StructurallyComplete, "Phase 9 structural closeout should be true");
assert(ready.canProceedToPhase10, "Phase 10 should be allowed after structural closeout");
assert(ready.publicExecutionRuntimeEnabled === false, "Phase 9 closeout must not enable public runtime");
assert(ready.ownerOnly === true, "Phase 9 closeout evidence must be owner-only");
assert(ready.reasons.length === 1 && ready.reasons.includes("phase10_readiness_required"), "Phase 10 pending reason should remain informational");
assert(ready.controls.length >= 7, "Phase 9 closeout should expose checklist evidence");

const startedPhase10 = evaluatePhase9Closeout({
  ...baseInput,
  phase10ReadinessStarted: true,
});
assert(startedPhase10.status === "structurally_complete", "Phase 10 start should not reopen Phase 9");
assert(startedPhase10.reasons.length === 0, "all closeout reasons should clear when Phase 10 starts");

const blocked = evaluatePhase9Closeout({
  executionEligibilityReady: false,
  abuseRateLimitReady: false,
  incidentControlsReady: false,
  monitoringSupportReady: false,
  publicPrivacyReleaseReady: false,
  phase10ReadinessStarted: false,
});
for (const reason of [
  "execution_eligibility_required",
  "abuse_rate_limit_required",
  "incident_controls_required",
  "monitoring_support_required",
  "public_privacy_release_required",
  "phase10_readiness_required",
]) {
  assert(blocked.reasons.includes(reason), `${reason} should be present`);
}
assert(blocked.status === "blocked", "missing Phase 9 gates should block closeout");
assert(!blocked.phase9StructurallyComplete, "blocked closeout should not be structurally complete");
assert(!blocked.canProceedToPhase10, "blocked closeout cannot proceed to Phase 10");
assert(blocked.publicExecutionRuntimeEnabled === false, "blocked closeout must not enable public runtime");

console.log("Phase 9 closeout checks passed.");