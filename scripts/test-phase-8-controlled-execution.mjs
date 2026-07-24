import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-controlled-execution-test");
const outputPath = resolve(outDir, "phase8ControlledExecution.mjs");

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

function stripImports(source) {
  return source.replace(
    /import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+"\.\/[^"]+";\n?/gu,
    "",
  );
}

mkdirSync(outDir, { recursive: true });

const source = stripImports(
  readFileSync(resolve(root, "src/types/phase8ControlledExecution.ts"), "utf8"),
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
    evaluatePhase8ControlledExecution,
    getPhase8ControlledExecutionBlockMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const executionLaunch = {
    status: "owner_approved_runtime_still_disabled",
    ownerOnly: true,
    ownerWalletPrimaryLane: true,
    hostedChainProviderRequired: false,
    walletPromptAllowed: false,
    walletSigningAllowed: false,
    transactionSubmissionAllowed: false,
    reasons: [],
    message: "Owner approved launch packet.",
  };
  const frozenAction = {
    requestId: "phase8_request",
    ownerUserId: "owner_1",
    workspaceId: "workspace_1",
    agentId: "agent_777",
    approvalId: "approval_1",
    approvedAt: "2026-07-03T00:00:00.000Z",
    actionKind: "robinhood_reviewed_transaction",
    chain: "Robinhood Chain",
    recipient: "0x0000000000000000000000000000000000000000",
    valueWei: "0",
    data: "0x",
    routeSummary: "Controlled zero-value Robinhood Chain execution check.",
    valueSummary: "Zero-value first transaction.",
    freezeKey: "phase8-freeze",
    frozen: true,
  };
  const resultMonitoring = {
    status: "not_started",
    ownerOnly: true,
    txHash: null,
    confirmationId: null,
    sanitizedFailureReason: null,
    disconnectAllowed: false,
    emergencyDisabled: false,
    reasons: [],
    message: "Result monitoring ready.",
  };
  const baselineInput = {
    ownerSignedIn: true,
    selectedAgent: true,
    ownerWalletConnected: true,
    executionLaunch,
    runtimeEnablement: "enabled",
    ownerClickedExecute: true,
    frozenAction,
    ownerWalletPromptState: "not_requested",
    resultMonitoring,
    rollbackReady: true,
    emergencyDisableReady: true,
    postTransactionAuditReady: true,
    telegramCanAuthorize: false,
    visibleInPublicProfile: false,
  };

  const ready = evaluatePhase8ControlledExecution(baselineInput);
  assertEquals(ready.status, "ready_for_owner_wallet_prompt");
  assertEquals(ready.ownerOnly, true);
  assertEquals(ready.ownerWalletPrimaryLane, true);
  assertEquals(ready.hostedChainProviderRequired, false);
  assertEquals(ready.walletPromptAllowed, true);
  assertEquals(ready.transactionSubmissionAllowed, false);
  assertEquals(ready.reasons.length, 0);

  const opened = evaluatePhase8ControlledExecution({
    ...baselineInput,
    ownerWalletPromptState: "opened",
  });
  assertEquals(opened.status, "wallet_prompt_opened");
  assertEquals(opened.walletPromptAllowed, true);
  assertEquals(opened.transactionSubmissionAllowed, false);

  const approved = evaluatePhase8ControlledExecution({
    ...baselineInput,
    ownerWalletPromptState: "approved",
  });
  assertEquals(approved.status, "submitted_pending_confirmation");
  assertEquals(approved.transactionSubmissionAllowed, true);

  const confirmed = evaluatePhase8ControlledExecution({
    ...baselineInput,
    ownerWalletPromptState: "approved",
    resultMonitoring: {
      ...resultMonitoring,
      status: "closed_confirmed",
      txHash: "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      confirmationId: "confirmed_1",
      disconnectAllowed: true,
      message: "Confirmed.",
    },
  });
  assertEquals(confirmed.status, "closed_confirmed");

  const defaultLocked = evaluatePhase8ControlledExecution({
    ...baselineInput,
    runtimeEnablement: "disabled",
  });
  assert(defaultLocked.reasons.includes("runtime_enablement_required"));
  assertEquals(defaultLocked.walletPromptAllowed, false);

  const missingOwnerClick = evaluatePhase8ControlledExecution({
    ...baselineInput,
    ownerClickedExecute: false,
  });
  assert(missingOwnerClick.reasons.includes("owner_click_required"));

  const unsafeAction = evaluatePhase8ControlledExecution({
    ...baselineInput,
    frozenAction: {
      ...frozenAction,
      valueWei: "1",
      data: "0x1234",
    },
  });
  assert(unsafeAction.reasons.includes("zero_value_action_required"));
  assert(unsafeAction.reasons.includes("no_calldata_required"));

  const unsafeSurfaces = evaluatePhase8ControlledExecution({
    ...baselineInput,
    telegramCanAuthorize: true,
    visibleInPublicProfile: true,
  });
  assert(unsafeSurfaces.reasons.includes("telegram_authority_forbidden"));
  assert(unsafeSurfaces.reasons.includes("public_visibility_forbidden"));

  const badLaunch = evaluatePhase8ControlledExecution({
    ...baselineInput,
    executionLaunch: {
      ...executionLaunch,
      status: "ready_for_owner_launch_decision",
    },
  });
  assert(badLaunch.reasons.includes("launch_packet_required"));

  assertEquals(
    getPhase8ControlledExecutionBlockMessage("runtime_enablement_required"),
    "Controlled execution must be explicitly enabled for the live window.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 controlled execution checks passed.");
