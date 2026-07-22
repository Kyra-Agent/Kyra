import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-submission-test");
const outputPath = resolve(outDir, "phase8ControlledSubmission.mjs");

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

const source = [
  'const currentProductChain = Object.freeze({ id: 8453, name: "Base" });',
  stripImports(
    readFileSync(resolve(root, "src/types/phase8ControlledSubmission.ts"), "utf8"),
  ),
].join("\n");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    evaluatePhase8ControlledSubmission,
    getPhase8ControlledSubmissionBlockMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const ownerUserId = "owner_1";
  const workspaceId = "workspace_1";
  const agentId = "agent_777";
  const txHash = "0x1111111111111111111111111111111111111111111111111111111111111111";
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
  const walletPromptOpening = {
    status: "prompt_approved",
    ownerOnly: true,
    walletPromptOpenAllowed: false,
    walletApprovalRecorded: true,
    transactionSubmissionAllowed: false,
    reasons: [],
    message: "Wallet approved.",
  };
  const submissionIntent = {
    source: "private_dashboard",
    ownerClickedSubmit: true,
    ownerUserId,
    workspaceId,
    agentId,
    frozenActionFreezeKey: frozenAction.freezeKey,
    submissionNonce: "submission_nonce_1",
    submissionNonceUsed: false,
    requestedAt: "2026-07-03T10:01:00.000Z",
  };
  const submittedEvent = {
    state: "submitted",
    ownerOnly: true,
    sanitized: true,
    txHash,
    message: "Submitted with sanitized hash reference.",
    createdAt: "2026-07-03T10:01:01.000Z",
  };
  const confirmedEvent = {
    ...submittedEvent,
    state: "confirmed",
    message: "Confirmed with sanitized hash reference.",
  };
  const failedEvent = {
    ...submittedEvent,
    state: "failed",
    message: "Failed with sanitized hash reference.",
  };
  const baseInput = {
    walletPromptOpening,
    ownerUserId,
    workspaceId,
    selectedAgentId: agentId,
    frozenAction,
    chain: "Base",
    baseAccountApprovalRecorded: true,
    submissionIntent,
    submissionState: "ready",
    resultEvents: [],
    rollbackReady: true,
    emergencyDisableReady: true,
    postTransactionAuditReady: true,
    visibleInPublicProfile: false,
  };

  const ready = evaluatePhase8ControlledSubmission(baseInput);
  assertEquals(ready.status, "ready_to_submit");
  assertEquals(ready.transactionSubmissionAllowed, true);
  assertEquals(ready.resultCloseoutRecorded, false);
  assertEquals(ready.reasons.length, 0);

  const submitted = evaluatePhase8ControlledSubmission({
    ...baseInput,
    submissionState: "submitted",
    resultEvents: [submittedEvent],
  });
  assertEquals(submitted.status, "submitted_pending_confirmation");
  assertEquals(submitted.transactionSubmissionAllowed, false);
  assertEquals(submitted.resultCloseoutRecorded, true);

  const confirmed = evaluatePhase8ControlledSubmission({
    ...baseInput,
    submissionState: "confirmed",
    resultEvents: [confirmedEvent],
  });
  assertEquals(confirmed.status, "closed_confirmed");
  assertEquals(confirmed.resultCloseoutRecorded, true);

  const failed = evaluatePhase8ControlledSubmission({
    ...baseInput,
    submissionState: "failed",
    resultEvents: [failedEvent],
  });
  assertEquals(failed.status, "closed_failed");
  assertEquals(failed.resultCloseoutRecorded, true);

  const missingPromptApproval = evaluatePhase8ControlledSubmission({
    ...baseInput,
    walletPromptOpening: { ...walletPromptOpening, status: "prompt_opened", walletApprovalRecorded: false },
  });
  assert(missingPromptApproval.reasons.includes("wallet_prompt_approval_required"));

  const telegramIntent = evaluatePhase8ControlledSubmission({
    ...baseInput,
    submissionIntent: { ...submissionIntent, source: "telegram" },
  });
  assert(telegramIntent.reasons.includes("telegram_authority_forbidden"));

  const publicIntent = evaluatePhase8ControlledSubmission({
    ...baseInput,
    submissionIntent: { ...submissionIntent, source: "public_profile" },
    visibleInPublicProfile: true,
  });
  assert(publicIntent.reasons.includes("public_visibility_forbidden"));

  const reusedNonce = evaluatePhase8ControlledSubmission({
    ...baseInput,
    submissionIntent: { ...submissionIntent, submissionNonceUsed: true },
  });
  assert(reusedNonce.reasons.includes("submission_nonce_unused_required"));

  const missingNonce = evaluatePhase8ControlledSubmission({
    ...baseInput,
    submissionIntent: { ...submissionIntent, submissionNonce: null },
  });
  assert(missingNonce.reasons.includes("submission_nonce_required"));

  const wrongBinding = evaluatePhase8ControlledSubmission({
    ...baseInput,
    submissionIntent: { ...submissionIntent, frozenActionFreezeKey: "other-freeze" },
  });
  assert(wrongBinding.reasons.includes("frozen_action_binding_required"));

  const missingBaseApproval = evaluatePhase8ControlledSubmission({
    ...baseInput,
    baseAccountApprovalRecorded: false,
  });
  assert(missingBaseApproval.reasons.includes("base_account_approval_required"));

  const nonBase = evaluatePhase8ControlledSubmission({
    ...baseInput,
    chain: "Base Sepolia",
  });
  assert(nonBase.reasons.includes("base_chain_required"));

  const nonZero = evaluatePhase8ControlledSubmission({
    ...baseInput,
    frozenAction: { ...frozenAction, valueWei: "1" },
  });
  assert(nonZero.reasons.includes("zero_value_action_required"));

  const calldata = evaluatePhase8ControlledSubmission({
    ...baseInput,
    frozenAction: { ...frozenAction, data: "0x1234" },
  });
  assert(calldata.reasons.includes("no_calldata_required"));

  const missingHash = evaluatePhase8ControlledSubmission({
    ...baseInput,
    submissionState: "submitted",
    resultEvents: [],
  });
  assert(missingHash.reasons.includes("tx_hash_required"));

  const unsafeResult = evaluatePhase8ControlledSubmission({
    ...baseInput,
    submissionState: "submitted",
    resultEvents: [{ ...submittedEvent, ownerOnly: false, sanitized: false, txHash: "raw-payload" }],
  });
  assert(unsafeResult.reasons.includes("owner_only_result_required"));
  assert(unsafeResult.reasons.includes("sanitized_tx_hash_required"));
  assert(unsafeResult.reasons.includes("sanitized_audit_required"));

  const missingRollback = evaluatePhase8ControlledSubmission({
    ...baseInput,
    rollbackReady: false,
    emergencyDisableReady: false,
    postTransactionAuditReady: false,
  });
  assert(missingRollback.reasons.includes("rollback_required"));
  assert(missingRollback.reasons.includes("emergency_disable_required"));
  assert(missingRollback.reasons.includes("post_transaction_audit_required"));

  assertEquals(
    getPhase8ControlledSubmissionBlockMessage("submission_nonce_unused_required"),
    "A submission nonce can only be used once.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 controlled submission checks passed.");
