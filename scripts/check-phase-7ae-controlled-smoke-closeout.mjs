import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (name, source, value) =>
  assert(source.includes(value), `${name} must include: ${value}`);
const excludes = (name, source, value) =>
  assert(!source.includes(value), `${name} must not include: ${value}`);

const doc = read("docs/phase-7AE-controlled-smoke-closeout-runbook.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const readme = read("README.md");
const phase7AD = read("docs/phase-7AD-sql-verifier-final-approval-packet.md");
const phase7W = read("docs/phase-7W-redacted-smoke-approval-packet.md");
const phase7X = read("docs/phase-7X-final-pre-smoke-decision-matrix.md");
const phase7T = read("docs/phase-7T-custom-bridge-smoke-go-no-go.md");
const runtime = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const dependencies = read(
  "supabase/functions/base-mcp-prepare/dependencies.ts",
);
const providerAdapter = read(
  "supabase/functions/base-mcp-prepare/provider-adapter.ts",
);
const telegram = read("supabase/functions/telegram-webhook/core.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");

for (
  const value of [
    "Status: local controlled smoke closeout runbook complete.",
    "Current decision: smoke not authorized.",
    "No provider is approved.",
    "No SQL approval has been requested.",
    "No runtime gate is enabled.",
    "## Required Upstream Decisions",
    "Phase 7AD SQL approval packet",
    "`owner_sql_approved_for_target`",
    "Phase 7W smoke approval packet",
    "Phase 7X decision matrix",
    "## Authorization Boundary",
    "one action kind: `base_mcp_status_check`",
    "one chain: `base`",
    "one protocol: `kyra_status_v1`",
    "owner dashboard only",
    "## Pre-Window Checklist",
    "`KYRA_BASE_MCP_PREP_ENABLED` is confirmed off.",
    "Boolean-only target verifier output passed.",
    "Telegram and public profiles have no caller path.",
    "## Smoke Window Sequence",
    "trigger exactly one `base_mcp_status_check`",
    "Disable the runtime gate immediately.",
    "## Abort Rules",
    "Any unexpected wallet prompt opens.",
    "Telegram or public route can trigger the status check.",
    "## Closeout Checklist",
    "Exactly one approved owner-dashboard status check or zero if aborted before call",
    "No Telegram-created draft, provider call, approval, or execution",
    "## Safe Closeout Evidence",
    "smoke result state: aborted | failed-safe | closed",
    "gate-off confirmation",
    "## Result States",
    "`smoke_not_authorized`",
    "`aborted_before_call`",
    "`failed_safe`",
    "`closed`",
    "## Redacted Closeout Template",
    "Decision: smoke_not_authorized | aborted_before_call | failed_safe | closed",
    "## Guardrails",
    "Do not authorize smoke from this runbook.",
    "Do not apply SQL from this runbook.",
    "Do not enable runtime gates from this runbook.",
    "Do not contact providers from this runbook.",
    "Do not keep the runtime gate on after the window.",
    "## Done Criteria",
  ]
) includes("Phase 7AE closeout runbook", doc, value);

for (
  const forbidden of [
    "Authorization: Bearer",
    "Authorization: Basic",
    "api_key=",
    "token=",
    "SUPABASE_SERVICE_ROLE_KEY",
    "sk-or-v1-",
    "-----BEGIN",
    "KYRA_BASE_MCP_PREP_ENABLED=true",
    "approve automatically",
    "auto-enable",
  ]
) excludes("Phase 7AE closeout runbook", doc, forbidden);

for (
  const value of [
    "### 7AE - Controlled Smoke Closeout Runbook",
    "Closeout runbook: `docs/phase-7AE-controlled-smoke-closeout-runbook.md`.",
    "`npm run check:phase-7ae`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AI final smoke authorization packet complete.",
);

for (
  const value of [
    '"check:phase-7ae"',
    "npm run check:phase-7ae",
  ]
) includes("package scripts", packageJson, value);

includes("README", readme, "controlled smoke closeout runbook");
includes(
  "Phase 7AD SQL packet",
  phase7AD,
  "Current decision: SQL approval not requested.",
);
includes("Phase 7W approval", phase7W, "Current decision: blocked.");
includes("Phase 7X decision", phase7X, "Current decision: blocked.");
includes("Phase 7T smoke", phase7T, "Current decision: blocked.");
includes("runtime gate", runtime, 'return value === "true"');
excludes("dependencies", dependencies, "storePreparedActionSummary");
excludes("provider adapter", providerAdapter, "walletAddress");
excludes("provider adapter", providerAdapter, "telegramToken");
excludes("provider adapter", providerAdapter, "transactionHash");
excludes("Telegram runtime", telegram, "base-mcp-prepare");
excludes("public agent", publicAgent, "base-mcp-prepare");

console.log("Phase 7AE controlled smoke closeout checks passed.");
