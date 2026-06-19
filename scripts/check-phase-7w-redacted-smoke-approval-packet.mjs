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

const doc = read("docs/phase-7W-redacted-smoke-approval-packet.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const phase7V = read("docs/phase-7V-provider-candidate-dossier.md");
const phase7M = read("docs/phase-7M-provider-contract-qualification.md");
const phase7T = read("docs/phase-7T-custom-bridge-smoke-go-no-go.md");
const phase7U = read(
  "docs/phase-7U-target-supabase-rate-limit-verifier-readiness.md",
);
const runtime = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const telegram = read("supabase/functions/telegram-webhook/core.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");

for (
  const value of [
    "Status: local redacted smoke approval packet template complete.",
    "Current decision: blocked.",
    "No owner approval has been captured",
    "## Source Inputs",
    "Phase 7V provider candidate dossier.",
    "Phase 7M provider contract evidence.",
    "Phase 7T custom bridge smoke go/no-go rows.",
    "Phase 7U target Supabase verifier readiness.",
    "## Required Owner-Facing Fields",
    "Endpoint origin",
    "Rollback operator",
    "Smoke window",
    "Approval expiry",
    "Exactly `base_mcp_status_check`",
    "Exactly `kyra_status_v1`",
    "Owner dashboard only",
    "## Redacted Evidence Bundle",
    "wrong request id",
    "Phase 7U boolean-only verifier summary",
    "Runtime gate-off confirmation",
    "## Approval Statement",
    "I approve one read-only `base_mcp_status_check` smoke",
    "I do not approve wallet prompts",
    "## Pre-Smoke Checklist",
    "`KYRA_BASE_MCP_PREP_ENABLED=false` is confirmed immediately before the window.",
    "No Telegram path can trigger the smoke.",
    "No public route can trigger the smoke.",
    "No wallet prompt can open during the smoke.",
    "## Hard Stops",
    "Provider requires official MCP OAuth or `agent_wallet:*` scopes.",
    "## Redacted Packet Template",
    "Explicit exclusions:",
    "## Done Criteria",
  ]
) includes("Phase 7W approval packet", doc, value);

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
) excludes("Phase 7W approval packet", doc, forbidden);

for (
  const value of [
    "### 7W - Redacted Smoke Approval Packet",
    "Approval packet: `docs/phase-7W-redacted-smoke-approval-packet.md`.",
    "`npm run check:phase-7w`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AI final smoke authorization packet complete.",
);

for (
  const value of [
    '"check:phase-7w"',
    "npm run check:phase-7w",
  ]
) includes("package scripts", packageJson, value);

includes("Phase 7V dossier", phase7V, "Current decision: blocked.");
includes("Phase 7M provider contract", phase7M, "kyra_status_v1");
includes("Phase 7T go/no-go", phase7T, "Current decision: blocked.");
includes(
  "Phase 7U verifier readiness",
  phase7U,
  "boolean-only summary",
);
includes("runtime gate", runtime, 'value === "true"');
excludes("Telegram runtime", telegram, "base-mcp-prepare");
excludes("public agent", publicAgent, "base-mcp-prepare");

console.log("Phase 7W redacted smoke approval packet checks passed.");
