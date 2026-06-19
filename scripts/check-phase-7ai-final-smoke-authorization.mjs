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

const doc = read("docs/phase-7AI-final-smoke-authorization-packet.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const readme = read("README.md");
const phase7AF = read(
  "docs/phase-7AF-provider-candidate-submission-template.md",
);
const phase7AG = read("docs/phase-7AG-provider-evidence-fill-review.md");
const phase7AH = read("docs/phase-7AH-target-sql-approval-prep.md");
const phase7AE = read("docs/phase-7AE-controlled-smoke-closeout-runbook.md");
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
    "Status: local final smoke authorization packet complete.",
    "Current decision: final smoke not authorized.",
    "No provider is approved.",
    "No runtime gate is enabled.",
    "## Required Upstream Decisions",
    "Phase 7AF provider submission",
    "Phase 7AG provider evidence",
    "Phase 7AH target SQL prep",
    "Phase 7AE closeout runbook",
    "## Authorization Scope",
    "action kind: `base_mcp_status_check`",
    "protocol: `kyra_status_v1`",
    "surface: owner dashboard only",
    "call count: one provider call",
    "## Explicit Exclusions",
    "wallet prompts",
    "Telegram execution",
    "official MCP OAuth",
    "`agent_wallet:*` scopes",
    "## Authorization Evidence Bundle",
    "Verifier evidence",
    "Gate proof",
    "Closeout plan",
    "## Hard Stops",
    "Runtime gate is already on.",
    "Any local check fails.",
    "## Final Result States",
    "`final_smoke_not_authorized`",
    "`ready_to_request_final_owner_smoke_authorization`",
    "`owner_authorized_one_read_only_smoke`",
    "still does not run the smoke",
    "## Redacted Authorization Template",
    "Decision: final_smoke_not_authorized | rejected | ready_to_request_final_owner_smoke_authorization | owner_authorized_one_read_only_smoke",
    "## Guardrails",
    "Do not run smoke from this packet.",
    "Do not enable runtime gates from this packet.",
    "Do not contact providers from this packet.",
    "## Done Criteria",
  ]
) includes("Phase 7AI final authorization", doc, value);

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
) excludes("Phase 7AI final authorization", doc, forbidden);

for (
  const value of [
    "### 7AI - Final Smoke Authorization Packet",
    "Authorization packet: `docs/phase-7AI-final-smoke-authorization-packet.md`.",
    "`npm run check:phase-7ai`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7AI final smoke authorization packet complete.",
);

for (const value of ['"check:phase-7ai"', "npm run check:phase-7ai"]) {
  includes("package scripts", packageJson, value);
}

includes("README", readme, "final smoke authorization packet");
includes(
  "Phase 7AF",
  phase7AF,
  "Current decision: no provider candidate submitted.",
);
includes(
  "Phase 7AG",
  phase7AG,
  "Current decision: no provider evidence filled.",
);
includes(
  "Phase 7AH",
  phase7AH,
  "Current decision: target SQL approval not ready.",
);
includes("Phase 7AE", phase7AE, "Current decision: smoke not authorized.");
includes("runtime gate", runtime, 'return value === "true"');
excludes("dependencies", dependencies, "storePreparedActionSummary");
excludes("provider adapter", providerAdapter, "walletAddress");
excludes("provider adapter", providerAdapter, "telegramToken");
excludes("provider adapter", providerAdapter, "transactionHash");
excludes("Telegram runtime", telegram, "base-mcp-prepare");
excludes("public agent", publicAgent, "base-mcp-prepare");

console.log("Phase 7AI final smoke authorization checks passed.");
