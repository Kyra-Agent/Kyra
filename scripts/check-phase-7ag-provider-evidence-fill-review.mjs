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

const doc = read("docs/phase-7AG-provider-evidence-fill-review.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const phase7AF = read(
  "docs/phase-7AF-provider-candidate-submission-template.md",
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
    "Status: local provider evidence fill review complete.",
    "Current decision: no provider evidence filled.",
    "No provider evidence is accepted.",
    "## Required Upstream State",
    "Phase 7AF result is `ready_for_7AA_intake_review`.",
    "## Evidence Categories",
    "Positive contract",
    "Negative contract",
    "Credential lifecycle",
    "## Evidence Fill Rules",
    "Allowed evidence:",
    "Forbidden evidence:",
    "Live probe output gathered before dossier completion.",
    "## Review Result States",
    "`no_provider_evidence_filled`",
    "`ready_for_candidate_scoring`",
    "does not approve provider use",
    "## Redacted Evidence Template",
    "Decision: no_provider_evidence_filled | rejected | incomplete | ready_for_candidate_scoring",
    "Live probe performed: no",
    "## Guardrails",
    "Do not call the provider.",
    "Do not probe the endpoint.",
    "Do not store raw provider bodies.",
    "## Done Criteria",
  ]
) includes("Phase 7AG evidence review", doc, value);

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
) excludes("Phase 7AG evidence review", doc, forbidden);

for (
  const value of [
    "### 7AG - Provider Evidence Fill Review",
    "Evidence review: `docs/phase-7AG-provider-evidence-fill-review.md`.",
    "`npm run check:phase-7ag`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AJ controlled read-only Base status smoke complete.",
);

for (const value of ['"check:phase-7ag"', "npm run check:phase-7ag"]) {
  includes("package scripts", packageJson, value);
}

includes("product roadmap", roadmap, "an explicit legacy rollback and historical compatibility lane.");
includes(
  "Phase 7AF",
  phase7AF,
  "Current decision: no provider candidate submitted.",
);
includes("runtime gate", runtime, 'return value === "true"');
excludes("dependencies", dependencies, "storePreparedActionSummary");
excludes("provider adapter", providerAdapter, "walletAddress");
excludes("provider adapter", providerAdapter, "telegramToken");
excludes("provider adapter", providerAdapter, "transactionHash");
excludes("Telegram runtime", telegram, "base-mcp-prepare");
excludes("public agent", publicAgent, "base-mcp-prepare");

console.log("Phase 7AG provider evidence fill review checks passed.");
