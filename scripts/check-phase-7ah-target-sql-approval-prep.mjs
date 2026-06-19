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

const doc = read("docs/phase-7AH-target-sql-approval-prep.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const readme = read("README.md");
const phase7AD = read("docs/phase-7AD-sql-verifier-final-approval-packet.md");
const phase7U = read(
  "docs/phase-7U-target-supabase-rate-limit-verifier-readiness.md",
);
const forwardSql = read(
  "supabase/base_mcp_status_rate_limit_forward_review.sql",
);
const verifierSql = read(
  "supabase/verify_base_mcp_status_rate_limit_contract.sql",
);
const rollbackSql = read(
  "supabase/base_mcp_status_rate_limit_rollback_review.sql",
);
const runtime = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const telegram = read("supabase/functions/telegram-webhook/core.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");

for (
  const value of [
    "Status: local target SQL approval prep complete.",
    "Current decision: target SQL approval not ready.",
    "No target Supabase project is selected.",
    "## Required Upstream State",
    "Phase 7AD SQL approval packet remains `SQL approval not requested`.",
    "## Target Approval Prep Fields",
    "Gate-off proof",
    "Forward SQL",
    "Verifier SQL",
    "Rollback SQL",
    "## Boolean Evidence Contract",
    "table_exists: true|false",
    "function_exists: true|false",
    "security_invoker: true|false",
    "safety_constraints_present: true|false",
    "## Hard Rejects",
    "Supabase service-role keys.",
    "Runtime gate already enabled before approval.",
    "## Prep Result States",
    "`target_sql_approval_not_ready`",
    "`ready_to_request_target_sql_approval`",
    "does not approve or apply SQL",
    "## Redacted Prep Template",
    "Decision: target_sql_approval_not_ready | rejected | ready_to_request_target_sql_approval",
    "## Guardrails",
    "Do not request service-role keys.",
    "Do not apply SQL.",
    "Do not run target verifier SQL.",
    "## Done Criteria",
  ]
) includes("Phase 7AH SQL prep", doc, value);

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
) excludes("Phase 7AH SQL prep", doc, forbidden);

for (
  const value of [
    "### 7AH - Target SQL Approval Prep",
    "SQL prep packet: `docs/phase-7AH-target-sql-approval-prep.md`.",
    "`npm run check:phase-7ah`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AI final smoke authorization packet complete.",
);

for (const value of ['"check:phase-7ah"', "npm run check:phase-7ah"]) {
  includes("package scripts", packageJson, value);
}

includes("README", readme, "target SQL approval prep");
includes(
  "Phase 7AD",
  phase7AD,
  "Current decision: SQL approval not requested.",
);
includes("Phase 7U", phase7U, "Current decision: blocked.");
includes("forward SQL", forwardSql, "REVIEW DRAFT - DO NOT APPLY");
includes("rollback SQL", rollbackSql, "REVIEW DRAFT - DO NOT APPLY");
includes("verifier SQL", verifierSql, "safety_constraints_present");
includes("runtime gate", runtime, 'return value === "true"');
excludes("Telegram runtime", telegram, "base-mcp-prepare");
excludes("public agent", publicAgent, "base-mcp-prepare");

console.log("Phase 7AH target SQL approval prep checks passed.");
