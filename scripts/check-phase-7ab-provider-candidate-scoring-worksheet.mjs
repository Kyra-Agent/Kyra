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

const doc = read("docs/phase-7AB-provider-candidate-scoring-worksheet.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const readme = read("README.md");
const phase7AA = read("docs/phase-7AA-provider-candidate-intake-gate.md");
const phase7Z = read("docs/phase-7Z-provider-selection-sandbox.md");
const phase7V = read("docs/phase-7V-provider-candidate-dossier.md");
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
    "Status: local provider candidate scoring worksheet complete.",
    "Current decision: no candidate scored.",
    "No provider is nominated, selected, approved, contacted, or called.",
    "offline-only",
    "## Scoring Inputs",
    "Provider/project name from owner nomination.",
    "Endpoint origin only.",
    "Expected protocol: `kyra_status_v1`.",
    "Expected path: `POST /status-check`.",
    "## Hard-Fail Rules",
    "Any hard fail forces `rejected`, regardless of numeric score:",
    "Candidate requires official MCP OAuth.",
    "Candidate requires any `agent_wallet:*` scope.",
    "Candidate endpoint is not HTTPS or is `mcp.base.org`.",
    "Candidate asks for wallet data, Telegram data, Supabase data, user identity",
    "## Weighted Scorecard",
    "| Total | 100 | Sum of all rows after hard-fail review | 0 |",
    "## Minimum Scoring Floors",
    "Total score is at least 90.",
    "Data boundary score is 20.",
    "Protocol and path fit score is 15.",
    "Endpoint safety score is 10.",
    "## Result States",
    "`score_below_floor`",
    "`scored_ready_for_7z_sandbox`",
    "does not approve provider use",
    "## Redacted Scoring Template",
    "Decision: rejected | needs_owner_input | incomplete | score_below_floor | scored_ready_for_7z_sandbox",
    "## Guardrails",
    "Do not call the provider.",
    "Do not request credentials.",
    "Do not score raw provider request or response bodies.",
    "Do not set runtime gates.",
    "Do not apply SQL.",
    "Do not move directly from scoring to dossier approval.",
    "## Done Criteria",
  ]
) includes("Phase 7AB scoring worksheet", doc, value);

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
) excludes("Phase 7AB scoring worksheet", doc, forbidden);

for (
  const value of [
    "### 7AB - Provider Candidate Scoring Worksheet",
    "Scoring packet: `docs/phase-7AB-provider-candidate-scoring-worksheet.md`.",
    "`npm run check:phase-7ab`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AJ controlled read-only Base status smoke complete.",
);

for (
  const value of [
    '"check:phase-7ab"',
    "npm run check:phase-7ab",
  ]
) includes("package scripts", packageJson, value);

includes("README", readme, "Base MCP remains an optional provider adapter track");
includes(
  "Phase 7AA intake",
  phase7AA,
  "Current decision: no candidate intake accepted.",
);
includes(
  "Phase 7Z sandbox",
  phase7Z,
  "Current decision: no provider selected.",
);
includes("Phase 7V dossier", phase7V, "Current decision: blocked.");
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

console.log("Phase 7AB provider candidate scoring checks passed.");
