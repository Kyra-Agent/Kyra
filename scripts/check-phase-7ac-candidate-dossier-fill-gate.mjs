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

const doc = read("docs/phase-7AC-candidate-dossier-fill-gate.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const readme = read("README.md");
const phase7AA = read("docs/phase-7AA-provider-candidate-intake-gate.md");
const phase7AB = read("docs/phase-7AB-provider-candidate-scoring-worksheet.md");
const phase7Z = read("docs/phase-7Z-provider-selection-sandbox.md");
const phase7V = read("docs/phase-7V-provider-candidate-dossier.md");
const phase7U = read(
  "docs/phase-7U-target-supabase-rate-limit-verifier-readiness.md",
);
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
    "Status: local candidate dossier fill gate complete.",
    "Current decision: no candidate dossier filled.",
    "No provider is nominated, scored, selected, approved, contacted, or called.",
    "## Prerequisites",
    "Phase 7AA intake decision is `ready_for_7z_sandbox`.",
    "Phase 7AB scoring decision is `scored_ready_for_7z_sandbox`.",
    "Phase 7Z sandbox decision is `candidate_for_dossier`.",
    "Phase 7V dossier template remains the controlling dossier format.",
    "## Dossier Fill Inputs",
    "Endpoint origin only",
    "Expected protocol: `kyra_status_v1`.",
    "Expected path: `POST /status-check`.",
    "Credential type without value.",
    "Summarized positive contract evidence readiness.",
    "Summarized negative contract evidence readiness.",
    "## Forbidden Dossier Material",
    "Provider API keys",
    "Telegram bot tokens",
    "Supabase service-role keys",
    "Wallet addresses",
    "Official MCP OAuth client ids",
    "Raw provider request bodies",
    "## Fill Checklist",
    "Intake gate",
    "Scoring gate",
    "Sandbox gate",
    "Credential lifecycle",
    "Redacted owner summary",
    "## Dossier Result States",
    "`ready_for_owner_dossier_review`",
    "does not approve provider use",
    "## Redacted Dossier Fill Template",
    "Decision: blocked | rejected | incomplete | ready_for_owner_dossier_review",
    "## Guardrails",
    "Do not call the provider.",
    "Do not request credentials.",
    "Do not include raw provider request or response bodies.",
    "Do not set runtime gates.",
    "Do not apply SQL.",
    "Do not move directly from dossier fill to smoke approval.",
    "## Done Criteria",
  ]
) includes("Phase 7AC dossier fill gate", doc, value);

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
) excludes("Phase 7AC dossier fill gate", doc, forbidden);

for (
  const value of [
    "### 7AC - Candidate Dossier Fill Gate",
    "Dossier fill packet: `docs/phase-7AC-candidate-dossier-fill-gate.md`.",
    "`npm run check:phase-7ac`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AJ controlled read-only Base status smoke complete.",
);

for (
  const value of [
    '"check:phase-7ac"',
    "npm run check:phase-7ac",
  ]
) includes("package scripts", packageJson, value);

includes("README", readme, "Base MCP remains an optional provider adapter track");
includes(
  "Phase 7AA intake",
  phase7AA,
  "Current decision: no candidate intake accepted.",
);
includes(
  "Phase 7AB scoring",
  phase7AB,
  "Current decision: no candidate scored.",
);
includes(
  "Phase 7Z sandbox",
  phase7Z,
  "Current decision: no provider selected.",
);
includes("Phase 7V dossier", phase7V, "Current decision: blocked.");
includes("Phase 7U verifier", phase7U, "Current decision: blocked.");
includes("Phase 7T smoke", phase7T, "Current decision: blocked.");
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

console.log("Phase 7AC candidate dossier fill checks passed.");
