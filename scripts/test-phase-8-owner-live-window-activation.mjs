import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(tmpdir(), "kyra-phase8-owner-live-window-activation-test");
mkdirSync(outDir, { recursive: true });
const outputPath = resolve(outDir, "phase8OwnerLiveWindowActivation.mjs");

const source = readFileSync(
  resolve(root, "src/types/phase8OwnerLiveWindowActivation.ts"),
  "utf8",
);
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
writeFileSync(outputPath, transpiled, "utf8");

const { evaluatePhase8OwnerLiveWindowActivation } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const readySubmission = {
  status: "ready_to_submit",
  ownerOnly: true,
  baseAccountPrimaryLane: true,
  officialMcpRequired: false,
  transactionSubmissionAllowed: true,
  resultCloseoutRecorded: false,
  reasons: [],
  message: "ready",
};

const baseInput = {
  runtimeWindowEnabled: true,
  controlledSubmission: readySubmission,
  operatorAcknowledged: true,
  rollbackReady: true,
  emergencyDisableReady: true,
  postTransactionAuditReady: true,
  ownerDashboardSource: true,
};

const ready = evaluatePhase8OwnerLiveWindowActivation(baseInput);
assert(ready.status === "ready", "expected ready activation");
assert(ready.transactionSubmissionAllowed, "ready activation should allow one controlled submission");
assert(ready.reasons.length === 0, "ready activation should have no reasons");

const disabled = evaluatePhase8OwnerLiveWindowActivation({
  ...baseInput,
  runtimeWindowEnabled: false,
});
assert(disabled.status === "locked", "disabled runtime should lock activation");
assert(disabled.reasons.includes("runtime_window_disabled"), "disabled runtime reason missing");
assert(!disabled.transactionSubmissionAllowed, "disabled runtime must not submit");

const blockedSubmission = evaluatePhase8OwnerLiveWindowActivation({
  ...baseInput,
  controlledSubmission: {
    ...readySubmission,
    status: "blocked",
    transactionSubmissionAllowed: false,
    reasons: ["submission_nonce_required"],
  },
});
assert(
  blockedSubmission.reasons.includes("controlled_submission_required"),
  "blocked submission reason missing",
);

for (const [field, reason] of [
  ["operatorAcknowledged", "operator_ack_required"],
  ["rollbackReady", "rollback_required"],
  ["emergencyDisableReady", "emergency_disable_required"],
  ["postTransactionAuditReady", "post_transaction_audit_required"],
  ["ownerDashboardSource", "owner_dashboard_required"],
]) {
  const result = evaluatePhase8OwnerLiveWindowActivation({
    ...baseInput,
    [field]: false,
  });
  assert(result.status === "locked", `${field} should lock activation`);
  assert(result.reasons.includes(reason), `${reason} missing`);
  assert(!result.transactionSubmissionAllowed, `${field} must not submit`);
}

console.log("Phase 8 owner live-window activation checks passed.");
