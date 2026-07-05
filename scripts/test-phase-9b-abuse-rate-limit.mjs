import { evaluatePhase9AbuseRateLimit } from "../src/types/phase9AbuseRateLimit.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const cleanWindow = { used: 1, limit: 5 };
const baseInput = {
  eligibilityCanProceed: true,
  phase9RuntimeEnabled: false,
  owner: cleanWindow,
  agent: cleanWindow,
  workspace: cleanWindow,
  route: cleanWindow,
  wallet: cleanWindow,
  cooldownActive: false,
  nonceAlreadyUsed: false,
  duplicateSubmitDetected: false,
  providerBackoffActive: false,
  requestedValueWei: "100000000000000",
  maxValueWei: "100000000000000",
  sanitizedDecision: true,
  exposesRawWalletData: false,
  exposesTelegramTokenRef: false,
  exposesProviderPayloadRef: false,
};

const ready = evaluatePhase9AbuseRateLimit(baseInput);
assert(ready.status === "ready_for_runtime", "clean controls should be ready while runtime is disabled");
assert(!ready.publicExecutionAllowed, "disabled runtime must not allow execution");
assert(ready.canProceedToIncidentControls, "clean controls should allow Batch 9C work");
assert(ready.reasons.includes("runtime_disabled"), "runtime disabled reason required");
assert(ready.ownerOnly === true, "evidence must stay owner-only");
assert(ready.controls.length >= 9, "control evidence should be exposed");

const enforced = evaluatePhase9AbuseRateLimit({
  ...baseInput,
  phase9RuntimeEnabled: true,
});
assert(enforced.status === "enforced", "runtime enabled with clean controls should enforce");
assert(enforced.publicExecutionAllowed, "clean runtime-enabled controls can allow public execution");
assert(enforced.reasons.length === 0, "enforced path must have no reasons");

const limits = evaluatePhase9AbuseRateLimit({
  ...baseInput,
  phase9RuntimeEnabled: true,
  owner: { used: 6, limit: 5 },
  agent: { used: 7, limit: 5 },
  workspace: { used: 8, limit: 5 },
  route: { used: 9, limit: 5 },
  wallet: { used: 10, limit: 5 },
});
for (const reason of [
  "owner_rate_limit_exceeded",
  "agent_rate_limit_exceeded",
  "workspace_rate_limit_exceeded",
  "route_rate_limit_exceeded",
  "wallet_rate_limit_exceeded",
]) {
  assert(limits.reasons.includes(reason), `${reason} should block`);
}

const replay = evaluatePhase9AbuseRateLimit({
  ...baseInput,
  phase9RuntimeEnabled: true,
  nonceAlreadyUsed: true,
  duplicateSubmitDetected: true,
});
assert(replay.reasons.includes("nonce_replay_detected"), "used nonce should block");
assert(replay.reasons.includes("duplicate_submit_detected"), "duplicate submit should block");

const backoff = evaluatePhase9AbuseRateLimit({
  ...baseInput,
  phase9RuntimeEnabled: true,
  cooldownActive: true,
  providerBackoffActive: true,
});
assert(backoff.reasons.includes("cooldown_active"), "cooldown should block");
assert(backoff.reasons.includes("provider_backoff_active"), "provider backoff should block");

const valueCap = evaluatePhase9AbuseRateLimit({
  ...baseInput,
  phase9RuntimeEnabled: true,
  requestedValueWei: "100000000000001",
});
assert(valueCap.reasons.includes("value_cap_exceeded"), "value cap should block");

const unsafeEvidence = evaluatePhase9AbuseRateLimit({
  ...baseInput,
  phase9RuntimeEnabled: true,
  sanitizedDecision: false,
  exposesRawWalletData: true,
  exposesTelegramTokenRef: true,
  exposesProviderPayloadRef: true,
});
assert(unsafeEvidence.reasons.includes("unsanitized_decision_forbidden"), "unsanitized decisions should block");
assert(unsafeEvidence.reasons.includes("raw_wallet_data_forbidden"), "raw wallet data should block");
assert(unsafeEvidence.reasons.includes("telegram_token_ref_forbidden"), "Telegram token refs should block");
assert(unsafeEvidence.reasons.includes("provider_payload_ref_forbidden"), "provider payload refs should block");

const noEligibility = evaluatePhase9AbuseRateLimit({
  ...baseInput,
  eligibilityCanProceed: false,
});
assert(noEligibility.reasons.includes("eligibility_required"), "Batch 9A eligibility should be required");

console.log("Phase 9B abuse and rate-limit checks passed.");