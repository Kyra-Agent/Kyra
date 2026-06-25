import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-execution-launch-readiness-test");
const outputPath = resolve(outDir, "executionLaunchReadiness.mjs");

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

function stripImport(source, specifier) {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.replace(
    new RegExp(`import\\s+(?:type\\s+)?\\{[\\s\\S]*?\\}\\s+from\\s+"${escaped}";`, "u"),
    "",
  );
}

mkdirSync(outDir, { recursive: true });

const source = stripImport(
  readFileSync(resolve(root, "src/types/executionLaunchReadiness.ts"), "utf8"),
  "./controlledLiveTransactionGate",
);
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    evaluateExecutionLaunchReadiness,
    getExecutionLaunchReadinessBlockMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const controlledGateReady = {
    status: "ready_for_live_window_approval",
    liveWindowApproved: false,
    ownerOnly: true,
    walletPromptAllowed: false,
    walletSigningAllowed: false,
    transactionSubmissionAllowed: false,
    reasons: [],
    message: "Controlled live transaction gate is ready.",
  };

  const baseInput = {
    ownerSignedIn: true,
    selectedAgent: true,
    baseAccountConnected: true,
    controlledGate: controlledGateReady,
    officialMcpAdapter: "no-go",
    telegramExecutionDisabled: true,
    publicExecutionHidden: true,
    walletExecutionRuntime: "disabled",
    walletSigningRuntime: "disabled",
    transactionSubmissionRuntime: "disabled",
    productionDeployHealthy: true,
    supabaseHealthy: true,
    rollbackReady: true,
    emergencyDisableReady: true,
    postTransactionAuditReady: true,
    ownerLaunchDecision: "not_requested",
  };

  const ready = evaluateExecutionLaunchReadiness(baseInput);
  assertEquals(ready.status, "ready_for_owner_launch_decision");
  assertEquals(ready.ownerOnly, true);
  assertEquals(ready.baseAccountPrimaryLane, true);
  assertEquals(ready.officialMcpRequired, false);
  assertEquals(ready.walletPromptAllowed, false);
  assertEquals(ready.walletSigningAllowed, false);
  assertEquals(ready.transactionSubmissionAllowed, false);
  assertEquals(ready.reasons.length, 0);

  const approvedStillDisabled = evaluateExecutionLaunchReadiness({
    ...baseInput,
    ownerLaunchDecision: "approved",
  });
  assertEquals(
    approvedStillDisabled.status,
    "owner_approved_runtime_still_disabled",
  );
  assertEquals(approvedStillDisabled.walletPromptAllowed, false);
  assertEquals(approvedStillDisabled.transactionSubmissionAllowed, false);

  const missingScopes = evaluateExecutionLaunchReadiness({
    ...baseInput,
    ownerSignedIn: false,
    selectedAgent: false,
    baseAccountConnected: false,
  });
  assert(missingScopes.reasons.includes("owner_session_required"));
  assert(missingScopes.reasons.includes("selected_agent_required"));
  assert(missingScopes.reasons.includes("base_account_required"));

  const controlledGateBlocked = evaluateExecutionLaunchReadiness({
    ...baseInput,
    controlledGate: {
      ...controlledGateReady,
      status: "blocked",
      reasons: ["base_account_required"],
    },
  });
  assert(controlledGateBlocked.reasons.includes("controlled_gate_not_ready"));

  const officialMcpRequired = evaluateExecutionLaunchReadiness({
    ...baseInput,
    officialMcpAdapter: "approved",
  });
  assert(
    officialMcpRequired.reasons.includes(
      "official_mcp_must_remain_optional_or_disabled",
    ),
  );

  const unsafeSurfaces = evaluateExecutionLaunchReadiness({
    ...baseInput,
    telegramExecutionDisabled: false,
    publicExecutionHidden: false,
  });
  assert(
    unsafeSurfaces.reasons.includes(
      "telegram_execution_must_remain_disabled",
    ),
  );
  assert(unsafeSurfaces.reasons.includes("public_execution_must_remain_hidden"));

  const runtimeOpened = evaluateExecutionLaunchReadiness({
    ...baseInput,
    walletExecutionRuntime: "enabled",
    walletSigningRuntime: "enabled",
    transactionSubmissionRuntime: "enabled",
  });
  assert(runtimeOpened.reasons.includes("wallet_runtime_must_remain_disabled"));
  assert(runtimeOpened.reasons.includes("signing_runtime_must_remain_disabled"));
  assert(
    runtimeOpened.reasons.includes("submission_runtime_must_remain_disabled"),
  );

  const unhealthyOps = evaluateExecutionLaunchReadiness({
    ...baseInput,
    productionDeployHealthy: false,
    supabaseHealthy: false,
    rollbackReady: false,
    emergencyDisableReady: false,
    postTransactionAuditReady: false,
  });
  assert(unhealthyOps.reasons.includes("production_health_required"));
  assert(unhealthyOps.reasons.includes("supabase_health_required"));
  assert(unhealthyOps.reasons.includes("rollback_required"));
  assert(unhealthyOps.reasons.includes("emergency_disable_required"));
  assert(unhealthyOps.reasons.includes("post_transaction_audit_required"));

  assertEquals(
    getExecutionLaunchReadinessBlockMessage(
      "official_mcp_must_remain_optional_or_disabled",
    ),
    "Official hosted Base MCP cannot be required while provider evidence is no-go.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Execution launch readiness checks passed.");
