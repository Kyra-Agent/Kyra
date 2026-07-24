import { evaluatePhase8ProductionCloseout } from "../src/types/phase8ProductionCloseout.ts";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const baselineInput = {
  userFlowStatus: "ready_to_submit",
  securityStatus: "hardened",
  lowValueReadinessReady: true,
  submitRequestReady: true,
  transactionVerificationStatus: "not_started",
  ownerCloseoutReady: false,
  publicExecutionEnabled: false,
  telegramExecutionEnabled: false,
};

const ready = evaluatePhase8ProductionCloseout(baselineInput);
assert(ready.status === "ready_for_owner_run", "ready path should close implementation and wait for owner run");
assert(ready.phase8ImplementationClosed, "ready path should mark implementation closeout complete");
assert(ready.canContinueToPhase9, "ready path should allow Phase 9 hardening to start");
assert(ready.ownerOnly === true, "closeout must stay owner-only");
assert(ready.checklist.length >= 6, "closeout should expose checklist evidence");

const pendingReceipt = evaluatePhase8ProductionCloseout({
  ...baselineInput,
  userFlowStatus: "verifying",
  transactionVerificationStatus: "pending_receipt",
});
assert(pendingReceipt.status === "receipt_pending", "pending receipt should not be final complete");
assert(pendingReceipt.reasons.includes("receipt_pending"), "pending receipt reason should be explicit");

const confirmed = evaluatePhase8ProductionCloseout({
  ...baselineInput,
  userFlowStatus: "confirmed",
  transactionVerificationStatus: "confirmed",
  ownerCloseoutReady: true,
});
assert(confirmed.status === "complete", "confirmed receipt and owner closeout should complete Phase 8");
assert(confirmed.canContinueToPhase9, "confirmed closeout should allow Phase 9");

const publicLeak = evaluatePhase8ProductionCloseout({
  ...baselineInput,
  publicExecutionEnabled: true,
});
assert(publicLeak.status === "blocked", "public execution must block closeout");
assert(publicLeak.reasons.includes("public_execution_forbidden"), "public execution block should be explicit");

const telegramLeak = evaluatePhase8ProductionCloseout({
  ...baselineInput,
  telegramExecutionEnabled: true,
});
assert(telegramLeak.reasons.includes("telegram_execution_forbidden"), "Telegram execution block should be explicit");

const unsafe = evaluatePhase8ProductionCloseout({
  ...baselineInput,
  securityStatus: "blocked",
  submitRequestReady: false,
});
assert(unsafe.status === "blocked", "missing hardening or request should block closeout");
assert(unsafe.reasons.includes("security_hardening_required"), "security hardening should be required");
assert(unsafe.reasons.includes("submit_request_required"), "submit request should be required");

const failedReceipt = evaluatePhase8ProductionCloseout({
  ...baselineInput,
  transactionVerificationStatus: "failed",
});
assert(failedReceipt.status === "blocked", "failed receipt should block final closeout");
assert(failedReceipt.reasons.includes("receipt_failed"), "failed receipt reason should be explicit");

console.log("Phase 8 production closeout checks passed.");