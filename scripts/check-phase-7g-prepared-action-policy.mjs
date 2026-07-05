import { readFileSync } from "node:fs";
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

function includes(sourceName, source, text) {
  assert(source.includes(text), `${sourceName} must include: ${text}`);
}

function excludes(sourceName, source, text) {
  assert(!source.includes(text), `${sourceName} must not include: ${text}`);
}

const packageJson = read("package.json");
const policy = read("src/types/preparedActionPolicy.ts");
const allowlist = read("src/types/preparedAction.ts");
const riskReview = read("src/types/riskReview.ts");
const walletPrompt = read("src/types/walletPromptEligibility.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const roadmap = read("docs/product-phase-roadmap.md");
const audit = read("docs/phase-7G-prepared-action-policy-enforcement.md");
const test = read("scripts/test-prepared-action-policy.mjs");
const baseMcpDependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");
const telegramRuntime = read("supabase/functions/telegram-webhook/read-only-pipeline.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");

includes("package.json", packageJson, "test:prepared-action-policy");
includes("package.json", packageJson, "check-phase-7g-prepared-action-policy.mjs");

for (
  const expected of [
    "PreparedActionPolicyBlockReason",
    "PreparedActionPolicyStatus",
    "PreparedActionPolicyInput",
    "PreparedActionPolicyResult",
    "evaluatePreparedActionPolicy",
    "reviewPreparedActionAllowlist",
    "reviewPreparedActionRisk",
    "owner_session_required",
    "agent_binding_required",
    "allowlist_rejected",
    "prepared_action_storage_disabled",
    "risk_review_blocked",
    "owner_approval_required",
    "allowedForStorage: false",
    "allowedForStorage: true",
  ]
) {
  includes("prepared action policy", policy, expected);
}

includes("allowlist", allowlist, "source !== \"owner_dashboard\"");
includes("allowlist", allowlist, "token_spend_not_allowed");
includes("allowlist", allowlist, "calldata_not_allowed");
includes("risk review", riskReview, "NYX-05 review required before wallet prompt.");
includes("wallet prompt", walletPrompt, "reviewed_prepared_action_required");
includes("wallet prompt", walletPrompt, "owner_approval_required");

for (
  const expected of [
    "evaluatePreparedActionPolicy",
    "Phase 7G policy enforcement",
    "preparedActionStorageEnabled: false",
    "Owner approval",
    "Replay",
    "request id scoped",
    "Blocked by:",
  ]
) {
  includes("dashboard policy evidence", dashboard, expected);
}

includes("dashboard styles", styles, "prepared-action-policy-panel");
includes("dashboard styles", styles, "prepared-action-policy-grid");

for (
  const expected of [
    "# Phase 7G Prepared-Action Policy Enforcement",
    "Status: complete as a policy enforcement boundary.",
    "Production prepared-action storage remains disabled.",
    "Only owner-dashboard intent can enter policy review.",
    "NYX-05 risk review is required before any owner approval or wallet prompt.",
    "Owner approval remains required.",
    "Wallet signing and transaction submission remain disabled.",
    "`npm run check:phase-7g`",
  ]
) {
  includes("Phase 7G policy audit", audit, expected);
}

includes("roadmap", roadmap, "### 7G - Prepared Action And Policy Enforcement");
includes("roadmap", roadmap, "Status: complete as a policy enforcement boundary.");
includes("roadmap", roadmap, "`src/types/preparedActionPolicy.ts`");
includes("roadmap", roadmap, "`scripts/test-prepared-action-policy.mjs`");
includes("roadmap", roadmap, "Phase 7H dual approval and freeze boundary is implemented");
includes("roadmap", roadmap, "Phase 7I result monitoring and closeout boundary is implemented");
includes("roadmap", roadmap, "Phase 7J controlled live transaction gate is implemented");
includes("roadmap", roadmap, "In progress: Batch 15");

for (
  const expected of [
    "Prepared action policy checks passed.",
    "Telegram must not create prepared actions.",
    "prepared_action_storage_disabled",
    "owner_approval_required",
  ]
) {
  includes("prepared action policy test", test, expected);
}

excludes("Base MCP dependencies", baseMcpDependencies, "storePreparedActionSummary");
excludes("Telegram runtime", telegramRuntime, "evaluatePreparedActionPolicy");
excludes("Public agent route", publicAgent, "evaluatePreparedActionPolicy");

console.log("Phase 7G prepared-action policy checks passed.");
