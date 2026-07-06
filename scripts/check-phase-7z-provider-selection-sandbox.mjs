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

const doc = read("docs/phase-7Z-provider-selection-sandbox.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const readme = read("README.md");
const phase7Y = read("docs/phase-7Y-full-pre-provider-audit.md");
const phase7V = read("docs/phase-7V-provider-candidate-dossier.md");
const phase7M = read("docs/phase-7M-provider-contract-qualification.md");
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
    "Status: local provider selection sandbox complete.",
    "Current decision: no provider selected.",
    "No provider has been contacted.",
    "No endpoint has been",
    "No credential has been requested or pasted.",
    "## Allowed Sandbox Inputs",
    "Endpoint origin only",
    "Expected protocol: `kyra_status_v1`.",
    "Expected path: `POST /status-check`.",
    "Credential type without credential value.",
    "## Forbidden Sandbox Inputs",
    "Provider API keys",
    "Telegram bot tokens or token refs.",
    "Supabase service-role keys",
    "Wallet addresses",
    "Raw provider request bodies",
    "Official MCP OAuth client ids",
    "## Candidate Scorecard",
    "Data boundary",
    "OAuth boundary",
    "Surface boundary",
    "## Rejection Rules",
    "Candidate requires official MCP OAuth",
    "Candidate requires any `agent_wallet:*` scope.",
    "Candidate requires running a live probe before the dossier is complete.",
    "## Sandbox Result States",
    "`candidate_for_dossier`",
    "does not approve provider use",
    "## Offline Review Template",
    "Decision: rejected | incomplete | candidate_for_dossier",
    "## Guardrails",
    "Do not call the provider.",
    "Do not set runtime gates.",
    "Do not apply SQL.",
    "Do not move directly from sandbox to smoke approval.",
    "## Done Criteria",
  ]
) includes("Phase 7Z sandbox", doc, value);

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
) excludes("Phase 7Z sandbox", doc, forbidden);

for (
  const value of [
    "### 7Z - Provider Selection Sandbox",
    "Sandbox packet: `docs/phase-7Z-provider-selection-sandbox.md`.",
    "`npm run check:phase-7z`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AJ controlled read-only Base status smoke complete.",
);

for (
  const value of [
    '"check:phase-7z"',
    "npm run check:phase-7z",
  ]
) includes("package scripts", packageJson, value);

includes("README", readme, "Base MCP remains an optional provider adapter track");
includes("Phase 7Y audit", phase7Y, "Phase 7Y is locally green");
includes("Phase 7V dossier", phase7V, "Current decision: blocked.");
includes("Phase 7M contract", phase7M, "kyra_status_v1");
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

console.log("Phase 7Z provider selection sandbox checks passed.");
