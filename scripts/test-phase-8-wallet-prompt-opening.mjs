import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-wallet-prompt-test");
const outputPath = resolve(outDir, "phase8WalletPromptOpening.mjs");

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
    /import\s+(?:type\s+)?\{[\s\S]*?\}\s+from\s+"\.\/[^\"]+";\n?/g,
    "",
  );
}

mkdirSync(outDir, { recursive: true });

const source = stripImports(
  readFileSync(resolve(root, "src/types/phase8WalletPromptOpening.ts"), "utf8"),
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
    evaluatePhase8WalletPromptOpening,
    getPhase8WalletPromptOpeningBlockMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

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
    actionKind: "base_reviewed_transaction",
    chain: "Base",
    recipient: "0x0000000000000000000000000000000000000000",
    valueWei: "0",
    data: "0x",
    routeSummary: "Controlled zero-value Base execution check.",
    valueSummary: "Zero-value first transaction.",
    freezeKey: "phase8-freeze",
    frozen: true,
  };
  const liveWindowPreparation = {
    status: "ready_for_wallet_prompt",
    ownerOnly: true,
    walletPromptAllowed: true,
    transactionSubmissionAllowed: false,
    reasons: [],
    message: "Ready.",
  };
  const promptIntent = {
    source: "private_dashboard",
    ownerClickedOpenPrompt: true,
    ownerUserId,
    workspaceId,
    agentId,
    frozenActionFreezeKey: frozenAction.freezeKey,
    promptNonce: "prompt_nonce_1",
    promptNonceUsed: false,
    requestedAt: "2026-07-03T10:00:00.000Z",
  };
  const openedAudit = {
    type: "prompt_opened",
    ownerOnly: true,
    sanitized: true,
    message: "Prompt opened.",
    createdAt: "2026-07-03T10:00:01.000Z",
  };
  const approvedAudit = {
    type: "prompt_approved",
    ownerOnly: true,
    sanitized: true,
    message: "Prompt approved.",
    createdAt: "2026-07-03T10:00:02.000Z",
  };
  const rejectedAudit = {
    type: "prompt_rejected",
    ownerOnly: true,
    sanitized: true,
    message: "Prompt rejected.",
    createdAt: "2026-07-03T10:00:03.000Z",
  };
  const failedAudit = {
    type: "prompt_failed",
    ownerOnly: true,
    sanitized: true,
    message: "Prompt failed.",
    createdAt: "2026-07-03T10:00:04.000Z",
  };
  const baseInput = {
    liveWindowPreparation,
    ownerUserId,
    workspaceId,
    selectedAgentId: agentId,
    frozenAction,
    promptIntent,
    promptState: "ready",
    auditEvents: [],
    visibleInPublicProfile: false,
  };

  const ready = evaluatePhase8WalletPromptOpening(baseInput);
  assertEquals(ready.status, "ready_to_open_prompt");
  assertEquals(ready.walletPromptOpenAllowed, true);
  assertEquals(ready.walletApprovalRecorded, false);
  assertEquals(ready.transactionSubmissionAllowed, false);
  assertEquals(ready.reasons.length, 0);

  const opened = evaluatePhase8WalletPromptOpening({
    ...baseInput,
    promptState: "opened",
    auditEvents: [openedAudit],
  });
  assertEquals(opened.status, "prompt_opened");
  assertEquals(opened.walletPromptOpenAllowed, false);
  assertEquals(opened.transactionSubmissionAllowed, false);

  const approved = evaluatePhase8WalletPromptOpening({
    ...baseInput,
    promptState: "approved",
    auditEvents: [approvedAudit],
  });
  assertEquals(approved.status, "prompt_approved");
  assertEquals(approved.walletApprovalRecorded, true);
  assertEquals(approved.transactionSubmissionAllowed, false);

  const rejected = evaluatePhase8WalletPromptOpening({
    ...baseInput,
    promptState: "rejected",
    auditEvents: [rejectedAudit],
  });
  assertEquals(rejected.status, "prompt_rejected");
  assertEquals(rejected.transactionSubmissionAllowed, false);

  const failed = evaluatePhase8WalletPromptOpening({
    ...baseInput,
    promptState: "failed",
    auditEvents: [failedAudit],
  });
  assertEquals(failed.status, "prompt_failed");
  assertEquals(failed.transactionSubmissionAllowed, false);

  const blockedLiveWindow = evaluatePhase8WalletPromptOpening({
    ...baseInput,
    liveWindowPreparation: {
      ...liveWindowPreparation,
      walletPromptAllowed: false,
      reasons: ["live_window_approval_required"],
    },
  });
  assert(blockedLiveWindow.reasons.includes("live_window_not_ready"));

  const telegramIntent = evaluatePhase8WalletPromptOpening({
    ...baseInput,
    promptIntent: { ...promptIntent, source: "telegram" },
  });
  assert(telegramIntent.reasons.includes("telegram_authority_forbidden"));

  const publicIntent = evaluatePhase8WalletPromptOpening({
    ...baseInput,
    promptIntent: { ...promptIntent, source: "public_profile" },
    visibleInPublicProfile: true,
  });
  assert(publicIntent.reasons.includes("public_visibility_forbidden"));

  const reusedNonce = evaluatePhase8WalletPromptOpening({
    ...baseInput,
    promptIntent: { ...promptIntent, promptNonceUsed: true },
  });
  assert(reusedNonce.reasons.includes("one_time_prompt_nonce_unused_required"));

  const missingNonce = evaluatePhase8WalletPromptOpening({
    ...baseInput,
    promptIntent: { ...promptIntent, promptNonce: null },
  });
  assert(missingNonce.reasons.includes("one_time_prompt_nonce_required"));

  const wrongBinding = evaluatePhase8WalletPromptOpening({
    ...baseInput,
    promptIntent: { ...promptIntent, frozenActionFreezeKey: "other-freeze" },
  });
  assert(wrongBinding.reasons.includes("frozen_action_binding_required"));

  const missingAudit = evaluatePhase8WalletPromptOpening({
    ...baseInput,
    promptState: "opened",
    auditEvents: [],
  });
  assert(missingAudit.reasons.includes("owner_only_audit_required"));
  assert(missingAudit.reasons.includes("sanitized_audit_required"));

  const unsafeAudit = evaluatePhase8WalletPromptOpening({
    ...baseInput,
    promptState: "opened",
    auditEvents: [{ ...openedAudit, ownerOnly: false, sanitized: false }],
  });
  assert(unsafeAudit.reasons.includes("owner_only_audit_required"));
  assert(unsafeAudit.reasons.includes("sanitized_audit_required"));

  assertEquals(
    getPhase8WalletPromptOpeningBlockMessage("one_time_prompt_nonce_unused_required"),
    "A wallet prompt nonce can only be used once.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 wallet prompt opening checks passed.");