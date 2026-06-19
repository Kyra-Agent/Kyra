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

const doc = read("docs/phase-7AA-provider-candidate-intake-gate.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const readme = read("README.md");
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
    "Status: local provider candidate intake gate complete.",
    "Current decision: no candidate intake accepted.",
    "No provider is nominated, selected, approved, contacted, or called.",
    "No credential has been requested, pasted, stored, or rotated.",
    "## Intake Source Rules",
    "Owner-provided provider or project name.",
    "Public website or public documentation URL.",
    "Endpoint origin only",
    "Credential type without credential value.",
    "Written statement that the provider can support exact `kyra_status_v1`.",
    "Written statement that the provider can support `POST /status-check`.",
    "## Forbidden Intake Material",
    "Provider API keys",
    "Telegram bot tokens",
    "Supabase service-role keys",
    "Wallet addresses",
    "Official MCP OAuth client ids",
    "Raw provider request bodies",
    "## Intake Acceptance Checklist",
    "Owner nomination",
    "Protocol fit",
    "Surface boundary",
    "Authority boundary",
    "## Rejection Rules",
    "Candidate is not explicitly owner-nominated.",
    "Candidate requires official MCP OAuth.",
    "Candidate requires any `agent_wallet:*` scope.",
    "Candidate requires a live probe before the dossier is complete.",
    "## Intake Result States",
    "`ready_for_7z_sandbox`",
    "does not approve provider use",
    "## Redacted Intake Template",
    "Decision: rejected | needs_owner_input | incomplete | ready_for_7z_sandbox",
    "## Guardrails",
    "Do not call the provider.",
    "Do not request credentials.",
    "Do not set runtime gates.",
    "Do not apply SQL.",
    "Do not move directly from intake to dossier approval.",
    "## Done Criteria",
  ]
) includes("Phase 7AA intake gate", doc, value);

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
) excludes("Phase 7AA intake gate", doc, forbidden);

for (
  const value of [
    "### 7AA - Provider Candidate Intake Gate",
    "Intake packet: `docs/phase-7AA-provider-candidate-intake-gate.md`.",
    "`npm run check:phase-7aa`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AA provider candidate intake gate complete.",
);

for (
  const value of [
    '"check:phase-7aa"',
    "npm run check:phase-7aa",
  ]
) includes("package scripts", packageJson, value);

includes("README", readme, "provider candidate intake gate");
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

console.log("Phase 7AA provider candidate intake gate checks passed.");
