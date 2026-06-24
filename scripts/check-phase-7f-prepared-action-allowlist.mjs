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
const preparedActionTypes = read("src/types/preparedAction.ts");
const walletPromptEligibility = read("src/types/walletPromptEligibility.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const roadmap = read("docs/product-phase-roadmap.md");
const audit = read("docs/phase-7F-prepared-action-allowlist.md");
const legacyTelegramAudit = read("docs/phase-7F-telegram-execution-boundary-audit.md");
const test = read("scripts/test-prepared-action-allowlist.mjs");
const baseMcpCore = read("supabase/functions/base-mcp-prepare/core.ts");
const telegramWebhook = read("supabase/functions/telegram-webhook/read-only-pipeline.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");

includes("package.json", packageJson, "test:prepared-action-allowlist");
includes("package.json", packageJson, "check-phase-7f-prepared-action-allowlist.mjs");

for (
  const expected of [
    '"base_mcp_status_check"',
    '"base_reviewed_transaction"',
    "PreparedActionSource",
    "PreparedActionAllowlistBlockReason",
    "PreparedActionCanonicalInput",
    "reviewPreparedActionAllowlist",
    "source !== \"owner_dashboard\"",
    "wallet_execution_disabled",
    "base_chain_required",
    "invalid_recipient",
    "invalid_value",
    "invalid_calldata",
    "calldata_not_allowed",
    "token_spend_not_allowed",
    "isEvmAddress",
    "isHexData",
    "isSafeValueWei",
    "input.data !== \"0x\"",
    "input.valueWei !== \"0\"",
  ]
) {
  includes("prepared action allowlist type", preparedActionTypes, expected);
}

for (
  const expected of [
    "PreparedAction Allowlist",
    "Source",
    "owner dashboard",
    "Allowed kinds",
    "base_mcp_status_check",
    "base_reviewed_transaction",
    "Token spend",
    "blocked in 7F",
    "Calldata",
    "blocked in 7F",
  ]
) {
  includes("dashboard allowlist evidence", dashboard, expected);
}

includes("dashboard styles", styles, "prepared-action-allowlist-grid");
includes("wallet prompt guard", walletPromptEligibility, "reviewed_prepared_action_required");
includes("wallet prompt guard", walletPromptEligibility, "risk_review_required");
includes("wallet prompt guard", walletPromptEligibility, "owner_approval_required");

for (
  const expected of [
    "# Phase 7F Prepared-Action Adapter Allowlist",
    "Status: complete as a deterministic allowlist boundary.",
    "Only the private owner dashboard is a trusted source.",
    "Telegram, LLM output, provider output, plugins, and public pages are untrusted.",
    "Token spend is blocked in Phase 7F.",
    "Calldata is blocked in Phase 7F.",
    "Wallet signing and transaction submission remain disabled.",
    "`npm run check:phase-7f`",
  ]
) {
  includes("Phase 7F allowlist audit", audit, expected);
}

includes("legacy Telegram audit", legacyTelegramAudit, "Telegram remains read-only");
includes("roadmap", roadmap, "### 7F - Prepared-Action Adapter Allowlist");
includes("roadmap", roadmap, "Status: complete as a deterministic allowlist boundary.");
includes("roadmap", roadmap, "`src/types/preparedAction.ts`");
includes("roadmap", roadmap, "`scripts/test-prepared-action-allowlist.mjs`");

for (
  const expected of [
    "Prepared action allowlist checks passed.",
    "Telegram must not create prepared actions.",
    "Phase 7F must not allow token spend.",
    "Phase 7F must not allow calldata.",
    "Non-Base action must fail closed.",
  ]
) {
  includes("allowlist test", test, expected);
}

excludes("Base MCP prepare core", baseMcpCore, "base_reviewed_transaction");
excludes("Telegram webhook runtime", telegramWebhook, "reviewPreparedActionAllowlist");
excludes("Public agent route", publicAgent, "reviewPreparedActionAllowlist");

console.log("Phase 7F prepared-action allowlist checks passed.");
