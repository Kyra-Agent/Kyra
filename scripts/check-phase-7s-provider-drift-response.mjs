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

const doc = read("docs/phase-7S-provider-drift-response-runbook.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");

for (
  const value of [
    "Status: local runbook and guard complete.",
    "## Drift Severity",
    "### Critical Drift",
    "### Caution Drift",
    "## Response Flow",
    "Re-run `npm run check:phase-7o` and `npm run check:phase-7q`.",
    "## Hard Stops",
    "OAuth client endpoint implementation",
    "token storage",
    "MCP session initialization",
    "tool invocation",
    "wallet prompts",
    "Telegram-triggered execution",
    "## Baseline Update Rules",
    "owner approval is explicit",
    "## Owner Summary Format",
    "Do not paste raw provider responses or secrets",
    "## Done Criteria",
  ]
) includes("Phase 7S drift runbook", doc, value);

for (
  const forbidden of [
    "MCP_OAUTH_CLIENT_SECRET",
    "MCP_OAUTH_REFRESH_TOKEN",
    "sk-or-v1-",
    "-----BEGIN",
    "bot token:",
  ]
) excludes("Phase 7S drift runbook", doc, forbidden);

for (
  const value of [
    "### 7S - Provider Drift Response Runbook",
    "Runbook packet: `docs/phase-7S-provider-drift-response-runbook.md`.",
    "`npm run check:phase-7s`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7T custom bridge smoke go/no-go packet complete.",
);

for (
  const value of [
    '"check:phase-7s"',
    "npm run check:phase-7s",
  ]
) includes("package scripts", packageJson, value);

console.log("Phase 7S provider drift response checks passed.");
