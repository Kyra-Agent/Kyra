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

const doc = read("docs/phase-7T-custom-bridge-smoke-go-no-go.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const runtime = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const providerContract = read(
  "supabase/functions/base-mcp-prepare/provider-contract.ts",
);
const telegram = read("supabase/functions/telegram-webhook/core.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");

for (
  const value of [
    "Status: local go/no-go packet complete.",
    "Current decision: blocked.",
    "## Required Evidence",
    "Provider contract",
    "Rate-limit verifier",
    "Owner approval",
    "## Go Criteria",
    "`KYRA_BASE_MCP_PREP_ENABLED` is still `false` before the window.",
    "The provider endpoint is HTTPS and not `mcp.base.org`.",
    "## No-Go Criteria",
    "official Base MCP OAuth",
    "`agent_wallet:*` scopes",
    "## Smoke Procedure",
    "Set `KYRA_BASE_MCP_PREP_ENABLED=false` immediately.",
    "## Evidence Never To Share",
    "Telegram bot token or token ref",
    "Supabase service role key",
    "raw provider body",
    "## Done Criteria",
  ]
) includes("Phase 7T go/no-go packet", doc, value);

for (
  const forbidden of [
    "KYRA_BASE_MCP_PREP_ENABLED=true now",
    "approve automatically",
    "auto-enable",
    "sk-or-v1-",
    "-----BEGIN",
  ]
) excludes("Phase 7T go/no-go packet", doc, forbidden);

for (
  const value of [
    "### 7T - Custom Bridge Smoke Go/No-Go",
    "Go/no-go packet: `docs/phase-7T-custom-bridge-smoke-go-no-go.md`.",
    "`npm run check:phase-7t`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7U target Supabase rate-limit verifier readiness complete.",
);

for (
  const value of [
    '"check:phase-7t"',
    "npm run check:phase-7t",
  ]
) includes("package scripts", packageJson, value);

includes("runtime gate", runtime, 'value === "true"');
includes(
  "provider contract",
  providerContract,
  'baseMcpProviderProtocol = "kyra_status_v1"',
);
includes(
  "provider contract",
  providerContract,
  "maxBaseMcpProviderResponseBytes = 4096",
);
excludes("Telegram runtime", telegram, "base-mcp-prepare");
excludes("public agent", publicAgent, "base-mcp-prepare");

console.log("Phase 7T custom bridge smoke go/no-go checks passed.");
