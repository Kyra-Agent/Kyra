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

const doc = read("docs/phase-7AD-sql-verifier-final-approval-packet.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const readme = read("README.md");
const phase7U = read(
  "docs/phase-7U-target-supabase-rate-limit-verifier-readiness.md",
);
const phase7T = read("docs/phase-7T-custom-bridge-smoke-go-no-go.md");
const phase7AC = read("docs/phase-7AC-candidate-dossier-fill-gate.md");
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
    "Status: local SQL verifier final approval packet complete.",
    "Current decision: SQL approval not requested.",
    "No target Supabase project is selected or approved.",
    "No SQL has been applied.",
    "## Approval Prerequisites",
    "Phase 7U target-verifier readiness packet remains blocked.",
    "Phase 7T custom bridge smoke go/no-go remains blocked.",
    "Phase 7AC candidate dossier fill decision remains blocked or not filled.",
    "## Approval Scope",
    "Forward SQL: `supabase/base_mcp_status_rate_limit_forward_review.sql`.",
    "Verifier SQL: `supabase/verify_base_mcp_status_rate_limit_contract.sql`.",
    "Rollback SQL: `supabase/base_mcp_status_rate_limit_rollback_review.sql`.",
    "## Forbidden Approval Material",
    "Supabase service-role keys",
    "Telegram bot tokens",
    "Provider API keys",
    "Wallet addresses",
    "Official MCP OAuth client ids",
    "Raw database rows",
    "## Approval Checklist",
    "Target project",
    "Gate-off proof",
    "Rollback readiness",
    "Boolean verifier evidence",
    "## Safe Verifier Output",
    "table_exists: true|false",
    "function_exists: true|false",
    "rls_enabled: true|false",
    "anon_table_denied: true|false",
    "authenticated_table_denied: true|false",
    "service_table_granted: true|false",
    "service_delete_denied: true|false",
    "anon_function_denied: true|false",
    "authenticated_function_denied: true|false",
    "service_function_granted: true|false",
    "security_invoker: true|false",
    "exact_column_count: true|false",
    "safety_constraints_present: true|false",
    "## Approval Result States",
    "`owner_sql_approved_for_target`",
    "does not apply SQL",
    "## Redacted Approval Template",
    "Decision: blocked | rejected | ready_to_request_owner_sql_approval | owner_sql_approved_for_target",
    "## Guardrails",
    "Do not apply SQL.",
    "Do not run target verifier SQL.",
    "Do not request or paste service-role keys.",
    "Do not enable runtime gates.",
    "Do not move directly from SQL approval to smoke.",
    "## Done Criteria",
  ]
) includes("Phase 7AD SQL approval packet", doc, value);

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
) excludes("Phase 7AD SQL approval packet", doc, forbidden);

for (
  const value of [
    "### 7AD - SQL Verifier Final Approval Packet",
    "SQL approval packet: `docs/phase-7AD-sql-verifier-final-approval-packet.md`.",
    "`npm run check:phase-7ad`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AJ controlled read-only Base status smoke complete.",
);

for (
  const value of [
    '"check:phase-7ad"',
    "npm run check:phase-7ad",
  ]
) includes("package scripts", packageJson, value);

includes("README", readme, "Base MCP remains an optional provider adapter track");
includes("Phase 7U verifier", phase7U, "Current decision: blocked.");
includes("Phase 7T smoke", phase7T, "Current decision: blocked.");
includes(
  "Phase 7AC dossier",
  phase7AC,
  "Current decision: no candidate dossier filled.",
);
includes("forward SQL", forwardSql, "REVIEW DRAFT - DO NOT APPLY");
includes("rollback SQL", rollbackSql, "REVIEW DRAFT - DO NOT APPLY");

for (
  const value of [
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

includes("runtime gate", runtime, 'return value === "true"');
includes(
  "runtime endpoint",
  runtime,
  'url.hostname.toLowerCase() === "mcp.base.org"',
);
excludes("dependencies", dependencies, "storePreparedActionSummary");
excludes("provider adapter", providerAdapter, "walletAddress");
excludes("provider adapter", providerAdapter, "telegramToken");
excludes("provider adapter", providerAdapter, "transactionHash");
excludes("Telegram runtime", telegram, "base-mcp-prepare");
excludes("public agent", publicAgent, "base-mcp-prepare");

console.log("Phase 7AD SQL verifier final approval packet checks passed.");
