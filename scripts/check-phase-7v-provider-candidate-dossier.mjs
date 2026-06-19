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

const doc = read("docs/phase-7V-provider-candidate-dossier.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const phase7M = read("docs/phase-7M-provider-contract-qualification.md");
const phase7T = read("docs/phase-7T-custom-bridge-smoke-go-no-go.md");
const phase7U = read(
  "docs/phase-7U-target-supabase-rate-limit-verifier-readiness.md",
);
const providerAdapter = read(
  "supabase/functions/base-mcp-prepare/provider-adapter.ts",
);
const providerContract = read(
  "supabase/functions/base-mcp-prepare/provider-contract.ts",
);
const telegram = read("supabase/functions/telegram-webhook/core.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");

for (
  const value of [
    "Status: local provider candidate dossier template complete.",
    "No provider is",
    "## Candidate Summary",
    "endpoint origin without credentials",
    "## Contract Evidence",
    "exactly six fields",
    "wrong request id",
    "oversized response",
    "## Credential Lifecycle",
    "who creates the credential",
    "how it is revoked",
    "## Data Boundary",
    "owner id",
    "Telegram bot token",
    "Supabase service role key",
    "## Approval Path",
    "Phase 7U target Supabase verifier readiness is satisfied.",
    "Phase 7T go/no-go rows are ready.",
    "## No-Go Conditions",
    "endpoint requires `agent_wallet:*` scopes",
    "## Redacted Owner Summary",
    "Endpoint origin: <origin only, no credentials>",
    "Current decision: blocked.",
    "## Done Criteria",
  ]
) includes("Phase 7V provider dossier", doc, value);

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
  ]
) excludes("Phase 7V provider dossier", doc, forbidden);

for (
  const value of [
    "### 7V - Provider Candidate Dossier",
    "Dossier packet: `docs/phase-7V-provider-candidate-dossier.md`.",
    "`npm run check:phase-7v`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AJ controlled read-only Base status smoke complete.",
);

for (
  const value of [
    '"check:phase-7v"',
    "npm run check:phase-7v",
  ]
) includes("package scripts", packageJson, value);

includes("Phase 7M provider contract", phase7M, "kyra_status_v1");
includes("Phase 7T go/no-go", phase7T, "Provider contract");
includes(
  "Phase 7U verifier readiness",
  phase7U,
  "boolean-only summary",
);
includes(
  "provider adapter",
  providerAdapter,
  "protocol: baseMcpProviderProtocol",
);
includes(
  "provider contract",
  providerContract,
  "maxBaseMcpProviderResponseBytes = 4096",
);
excludes("Telegram runtime", telegram, "base-mcp-prepare");
excludes("public agent", publicAgent, "base-mcp-prepare");

console.log("Phase 7V provider candidate dossier checks passed.");
