import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-user-flow-test");
const outputPath = resolve(outDir, "phase8UserExecutionFlow.mjs");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${expected}, received ${actual}.`);
  }
}

mkdirSync(outDir, { recursive: true });

const source = readFileSync(resolve(root, "src/types/phase8UserExecutionFlow.ts"), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const { evaluatePhase8UserExecutionFlow } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const baselineInput = {
    ownerSignedIn: true,
    selectedAgent: true,
    ownerWalletConnected: true,
    productChainReady: true,
    preparedActionReady: true,
    ownerApprovalRecorded: true,
    runtimeEnabled: true,
    lowValueRequestReady: true,
    submitterState: "ready",
    verificationStatus: "not_started",
    closeoutReady: false,
    visibleInPublicProfile: false,
    telegramRequestedExecution: false,
  };

  const ready = evaluatePhase8UserExecutionFlow(baselineInput);
  assertEquals(ready.status, "ready_to_submit");
  assertEquals(ready.activeStepKey, "runtime_submitter");
  assert(ready.steps.some((step) => step.key === "runtime_submitter" && step.status === "current"));

  const start = evaluatePhase8UserExecutionFlow({ ...baselineInput, ownerSignedIn: false });
  assertEquals(start.status, "ready_to_start");
  assertEquals(start.activeStepKey, "owner_session");

  const inProgress = evaluatePhase8UserExecutionFlow({ ...baselineInput, ownerWalletConnected: false });
  assertEquals(inProgress.status, "in_progress");
  assertEquals(inProgress.activeStepKey, "owner_wallet");

  const verifying = evaluatePhase8UserExecutionFlow({
    ...baselineInput,
    submitterState: "submitted",
    verificationStatus: "pending_receipt",
  });
  assertEquals(verifying.status, "verifying");
  assertEquals(verifying.activeStepKey, "receipt_verification");

  const confirmed = evaluatePhase8UserExecutionFlow({
    ...baselineInput,
    submitterState: "confirmed",
    verificationStatus: "confirmed",
    closeoutReady: true,
  });
  assertEquals(confirmed.status, "confirmed");
  assertEquals(confirmed.activeStepKey, "owner_closeout");

  const failed = evaluatePhase8UserExecutionFlow({
    ...baselineInput,
    submitterState: "submitted",
    verificationStatus: "failed",
  });
  assertEquals(failed.status, "failed");
  assert(failed.reasons.includes("execution_failed_safely"));
  assert(failed.steps.some((step) => step.status === "failed"));

  const publicBlocked = evaluatePhase8UserExecutionFlow({
    ...baselineInput,
    visibleInPublicProfile: true,
  });
  assertEquals(publicBlocked.status, "blocked");
  assert(publicBlocked.reasons.includes("public_visibility_forbidden"));

  const telegramBlocked = evaluatePhase8UserExecutionFlow({
    ...baselineInput,
    telegramRequestedExecution: true,
  });
  assertEquals(telegramBlocked.status, "blocked");
  assert(telegramBlocked.reasons.includes("telegram_execution_forbidden"));
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 user execution flow checks passed.");