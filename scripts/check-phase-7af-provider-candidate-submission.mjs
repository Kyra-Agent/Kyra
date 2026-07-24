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

const doc = read("docs/phase-7AF-provider-candidate-submission-template.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
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
    "Status: local provider candidate submission template complete.",
    "Current decision: no provider candidate submitted.",
    "No provider is nominated, approved, contacted, or called.",
    "## Submission Rules",
    "Credential type without value.",
    "Written support for `kyra_status_v1`.",
    "Written support for `POST /status-check`.",
    "## Required Submission Fields",
    "Endpoint origin",
    "Credential type",
    "Data boundary",
    "## Hard Rejects",
    "Provider API keys.",
    "Telegram bot tokens.",
    "Supabase service-role keys.",
    "Wallet addresses.",
    "Any `agent_wallet:*` scope requirement.",
    "Requirement to probe the endpoint before dossier completion.",
    "## Submission Result States",
    "`no_provider_candidate_submitted`",
    "`ready_for_7AA_intake_review`",
    "does not approve provider use",
    "## Redacted Submission Template",
    "Decision: no_provider_candidate_submitted | rejected | ready_for_7AA_intake_review",
    "## Guardrails",
    "Do not request credentials.",
    "Do not call the provider.",
    "Do not probe the endpoint.",
    "Do not enable runtime gates.",
    "## Done Criteria",
  ]
) includes("Phase 7AF submission template", doc, value);

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
) excludes("Phase 7AF submission template", doc, forbidden);

for (
  const value of [
    "### 7AF - Provider Candidate Submission Template",
    "Submission template: `docs/phase-7AF-provider-candidate-submission-template.md`.",
    "`npm run check:phase-7af`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AJ controlled read-only Base status smoke complete.",
);

for (const value of ['"check:phase-7af"', "npm run check:phase-7af"]) {
  includes("package scripts", packageJson, value);
}

includes("product roadmap", roadmap, "an explicit legacy rollback and historical compatibility lane.");
includes("runtime gate", runtime, 'return value === "true"');
excludes("dependencies", dependencies, "storePreparedActionSummary");
excludes("provider adapter", providerAdapter, "walletAddress");
excludes("provider adapter", providerAdapter, "telegramToken");
excludes("provider adapter", providerAdapter, "transactionHash");
excludes("Telegram runtime", telegram, "base-mcp-prepare");
excludes("public agent", publicAgent, "base-mcp-prepare");

console.log("Phase 7AF provider candidate submission checks passed.");
