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

const doc = read("docs/phase-7X-final-pre-smoke-decision-matrix.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const phase7T = read("docs/phase-7T-custom-bridge-smoke-go-no-go.md");
const phase7U = read(
  "docs/phase-7U-target-supabase-rate-limit-verifier-readiness.md",
);
const phase7V = read("docs/phase-7V-provider-candidate-dossier.md");
const phase7W = read("docs/phase-7W-redacted-smoke-approval-packet.md");
const runtime = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const telegramGate = read(
  "supabase/functions/telegram-webhook/execution-gate.ts",
);
const telegram = read("supabase/functions/telegram-webhook/core.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");

for (
  const value of [
    "Status: local final pre-smoke decision matrix complete.",
    "Current decision: blocked.",
    "No provider is approved.",
    "No target Supabase rate-limit SQL has been applied.",
    "## Required Evidence Index",
    "7A",
    "7W",
    "`base_mcp_status_check` only",
    "official OAuth path disabled",
    "advertised scopes rejected",
    "no provider approved",
    "no owner packet filled",
    "## Current No-Go Reasons",
    "No compatible `kyra_status_v1` provider has been approved.",
    "Runtime gate remains intentionally off.",
    "These are expected blockers, not failures.",
    "## Go-Forward Preconditions",
    "Secret scan passes for the changed decision files.",
    "Endpoint origin is HTTPS, custom-bridge compatible, and not `mcp.base.org`.",
    "Target verifier returns boolean-only passing evidence",
    "`KYRA_BASE_MCP_PREP_ENABLED=false` is confirmed before the smoke window.",
    "## Non-Shareable Evidence",
    "Telegram bot tokens or token refs.",
    "Supabase service-role keys",
    "Provider API keys",
    "Wallet addresses",
    "Raw provider request or response bodies.",
    "## Final Decision Rules",
    "If any required evidence is missing, the result is blocked.",
    "If provider scope expands beyond `base_mcp_status_check`, the result is",
    "## Operator Sequence",
    "Do not skip directly from provider selection to runtime gate enablement.",
    "## Done Criteria",
  ]
) includes("Phase 7X decision matrix", doc, value);

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
) excludes("Phase 7X decision matrix", doc, forbidden);

for (
  const value of [
    "### 7X - Final Pre-Smoke Decision Matrix",
    "Decision packet: `docs/phase-7X-final-pre-smoke-decision-matrix.md`.",
    "`npm run check:phase-7x`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7Z provider selection sandbox complete.",
);

for (
  const value of [
    '"check:phase-7x"',
    "npm run check:phase-7x",
  ]
) includes("package scripts", packageJson, value);

includes("Phase 7T go/no-go", phase7T, "Current decision: blocked.");
includes(
  "Phase 7U verifier readiness",
  phase7U,
  "boolean-only summary",
);
includes("Phase 7V dossier", phase7V, "Current decision: blocked.");
includes("Phase 7W approval packet", phase7W, "Current decision: blocked.");
includes("runtime gate", runtime, 'value === "true"');
includes(
  "Telegram execution gate",
  telegramGate,
  "canExecuteFromTelegram: false",
);
excludes("Telegram runtime", telegram, "base-mcp-prepare");
excludes("public agent", publicAgent, "base-mcp-prepare");

console.log("Phase 7X final pre-smoke decision checks passed.");
