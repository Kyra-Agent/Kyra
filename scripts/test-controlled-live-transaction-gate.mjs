import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-controlled-live-gate-test");
const outputPath = resolve(outDir, "controlledLiveTransactionGate.mjs");

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

const unsignedSource = readFileSync(
  resolve(root, "src/types/unsignedTransactionHandoff.ts"),
  "utf8",
).replace(
  'import { currentProductChain } from "../config/productChains";',
  'const currentProductChain = Object.freeze({ id: 4663, name: "Robinhood Chain" });',
);
const gateSource = stripImport(
  stripImport(
    stripImport(
      readFileSync(resolve(root, "src/types/controlledLiveTransactionGate.ts"), "utf8"),
      "./dualApprovalExecution",
    ),
    "./resultMonitoringCloseout",
  ),
  "./unsignedTransactionHandoff",
);

const transpiled = ts.transpileModule(`${unsignedSource}\n${gateSource}`, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    productChainId,
    evaluateControlledLiveTransactionGate,
    getControlledLiveTransactionBlockMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const dualApprovalReady = {
    status: "owner_wallet_prompt_locked",
    frozenAction: null,
    walletPromptAllowed: false,
    transactionSubmissionAllowed: false,
    reasons: [],
    message: "Dual approval boundary ready.",
  };

  const resultMonitoringReady = {
    status: "not_started",
    ownerOnly: true,
    txHash: null,
    confirmationId: null,
    sanitizedFailureReason: null,
    disconnectAllowed: false,
    emergencyDisabled: false,
    reasons: [],
    message: "No provider submission has been observed.",
  };

  const baselineInput = {
    ownerUserId: "owner_7j",
    workspaceId: "workspace_7j",
    agentId: "agent_666",
    ownerWalletConnected: true,
    chainId: productChainId,
    preparedActionCount: 1,
    actionAllowlisted: true,
    actionRisk: "low",
    dualApproval: dualApprovalReady,
    resultMonitoring: resultMonitoringReady,
    rollbackReady: true,
    emergencyDisableReady: true,
    postTransactionAuditReady: true,
    liveWindowApproved: false,
    visibleInPublicProfile: false,
    telegramCanAuthorize: false,
    walletPromptRuntimeEnabled: false,
    walletSigningRuntimeEnabled: false,
    transactionSubmissionRuntimeEnabled: false,
  };

  const ready = evaluateControlledLiveTransactionGate(baselineInput);
  assertEquals(ready.status, "ready_for_live_window_approval");
  assertEquals(ready.ownerOnly, true);
  assertEquals(ready.walletPromptAllowed, false);
  assertEquals(ready.walletSigningAllowed, false);
  assertEquals(ready.transactionSubmissionAllowed, false);
  assertEquals(ready.reasons.length, 0);

  const approvedRuntimeLocked = evaluateControlledLiveTransactionGate({
    ...baselineInput,
    liveWindowApproved: true,
  });
  assertEquals(
    approvedRuntimeLocked.status,
    "live_window_approved_runtime_locked",
  );
  assertEquals(approvedRuntimeLocked.transactionSubmissionAllowed, false);

  const missingScope = evaluateControlledLiveTransactionGate({
    ...baselineInput,
    ownerUserId: "",
    workspaceId: "",
    agentId: "",
  });
  assert(missingScope.reasons.includes("owner_scope_required"));
  assert(missingScope.reasons.includes("workspace_scope_required"));
  assert(missingScope.reasons.includes("agent_scope_required"));

  const multiAction = evaluateControlledLiveTransactionGate({
    ...baselineInput,
    preparedActionCount: 2,
  });
  assert(multiAction.reasons.includes("single_action_required"));

  const unsafeCandidate = evaluateControlledLiveTransactionGate({
    ...baselineInput,
    actionAllowlisted: false,
    actionRisk: "medium",
  });
  assert(unsafeCandidate.reasons.includes("allowlisted_action_required"));
  assert(unsafeCandidate.reasons.includes("low_risk_action_required"));

  const dualApprovalBlocked = evaluateControlledLiveTransactionGate({
    ...baselineInput,
    dualApproval: {
      ...dualApprovalReady,
      walletPromptAllowed: true,
      transactionSubmissionAllowed: true,
      reasons: ["wallet_signing_disabled"],
    },
  });
  assert(dualApprovalBlocked.reasons.includes("dual_approval_required"));

  const resultMonitoringBlocked = evaluateControlledLiveTransactionGate({
    ...baselineInput,
    resultMonitoring: {
      ...resultMonitoringReady,
      txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    },
  });
  assert(resultMonitoringBlocked.reasons.includes("result_monitoring_required"));

  const missingSafety = evaluateControlledLiveTransactionGate({
    ...baselineInput,
    rollbackReady: false,
    emergencyDisableReady: false,
    postTransactionAuditReady: false,
  });
  assert(missingSafety.reasons.includes("rollback_required"));
  assert(missingSafety.reasons.includes("emergency_disable_required"));
  assert(missingSafety.reasons.includes("post_transaction_audit_required"));

  const publicTelegramBlocked = evaluateControlledLiveTransactionGate({
    ...baselineInput,
    visibleInPublicProfile: true,
    telegramCanAuthorize: true,
  });
  assert(publicTelegramBlocked.reasons.includes("public_visibility_forbidden"));
  assert(publicTelegramBlocked.reasons.includes("telegram_authority_forbidden"));

  const runtimeMisconfigured = evaluateControlledLiveTransactionGate({
    ...baselineInput,
    walletPromptRuntimeEnabled: true,
    walletSigningRuntimeEnabled: true,
    transactionSubmissionRuntimeEnabled: true,
  });
  assert(
    runtimeMisconfigured.reasons.includes(
      "runtime_execution_must_remain_locked",
    ),
  );

  assertEquals(
    getControlledLiveTransactionBlockMessage("telegram_authority_forbidden"),
    "Telegram cannot authorize or execute controlled live transactions.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Controlled live transaction gate checks passed.");
