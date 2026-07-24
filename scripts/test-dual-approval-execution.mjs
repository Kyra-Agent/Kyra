import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-dual-approval-test");
const outputPath = resolve(outDir, "dualApprovalExecution.mjs");

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
const preparedSource = stripImport(
  stripImport(
    readFileSync(resolve(root, "src/types/preparedAction.ts"), "utf8"),
    "../config/productChains",
  ),
  "./unsignedTransactionHandoff",
);
const riskSource = stripImport(
  readFileSync(resolve(root, "src/types/riskReview.ts"), "utf8"),
  "./unsignedTransactionHandoff",
);
const policySource = stripImport(
  stripImport(
    readFileSync(resolve(root, "src/types/preparedActionPolicy.ts"), "utf8"),
    "./preparedAction",
  ),
  "./riskReview",
);
const dualApprovalSource = stripImport(
  stripImport(
    readFileSync(resolve(root, "src/types/dualApprovalExecution.ts"), "utf8"),
    "./preparedAction",
  ),
  "./preparedActionPolicy",
);

const transpiled = ts.transpileModule(
  `${unsignedSource}\n${preparedSource}\n${riskSource}\n${policySource}\n${dualApprovalSource}`,
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
    },
  },
);

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    productChainId,
    evaluatePreparedActionPolicy,
    evaluateDualApprovalExecution,
    freezeReviewedPreparedAction,
    getDualApprovalBlockMessage,
    hasReviewedPreparedActionChanged,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const policyReview = evaluatePreparedActionPolicy({
    source: "owner_dashboard",
    walletExecutionEnabled: true,
    ownerSignedIn: true,
    selectedAgent: true,
    preparedActionStorageEnabled: true,
    ownerApprovalRecorded: true,
    actionKind: "robinhood_reviewed_transaction",
    chainId: productChainId,
    recipient: "0x1111111111111111111111111111111111111111",
    valueWei: "0",
    data: "0x",
    routeSummary: "Owner reviewed Robinhood Chain transaction preview.",
    valueSummary: "No token spend in this dual approval test.",
  });

  assertEquals(policyReview.status, "owner_review_required");
  const canonical = policyReview.allowlist.canonical;

  const frozenAction = freezeReviewedPreparedAction({
    requestId: "req_phase_7h",
    ownerUserId: "owner_phase_7h",
    workspaceId: "workspace_phase_7h",
    agentId: "agent_666",
    approvalId: "approval_phase_7h",
    approvedAt: "2026-06-25T00:00:00.000Z",
    canonical,
  });

  assert(frozenAction, "Owner approval must freeze the reviewed action.");
  assertEquals(frozenAction.frozen, true);
  assertEquals(frozenAction.actionKind, "robinhood_reviewed_transaction");

  const pending = evaluateDualApprovalExecution({
    policyReview,
    ownerDecision: { decision: "pending" },
    frozenAction: null,
    ownerWalletConnected: true,
    handoffValid: true,
    walletExecutionEnabled: false,
    walletSigningEnabled: false,
    hostedChainProviderEnabled: false,
  });
  assertEquals(pending.status, "owner_review_required");
  assert(pending.reasons.includes("owner_approval_required"));

  const rejected = evaluateDualApprovalExecution({
    policyReview,
    ownerDecision: { decision: "rejected" },
    frozenAction: null,
    ownerWalletConnected: true,
    handoffValid: true,
    walletExecutionEnabled: false,
    walletSigningEnabled: false,
    hostedChainProviderEnabled: false,
  });
  assertEquals(rejected.status, "owner_rejected");
  assertEquals(rejected.walletPromptAllowed, false);

  const missingIdentity = evaluateDualApprovalExecution({
    policyReview,
    ownerDecision: { decision: "approved" },
    frozenAction,
    ownerWalletConnected: true,
    handoffValid: true,
    walletExecutionEnabled: false,
    walletSigningEnabled: false,
    hostedChainProviderEnabled: false,
  });
  assert(missingIdentity.reasons.includes("approval_identity_required"));

  const approvedLocked = evaluateDualApprovalExecution({
    policyReview,
    ownerDecision: {
      decision: "approved",
      approvalId: "approval_phase_7h",
      ownerUserId: "owner_phase_7h",
      approvedAt: "2026-06-25T00:00:00.000Z",
    },
    frozenAction,
    ownerWalletConnected: true,
    handoffValid: true,
    walletExecutionEnabled: false,
    walletSigningEnabled: false,
    hostedChainProviderEnabled: false,
  });
  assertEquals(approvedLocked.status, "owner_wallet_prompt_locked");
  assertEquals(approvedLocked.walletPromptAllowed, false);
  assertEquals(approvedLocked.transactionSubmissionAllowed, false);
  assert(approvedLocked.reasons.includes("wallet_execution_disabled"));
  assert(approvedLocked.reasons.includes("wallet_signing_disabled"));
  assert(approvedLocked.reasons.includes("hosted_chain_provider_disabled"));

  const changedCanonical = {
    ...canonical,
    routeSummary: "Changed after owner approval.",
  };
  assert(
    hasReviewedPreparedActionChanged(frozenAction, changedCanonical),
    "Changing a reviewed action after approval must invalidate the freeze.",
  );

  const changedReview = {
    ...policyReview,
    allowlist: {
      ...policyReview.allowlist,
      canonical: changedCanonical,
    },
  };
  const changedBlocked = evaluateDualApprovalExecution({
    policyReview: changedReview,
    ownerDecision: {
      decision: "approved",
      approvalId: "approval_phase_7h",
      ownerUserId: "owner_phase_7h",
      approvedAt: "2026-06-25T00:00:00.000Z",
    },
    frozenAction,
    ownerWalletConnected: true,
    handoffValid: true,
    walletExecutionEnabled: false,
    walletSigningEnabled: false,
    hostedChainProviderEnabled: false,
  });
  assert(changedBlocked.reasons.includes("reviewed_action_changed"));

  const noConnection = evaluateDualApprovalExecution({
    policyReview,
    ownerDecision: {
      decision: "approved",
      approvalId: "approval_phase_7h",
      ownerUserId: "owner_phase_7h",
      approvedAt: "2026-06-25T00:00:00.000Z",
    },
    frozenAction,
    ownerWalletConnected: false,
    handoffValid: false,
    walletExecutionEnabled: false,
    walletSigningEnabled: false,
    hostedChainProviderEnabled: false,
  });
  assertEquals(noConnection.status, "owner_approved_frozen");
  assert(noConnection.reasons.includes("owner_wallet_connection_required"));
  assert(noConnection.reasons.includes("valid_handoff_required"));

  assertEquals(
    getDualApprovalBlockMessage("wallet_signing_disabled"),
    "Wallet signing remains disabled until the later execution gate.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Dual approval execution checks passed.");
