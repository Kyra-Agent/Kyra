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

const doc = read(
  "docs/phase-7U-target-supabase-rate-limit-verifier-readiness.md",
);
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const forwardSql = read(
  "supabase/base_mcp_status_rate_limit_forward_review.sql",
);
const verifierSql = read(
  "supabase/verify_base_mcp_status_rate_limit_contract.sql",
);
const rollbackSql = read(
  "supabase/base_mcp_status_rate_limit_rollback_review.sql",
);
const phase7T = read("docs/phase-7T-custom-bridge-smoke-go-no-go.md");
const telegram = read("supabase/functions/telegram-webhook/core.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");

for (
  const value of [
    "Status: local target-verifier readiness packet complete.",
    "No SQL has been",
    "## Required Target Inputs",
    "confirmation that `KYRA_BASE_MCP_PREP_ENABLED=false`",
    "## Review Packet",
    "returns booleans only",
    "## Pre-Apply Checklist",
    "owner approved the target Supabase project",
    "If any item is false, do not apply SQL.",
    "## Safe Verifier Evidence",
    "table_exists: true|false",
    "service_delete_denied: true|false",
    "safety_constraints_present: true|false",
    "## Pass Criteria",
    "every boolean in the safe",
    "## Rollback Readiness",
    "runtime gate is confirmed off first",
    "## Hard Stops",
    "service-role key appears",
    "Current decision: blocked.",
    "## Done Criteria",
  ]
) includes("Phase 7U verifier readiness packet", doc, value);

for (
  const forbidden of [
    "supabase login --token",
    "service_role=",
    "SUPABASE_SERVICE_ROLE_KEY",
    "sk-or-v1-",
    "-----BEGIN",
    "set KYRA_BASE_MCP_PREP_ENABLED=true",
  ]
) excludes("Phase 7U verifier readiness packet", doc, forbidden);

for (
  const value of [
    "### 7U - Target Supabase Rate-Limit Verifier Readiness",
    "Verifier packet:",
    "`docs/phase-7U-target-supabase-rate-limit-verifier-readiness.md`",
    "`npm run check:phase-7u`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AD SQL verifier final approval packet complete.",
);

for (
  const value of [
    '"check:phase-7u"',
    "npm run check:phase-7u",
  ]
) includes("package scripts", packageJson, value);

for (const sql of [forwardSql, rollbackSql]) {
  includes("SQL review packet", sql, "REVIEW DRAFT - DO NOT APPLY");
}

for (
  const value of [
    "Returns booleans only",
    "table_exists",
    "function_exists",
    "rls_enabled",
    "anon_table_denied",
    "authenticated_table_denied",
    "service_table_granted",
    "service_delete_denied",
    "anon_function_denied",
    "authenticated_function_denied",
    "service_function_granted",
    "security_invoker",
    "exact_column_count",
    "safety_constraints_present",
  ]
) includes("verifier SQL", verifierSql, value);

includes("Phase 7T go/no-go", phase7T, "Rate-limit verifier");
excludes("Telegram runtime", telegram, "consume_base_mcp_status_rate_limit");
excludes("public agent", publicAgent, "consume_base_mcp_status_rate_limit");

console.log("Phase 7U target Supabase verifier checks passed.");
