import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-live-window-test");
const outputPath = resolve(outDir, "phase8LiveWindowPreparation.mjs");

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
  return source
    .replace(/import\s+\{\s*productChainId\s*\}\s+from\s+"\.\/[^\"]+";\n?/g, "const productChainId = 4663;\n")
    .replace(/import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+"\.\/[^\"]+";\n?/g, "");
}

mkdirSync(outDir, { recursive: true });

const source = stripImports(
  readFileSync(resolve(root, "src/types/phase8LiveWindowPreparation.ts"), "utf8"),
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
    evaluatePhase8LiveWindowPreparation,
    getPhase8LiveWindowPreparationBlockMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const nowIso = "2026-07-03T10:00:00.000Z";
  const ownerUserId = "owner_1";
  const workspaceId = "workspace_1";
  const agentId = "agent_777";
  const frozenAction = {
    requestId: "phase8_request",
    ownerUserId,
    workspaceId,
    agentId,
    approvalId: "approval_1",
    approvedAt: "2026-07-03T09:55:00.000Z",
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
  const liveWindow = {
    status: "approved",
    approvedByUserId: ownerUserId,
    workspaceId,
    agentId,
    approvedAt: "2026-07-03T09:59:00.000Z",
    expiresAt: "2026-07-03T10:15:00.000Z",
    revokedAt: null,
  };
  const executeIntent = {
    source: "private_dashboard",
    ownerClickedExecute: true,
    ownerUserId,
    workspaceId,
    agentId,
    requestedAt: nowIso,
  };
  const baselineInput = {
    ownerUserId,
    sessionUserId: ownerUserId,
    workspaceId,
    selectedWorkspaceId: workspaceId,
    selectedAgentId: agentId,
    chainId: 4663,
    ownerWalletConnected: true,
    liveWindow,
    executeIntent,
    frozenAction,
    ownerWalletPromptReadiness: "ready",
    nowIso,
    visibleInPublicProfile: false,
  };

  const ready = evaluatePhase8LiveWindowPreparation(baselineInput);
  assertEquals(ready.status, "ready_for_wallet_prompt");
  assertEquals(ready.ownerOnly, true);
  assertEquals(ready.walletPromptAllowed, true);
  assertEquals(ready.transactionSubmissionAllowed, false);
  assertEquals(ready.reasons.length, 0);

  const opened = evaluatePhase8LiveWindowPreparation({
    ...baselineInput,
    ownerWalletPromptReadiness: "opened",
  });
  assertEquals(opened.status, "wallet_prompt_opened");
  assertEquals(opened.transactionSubmissionAllowed, false);

  const approved = evaluatePhase8LiveWindowPreparation({
    ...baselineInput,
    ownerWalletPromptReadiness: "approved",
  });
  assertEquals(approved.status, "wallet_prompt_approved");
  assertEquals(approved.transactionSubmissionAllowed, false);

  const expired = evaluatePhase8LiveWindowPreparation({
    ...baselineInput,
    liveWindow: { ...liveWindow, expiresAt: "2026-07-03T09:59:59.000Z" },
  });
  assert(expired.reasons.includes("live_window_expired"));
  assertEquals(expired.walletPromptAllowed, false);

  const revoked = evaluatePhase8LiveWindowPreparation({
    ...baselineInput,
    liveWindow: { ...liveWindow, status: "revoked", revokedAt: nowIso },
  });
  assert(revoked.reasons.includes("live_window_revoked"));

  const wrongOwner = evaluatePhase8LiveWindowPreparation({
    ...baselineInput,
    sessionUserId: "owner_2",
  });
  assert(wrongOwner.reasons.includes("owner_match_required"));

  const wrongAgent = evaluatePhase8LiveWindowPreparation({
    ...baselineInput,
    selectedAgentId: "agent_999",
  });
  assert(wrongAgent.reasons.includes("selected_agent_match_required"));
  assert(wrongAgent.reasons.includes("live_window_agent_mismatch"));
  assert(wrongAgent.reasons.includes("frozen_action_agent_mismatch"));

  const wrongChain = evaluatePhase8LiveWindowPreparation({
    ...baselineInput,
    chainId: 1,
  });
  assert(wrongChain.reasons.includes("product_chain_required"));

  const unsafeAction = evaluatePhase8LiveWindowPreparation({
    ...baselineInput,
    frozenAction: { ...frozenAction, valueWei: "1", data: "0x1234" },
  });
  assert(unsafeAction.reasons.includes("zero_value_action_required"));
  assert(unsafeAction.reasons.includes("no_calldata_required"));

  const telegramIntent = evaluatePhase8LiveWindowPreparation({
    ...baselineInput,
    executeIntent: { ...executeIntent, source: "telegram" },
  });
  assert(telegramIntent.reasons.includes("telegram_authority_forbidden"));

  const publicIntent = evaluatePhase8LiveWindowPreparation({
    ...baselineInput,
    executeIntent: { ...executeIntent, source: "public_profile" },
    visibleInPublicProfile: true,
  });
  assert(publicIntent.reasons.includes("public_visibility_forbidden"));

  const promptNotReady = evaluatePhase8LiveWindowPreparation({
    ...baselineInput,
    ownerWalletPromptReadiness: "not_ready",
  });
  assert(promptNotReady.reasons.includes("owner_wallet_prompt_ready_required"));

  assertEquals(
    getPhase8LiveWindowPreparationBlockMessage("private_dashboard_intent_required"),
    "Execution intent must come from the private owner dashboard.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 live-window preparation checks passed.");