import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(sourceName, source, text) {
  assert(source.includes(text), `${sourceName} must include: ${text}`);
}

function assertNotIncludes(sourceName, source, text) {
  assert(!source.includes(text), `${sourceName} must not include: ${text}`);
}

function assertFileExists(path) {
  assert(existsSync(resolve(root, path)), `${path} must exist.`);
}

const packageJson = read("package.json");
const model = read("src/types/dualApprovalExecution.ts");
const test = read("scripts/test-dual-approval-execution.mjs");
const checker = read("scripts/check-phase-7h-dual-approval.mjs");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const doc = read("docs/phase-7H-dual-approval-execution.md");
const roadmap = read("docs/product-phase-roadmap.md");
const dependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");
const telegramCore = read("supabase/functions/telegram-webhook/core.ts");
const telegramReadOnlyPipeline = read(
  "supabase/functions/telegram-webhook/read-only-pipeline.ts",
);
const publicAgent = read("src/pages/PublicAgent.tsx");

for (
  const path of [
    "src/types/dualApprovalExecution.ts",
    "scripts/test-dual-approval-execution.mjs",
    "scripts/check-phase-7h-dual-approval.mjs",
    "docs/phase-7H-dual-approval-execution.md",
  ]
) {
  assertFileExists(path);
}

for (
  const required of [
    "DualApprovalDecision",
    "DualApprovalStatus",
    "DualApprovalBlockReason",
    "FrozenPreparedAction",
    "freezeReviewedPreparedAction",
    "hasReviewedPreparedActionChanged",
    "evaluateDualApprovalExecution",
    "walletPromptAllowed: false",
    "transactionSubmissionAllowed: false",
    "wallet_execution_disabled",
    "wallet_signing_disabled",
    "official_mcp_disabled",
    "reviewed_action_changed",
  ]
) {
  assertIncludes("dual approval model", model, required);
}

assertNotIncludes("dual approval model", model, "sendTransaction");
assertNotIncludes("dual approval model", model, "writeContract");
assertNotIncludes("dual approval model", model, "eth_sendTransaction");

for (
  const required of [
    "Owner approval must freeze the reviewed action.",
    "Changing a reviewed action after approval must invalidate the freeze.",
    "base_account_prompt_locked",
    "wallet_execution_disabled",
    "wallet_signing_disabled",
    "official_mcp_disabled",
    "reviewed_action_changed",
    "Dual approval execution checks passed.",
  ]
) {
  assertIncludes("dual approval test", test, required);
}

for (
  const required of [
    "test:dual-approval-execution",
    "check-phase-7h-dual-approval.mjs",
    "check-phase-7h-release-rollback.mjs",
  ]
) {
  assertIncludes("package.json", packageJson, required);
}

for (
  const required of [
    "evaluateDualApprovalExecution",
    "dualApprovalReview",
    "Phase 7H dual approval",
    "Frozen action",
    "Wallet prompt",
    "Transaction submission:",
    "execution gate remains closed",
  ]
) {
  assertIncludes("dashboard", dashboard, required);
}

for (
  const required of [
    ".dual-approval-panel",
    ".dual-approval-header",
    ".dual-approval-steps",
  ]
) {
  assertIncludes("styles", styles, required);
}

for (
  const required of [
    "# Phase 7H Dual Approval Execution",
    "Status: complete as a local dual-approval and freeze boundary.",
    "Kyra approval and Base Account approval are separate decisions.",
    "Kyra freezes the reviewed action fields.",
    "wallet prompts",
    "wallet signing",
    "transaction submission",
    "official hosted Base MCP authority remains disabled",
    "npm run test:dual-approval-execution",
    "npm run check:phase-7h",
  ]
) {
  assertIncludes("Phase 7H document", doc, required);
}

for (
  const required of [
    "### 7H - Dual Approval Execution",
    "Status: complete as a local dual-approval and freeze boundary.",
    "docs/phase-7H-dual-approval-execution.md",
    "src/types/dualApprovalExecution.ts",
    "Phase 7H dual approval and freeze boundary is implemented",
    "Phase 7I result monitoring and closeout boundary is implemented",
    "Phase 7J controlled live transaction gate is implemented",
    "In progress: Batch 12",
  ]
) {
  assertIncludes("roadmap", roadmap, required);
}

assertIncludes("checker self-reference", checker, "Phase 7H dual approval checks passed.");
assertNotIncludes("Base MCP dependencies", dependencies, "storePreparedActionSummary");
assertNotIncludes("telegram core", telegramCore, "evaluateDualApprovalExecution");
assertNotIncludes(
  "telegram read-only pipeline",
  telegramReadOnlyPipeline,
  "evaluateDualApprovalExecution",
);
assertNotIncludes("public agent", publicAgent, "evaluateDualApprovalExecution");

console.log("Phase 7H dual approval checks passed.");
