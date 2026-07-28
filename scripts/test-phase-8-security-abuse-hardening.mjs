import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { inlineOwnerTransactionPolicy } from "./test-owner-transaction-policy.mjs";

const source = inlineOwnerTransactionPolicy(readFileSync(
  resolve(process.cwd(), "src/types/phase8SecurityAbuseHardening.ts"),
  "utf8",
));
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});
const moduleUrl = `data:text/javascript;base64,${
  Buffer.from(transpiled.outputText).toString("base64")
}`;
const { evaluatePhase8SecurityAbuseHardening } = await import(moduleUrl);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const baselineInput = {
  ownerUserId: "owner-1",
  workspaceId: "workspace-1",
  agentId: "agent-1",
  preparedActionId: "action-1",
  submissionNonce: "nonce-1",
  runtimeEnabled: true,
  ownerApprovalRecorded: true,
  lowValueRequestReady: true,
  submitterPending: false,
  resultAlreadyRecorded: false,
  nonceAlreadyUsed: false,
  requestedValueWei: "100000000000000",
  maxValueWei: "100000000000000",
  calldata: "0x",
  includesTokenApproval: false,
  includesSwap: false,
  visibleInPublicProfile: false,
  telegramRequestedExecution: false,
  failureMessage: null,
  failureSanitized: true,
  verificationStatus: "not_started",
};

const ready = evaluatePhase8SecurityAbuseHardening(baselineInput);
assert(ready.status === "hardened", "ready owner submit should be hardened");
assert(ready.canOpenSubmitter, "ready owner submit should open submitter");
assert(ready.ownerOnly === true, "hardening must remain owner-only");
assert(ready.controls.length >= 7, "hardening should expose control evidence");

const replay = evaluatePhase8SecurityAbuseHardening({
  ...baselineInput,
  nonceAlreadyUsed: true,
});
assert(!replay.canOpenSubmitter, "used nonce must not open submitter");
assert(replay.reasons.includes("replay_nonce_detected"), "used nonce should be a replay block");

const doubleSubmit = evaluatePhase8SecurityAbuseHardening({
  ...baselineInput,
  resultAlreadyRecorded: true,
});
assert(doubleSubmit.reasons.includes("result_already_recorded"), "recorded result should block submitter");

const publicSurface = evaluatePhase8SecurityAbuseHardening({
  ...baselineInput,
  visibleInPublicProfile: true,
});
assert(publicSurface.reasons.includes("public_visibility_forbidden"), "public profile must be forbidden");

const telegramSurface = evaluatePhase8SecurityAbuseHardening({
  ...baselineInput,
  telegramRequestedExecution: true,
});
assert(telegramSurface.reasons.includes("telegram_execution_forbidden"), "Telegram execution must be forbidden");

const unsafeShape = evaluatePhase8SecurityAbuseHardening({
  ...baselineInput,
  requestedValueWei: "100000000000001",
  calldata: "0x1234",
  includesTokenApproval: true,
  includesSwap: true,
});
assert(unsafeShape.reasons.includes("unsafe_value"), "over cap value must be blocked");
assert(unsafeShape.reasons.includes("unsafe_calldata"), "calldata must be blocked");
assert(unsafeShape.reasons.includes("token_approval_forbidden"), "token approvals must be blocked");
assert(unsafeShape.reasons.includes("swap_forbidden"), "swaps must be blocked");

const belowFixedValue = evaluatePhase8SecurityAbuseHardening({
  ...baselineInput,
  requestedValueWei: "1",
});
assert(
  belowFixedValue.reasons.includes("unsafe_value"),
  "values below the exact transaction policy must be blocked",
);

const tamperedCap = evaluatePhase8SecurityAbuseHardening({
  ...baselineInput,
  maxValueWei: "100000000000001",
});
assert(
  tamperedCap.reasons.includes("unsafe_value"),
  "a client-authored value cap must not weaken the fixed transaction policy",
);
const unsanitizedFailure = evaluatePhase8SecurityAbuseHardening({
  ...baselineInput,
  failureMessage: "raw provider stack trace",
  failureSanitized: false,
});
assert(unsanitizedFailure.reasons.includes("unsanitized_failure_forbidden"), "raw failure data must be blocked");

const failedSafe = evaluatePhase8SecurityAbuseHardening({
  ...baselineInput,
  verificationStatus: "failed",
});
assert(failedSafe.status === "failed_safe", "failed verification should close safely");
assert(!failedSafe.canOpenSubmitter, "failed verification should not reopen submitter");

console.log("Phase 8 security and abuse hardening checks passed.");