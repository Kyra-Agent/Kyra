import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(sourceName, source, text) {
  assert(source.includes(text), `${sourceName} must include: ${text}`);
}

function assertNotIncludes(sourceName, source, text) {
  assert(!source.includes(text), `${sourceName} must not include: ${text}`);
}

function walkFiles(path) {
  const absolutePath = resolve(root, path);
  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return [path];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = `${path}/${entry.name}`;

    if (entry.isDirectory()) {
      return walkFiles(childPath);
    }

    return entry.isFile() ? [childPath] : [];
  });
}

function assertFilesDoNotInclude(paths, forbiddenPattern, message) {
  for (const path of paths) {
    assert(!forbiddenPattern.test(read(path)), `${message}: ${path}`);
  }
}

const decision = read("docs/phase-7I-base-mcp-status-decision.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const packageJson = read("package.json");
const phase7C = read("docs/phase-7C-base-mcp-runtime-audit.md");
const phase7D = read("docs/phase-7D-prepared-action-storage-approval.md");
const phase7H = read("docs/phase-7H-release-rollback-audit.md");
const core = read("supabase/functions/base-mcp-prepare/core.ts");
const dependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");
const runtimeConfig = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const providerAdapter = read("supabase/functions/base-mcp-prepare/provider-adapter.ts");
const storageAdapter = read("supabase/functions/base-mcp-prepare/storage-adapter.ts");
const baseMcpReadme = read("supabase/functions/base-mcp-prepare/README.md");
const telegramRuntimeFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const sourceFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|js|jsx)$/u.test(path)
);

for (
  const required of [
    "# Phase 7I Base MCP Status Preparation Decision",
    "Status: decision packet started.",
    "## Decision",
    "## Why This Candidate",
    "## Scope",
    "## Enablement Order",
    "## Live Smoke Checklist",
    "## Rollback Plan",
    "## Non-Goals",
    "## Done Criteria",
    "does not enable provider runtime calls",
    "prompts, signing, transaction submission",
    "prepared-action storage writes",
  ]
) {
  assertIncludes("Phase 7I decision", decision, required);
}

for (
  const selectedBoundary of [
    "action kind: `base_mcp_status_check`",
    "chain: `base`",
    "mode: `read_only`",
    "surface: owner dashboard only",
    "value: no token spend, no gas request, no calldata",
    "wallet: no wallet prompt",
    "Telegram: no trigger and no execution",
    "storage: no production write until prepared-action SQL is applied and",
  ]
) {
  assertIncludes("Phase 7I selected candidate", decision, selectedBoundary);
}

for (
  const blocked of [
    "public route trigger",
    "Telegram trigger",
    "non-owner trigger",
    "wallet prompt",
    "wallet signing",
    "transaction submission",
    "raw calldata",
    "prepared-action production write before SQL approval",
  ]
) {
  assertIncludes("Phase 7I blocked scope", decision, blocked);
}

for (
  const smoke of [
    "confirm `KYRA_BASE_MCP_PREP_ENABLED` current value",
    "confirm `KYRA_BASE_MCP_ENDPOINT` is HTTPS",
    "confirm `KYRA_BASE_MCP_API_KEY`, if used, is a backend secret only",
    "confirm no `VITE_` Base MCP secret exists",
    "confirm `storePreparedActionSummary` remains unwired",
    "wrong-owner request returns a bounded authorization failure",
    "stale request returns `invalid_request`",
    "unsupported action kind returns `base_mcp_unknown_action`",
    "provider failure returns `base_mcp_unavailable` or `base_mcp_timeout`",
    "Telegram still cannot call Base MCP",
  ]
) {
  assertIncludes("Phase 7I smoke checklist", decision, smoke);
}

for (
  const rollback of [
    "set `KYRA_BASE_MCP_PREP_ENABLED` away from exact `true`",
    "remove or rotate `KYRA_BASE_MCP_API_KEY`",
    "keep Telegram execution disabled",
    "re-run `npm run check:phase-7`",
    "verify dashboard shows bounded disabled/not-configured copy",
  ]
) {
  assertIncludes("Phase 7I rollback", decision, rollback);
}

assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "Audit packet: `docs/phase-7I-base-mcp-status-decision.md`.",
);
assertIncludes("Phase 7 audit", phase7Audit, "`npm run check:phase-7i`");
assertIncludes("package.json", packageJson, '"check:phase-7i"');
assertIncludes("package.json", packageJson, "npm run check:phase-7i");

assertIncludes("Phase 7C audit", phase7C, "The only allowed action kind is `base_mcp_status_check`.");
assertIncludes("Phase 7D audit", phase7D, "Prepared-action storage is not live.");
assertIncludes("Phase 7H audit", phase7H, "The current safest candidate is");

assertIncludes("Base MCP core", core, 'const baseMcpAllowedActionKinds = ["base_mcp_status_check"] as const;');
assertIncludes("Base MCP core", core, 'mode: "read_only";');
assertIncludes("Base MCP core", core, "Base MCP preparation is disabled.");
assertIncludes("Base MCP core", core, "Base MCP preparation is not configured.");
assertIncludes("Base MCP core", core, "assertFreshRequestedAt");
assertIncludes("Base MCP core", core, "assertAgentOwnership");
assertIncludes("Base MCP core", core, "workspaceId !== allowedPrepareRequest.workspaceId");
assertIncludes("Base MCP core", core, "No Base MCP action can be prepared right now.");

assertIncludes("runtime config", runtimeConfig, 'value === "true"');
assertIncludes("runtime config", runtimeConfig, 'url.protocol !== "https:"');
assertIncludes("runtime config", runtimeConfig, "return Math.min(parsed, 5000);");

assertIncludes("dependencies", dependencies, "if (!baseMcpPrepareRuntimeConfig.enabled)");
assertIncludes("dependencies", dependencies, "lookupAgentOwnershipRecord");
assertNotIncludes("dependencies", dependencies, "createBaseMcpStatusCheckAdapter");
assertNotIncludes("dependencies", dependencies, "storePreparedActionSummary");
assertNotIncludes("dependencies", dependencies, "prepareBaseMcpAction");

assertIncludes("provider adapter", providerAdapter, "createBaseMcpStatusCheckAdapter");
assertIncludes("provider adapter", providerAdapter, "baseMcpStatusPath = \"/status-check\"");
assertIncludes("provider adapter", providerAdapter, "No token spend, no gas request, no calldata.");
assertIncludes("provider adapter", providerAdapter, "opaquePayloadRef: null");
assertNotIncludes("provider adapter", providerAdapter, "ownerUserId");
assertNotIncludes("provider adapter", providerAdapter, "workspaceId: input.workspaceId");
assertNotIncludes("provider adapter", providerAdapter, "agentId: input.agentId");
assertNotIncludes("provider adapter", providerAdapter, "walletAddress");

assertIncludes("storage adapter", storageAdapter, 'from("prepared_actions")');
assertIncludes("storage adapter", storageAdapter, "No wallet prompt, no signing, no transaction submission.");
assertIncludes("base-mcp README", baseMcpReadme, "Do not call this function from Telegram.");
assertIncludes("base-mcp README", baseMcpReadme, "Do not enable a live Base MCP provider call without a separate review.");

assertFilesDoNotInclude(
  telegramRuntimeFiles,
  /base-mcp-prepare|prepareBaseMcpAction|KYRA_BASE_MCP|storePreparedActionSummary/u,
  "Telegram runtime must not trigger Base MCP candidate",
);
assertFilesDoNotInclude(
  sourceFiles,
  /VITE_.*(?:BASE_MCP|SERVICE_ROLE|PRIVATE_KEY|BOT_TOKEN|OPENROUTER|AGENT_BRAIN_API_KEY)/u,
  "Frontend must not expose backend secret env keys",
);

console.log("Phase 7I Base MCP status decision checks passed.");
