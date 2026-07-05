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

function includes(label, source, expected) {
  assert(source.includes(expected), `${label} must include: ${expected}`);
}

function excludes(label, source, forbidden) {
  assert(!source.includes(forbidden), `${label} must not include: ${forbidden}`);
}

function fileExists(path) {
  assert(existsSync(resolve(root, path)), `${path} must exist.`);
}

for (
  const path of [
    "src/types/resultMonitoringCloseout.ts",
    "scripts/test-result-monitoring-closeout.mjs",
    "scripts/check-phase-7i-result-monitoring-closeout.mjs",
    "docs/phase-7I-result-monitoring-closeout.md",
  ]
) {
  fileExists(path);
}

const model = read("src/types/resultMonitoringCloseout.ts");
const test = read("scripts/test-result-monitoring-closeout.mjs");
const checker = read("scripts/check-phase-7i-result-monitoring-closeout.mjs");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const doc = read("docs/phase-7I-result-monitoring-closeout.md");
const roadmap = read("docs/product-phase-roadmap.md");
const packageJson = read("package.json");
const telegramCore = read("supabase/functions/telegram-webhook/core.ts");
const telegramReadOnlyPipeline = read(
  "supabase/functions/telegram-webhook/read-only-pipeline.ts",
);
const publicAgent = read("src/pages/PublicAgent.tsx");
const dependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");

for (
  const required of [
    "ResultMonitorProviderStatus",
    "ResultMonitorCloseoutStatus",
    "ResultMonitorBlockReason",
    "evaluateResultMonitoringCloseout",
    "sanitizeResultMonitoringFailure",
    "provider_submission_required_for_tx_hash",
    "transaction_hash_required_after_submission",
    "public_visibility_forbidden",
    "disconnect_requires_closed_state",
    "ownerOnly: true",
    "txHash: isTransactionHash(input.txHash)",
  ]
) {
  includes("result monitoring model", model, required);
}

for (
  const forbidden of [
    "sendTransaction",
    "writeContract",
    "eth_sendTransaction",
    "storePreparedActionSummary",
  ]
) {
  excludes("result monitoring model", model, forbidden);
}

for (
  const required of [
    "Result monitoring closeout checks passed.",
    "provider_submission_required_for_tx_hash",
    "confirmation_required",
    "public_visibility_forbidden",
    "disconnect_requires_closed_state",
    "closed_disabled",
    "Transaction hash is forbidden until provider submission is observed.",
  ]
) {
  includes("result monitoring test", test, required);
}

for (
  const required of [
    "test:result-monitoring-closeout",
    "check-phase-7i-result-monitoring-closeout.mjs",
    "check-phase-7i-base-mcp-status-decision.mjs",
  ]
) {
  includes("package.json", packageJson, required);
}

for (
  const required of [
    "evaluateResultMonitoringCloseout",
    "resultMonitoringCloseout",
    "Phase 7I result monitoring",
    "Tx hash",
    "not persisted",
    "Disconnect",
    "Emergency",
    "No public result data, wallet",
  ]
) {
  includes("dashboard", dashboard, required);
}

for (
  const required of [
    ".result-monitoring-panel",
    ".result-monitoring-header",
    ".result-monitoring-grid",
  ]
) {
  includes("styles", styles, required);
}

for (
  const required of [
    "# Phase 7I Result Monitoring And Closeout",
    "Status: complete as a local result monitoring and closeout boundary.",
    "Kyra may record a transaction hash only after a provider submission has been",
    "public profile visibility is forbidden",
    "transaction hash is forbidden before provider submission",
    "disconnect is allowed only after a closed, expired, or disabled state",
    "does not poll a provider",
    "npm run test:result-monitoring-closeout",
    "npm run check:phase-7i",
  ]
) {
  includes("Phase 7I closeout doc", doc, required);
}

for (
  const required of [
    "### 7I - Result Monitoring And Closeout",
    "Status: complete as a local result monitoring and closeout boundary.",
    "docs/phase-7I-result-monitoring-closeout.md",
    "src/types/resultMonitoringCloseout.ts",
    "Phase 7I result monitoring and closeout boundary is implemented",
    "Phase 7J controlled live transaction gate is implemented",
    "In progress: Batch 19",
  ]
) {
  includes("roadmap", roadmap, required);
}

includes("checker self-reference", checker, "Phase 7I result monitoring checks passed.");
excludes("telegram core", telegramCore, "evaluateResultMonitoringCloseout");
excludes("telegram read-only pipeline", telegramReadOnlyPipeline, "evaluateResultMonitoringCloseout");
excludes("public agent", publicAgent, "evaluateResultMonitoringCloseout");
excludes("Base MCP dependencies", dependencies, "storePreparedActionSummary");

console.log("Phase 7I result monitoring checks passed.");
