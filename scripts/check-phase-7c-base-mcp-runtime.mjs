import { readFileSync, readdirSync, statSync } from "node:fs";
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

function assertOrder(sourceName, source, first, second) {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);

  assert(firstIndex >= 0, `${sourceName} must include: ${first}`);
  assert(secondIndex >= 0, `${sourceName} must include: ${second}`);
  assert(
    firstIndex < secondIndex,
    `${sourceName} must order "${first}" before "${second}".`,
  );
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

const audit = read("docs/phase-7C-base-mcp-runtime-audit.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const packageJson = read("package.json");
const runtimeConfig = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const dependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");
const core = read("supabase/functions/base-mcp-prepare/core.ts");
const providerAdapter = read("supabase/functions/base-mcp-prepare/provider-adapter.ts");
const storageAdapter = read("supabase/functions/base-mcp-prepare/storage-adapter.ts");
const functionReadme = read("supabase/functions/base-mcp-prepare/README.md");
const schema = read("supabase/schema.sql");
const handlerBody = core.slice(
  core.indexOf("export async function handleBaseMcpPrepareRequest"),
);
const sourceFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|js|jsx)$/u.test(path)
);
const telegramRuntimeFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));

for (
  const required of [
    "# Phase 7C Base MCP Runtime Audit",
    "Status: audit packet started.",
    "## Runtime Gate Rules",
    "## Request Boundary",
    "## Provider Adapter Boundary",
    "## Storage Boundary",
    "## Failure Boundary",
    "## Gaps Before Live Runtime",
    "## Phase 7C Done Criteria",
    "Runtime dependency factory does not wire `prepareBaseMcpAction`.",
    "Runtime dependency factory does not wire `createBaseMcpStatusCheckAdapter`.",
    "Runtime dependency factory does not wire `storePreparedActionSummary`.",
    "The only allowed action kind is `base_mcp_status_check`.",
    "Prepared-action storage is not live in Phase 7C.",
  ]
) {
  assertIncludes("Phase 7C audit", audit, required);
}

assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "### 7C - Base MCP Runtime Audit",
);
assertIncludes("package.json", packageJson, '"check:phase-7c"');
assertIncludes("package.json", packageJson, '"check:phase-7"');

assertIncludes("runtime config", runtimeConfig, 'value === "true"');
assertIncludes("runtime config", runtimeConfig, 'url.protocol !== "https:"');
assertIncludes("runtime config", runtimeConfig, "return 2500;");
assertIncludes("runtime config", runtimeConfig, "return Math.min(parsed, 5000);");
assertIncludes("runtime config", runtimeConfig, "enabled: false");

assertIncludes(
  "dependencies",
  dependencies,
  "createBaseMcpPrepareRuntimeConfig",
);
assertIncludes(
  "dependencies",
  dependencies,
  "if (!baseMcpPrepareRuntimeConfig.enabled)",
);
assertIncludes("dependencies", dependencies, "return dependencies;");
assertIncludes("dependencies", dependencies, "lookupAgentOwnershipRecord");
assertNotIncludes("dependencies", dependencies, "prepareBaseMcpAction");
assertNotIncludes("dependencies", dependencies, "createBaseMcpStatusCheckAdapter");
assertNotIncludes("dependencies", dependencies, "storePreparedActionSummary");

assertIncludes("core", core, "Base MCP preparation is disabled.");
assertIncludes("core", core, "Base MCP preparation is not configured.");
assertIncludes("core", core, "maxBaseMcpPrepareBodyBytes = 4096");
assertIncludes("core", core, "maxBaseMcpPrepareRequestAgeMs = 5 * 60 * 1000");
assertIncludes("core", core, "maxBaseMcpPrepareFutureSkewMs = 60 * 1000");
assertIncludes("core", core, "maxBaseMcpPreparePreviewTtlMs = 10 * 60 * 1000");
assertIncludes("core", core, 'const baseMcpAllowedActionKinds = ["base_mcp_status_check"] as const;');
assertIncludes("core", core, 'mode: "read_only";');
assertIncludes("core", core, "assertFreshRequestedAt");
assertIncludes("core", core, "assertAgentOwnership");
assertIncludes("core", core, "workspaceId !== allowedPrepareRequest.workspaceId");
assertIncludes("core", core, "opaquePayloadRef !== null");
assertIncludes("core", core, "createPreparedActionStorageInput");
assertIncludes(
  "core",
  handlerBody,
  "export async function handleBaseMcpPrepareRequest",
);
assertOrder("core handler", handlerBody, "if (!runtimeConfig.enabled)", "assertBearerAuthorization");
assertOrder("core handler", handlerBody, "assertBearerAuthorization", "readJsonObjectBody");
assertOrder("core handler", handlerBody, "assertFreshRequestedAt", "lookupAgentOwnership");
assertOrder("core handler", handlerBody, "assertAgentOwnership", "prepareBaseMcpAction");
assertOrder("core handler", handlerBody, "prepareBaseMcpAction", "storePreparedActionSummary");

for (
  const message of [
    "Base MCP preparation is disabled.",
    "Base MCP preparation is not configured.",
    "This Base MCP action is not supported.",
    "Base MCP preparation timed out.",
    "No Base MCP action can be prepared right now.",
  ]
) {
  assertIncludes("core", core, message);
}

assertIncludes("provider adapter", providerAdapter, "createBaseMcpStatusCheckAdapter");
assertIncludes("provider adapter", providerAdapter, "baseMcpStatusPath = \"/status-check\"");
assertIncludes("provider adapter", providerAdapter, "method: \"POST\"");
assertIncludes("provider adapter", providerAdapter, "\"x-kyra-action-kind\": \"base_mcp_status_check\"");
assertIncludes("provider adapter", providerAdapter, "actionKind: input.actionKind");
assertIncludes("provider adapter", providerAdapter, "chain: input.chain");
assertIncludes("provider adapter", providerAdapter, "mode: input.mode");
assertIncludes("provider adapter", providerAdapter, "requestId: input.requestId");
assertIncludes("provider adapter", providerAdapter, "requestedAt: input.requestedAt");
assertIncludes("provider adapter", providerAdapter, "No token spend, no gas request, no calldata.");
assertIncludes("provider adapter", providerAdapter, "opaquePayloadRef: null");
assertNotIncludes("provider adapter", providerAdapter, "ownerUserId");
assertNotIncludes("provider adapter", providerAdapter, "workspaceId: input.workspaceId");
assertNotIncludes("provider adapter", providerAdapter, "agentId: input.agentId");
assertNotIncludes("provider adapter", providerAdapter, "walletAddress");
assertNotIncludes("provider adapter", providerAdapter, "rawCalldata");
assertNotIncludes("provider adapter", providerAdapter, "providerPayloadRef");

assertIncludes("storage adapter", storageAdapter, "PreparedActionStorageClient");
assertIncludes("storage adapter", storageAdapter, 'from: (table: "prepared_actions")');
assertIncludes("storage adapter", storageAdapter, 'action_kind: "base_mcp_status_check"');
assertIncludes("storage adapter", storageAdapter, 'provider_payload_ref: null');
assertIncludes("storage adapter", storageAdapter, 'upsert(row, { onConflict: "workspace_id,agent_id,request_id" })');
assertIncludes("storage adapter", storageAdapter, "No wallet prompt, no signing, no transaction submission.");

assertIncludes("function README", functionReadme, "Do not call this function from Telegram.");
assertIncludes("function README", functionReadme, "non-HTTPS Base MCP endpoints as not configured");
assertIncludes("function README", functionReadme, "Do not enable a live Base MCP provider call without a separate review.");
assertNotIncludes("schema", schema, "create table if not exists public.prepared_actions");

assertFilesDoNotInclude(
  sourceFiles,
  /base-mcp-prepare|KYRA_BASE_MCP/u,
  "Frontend must not reference Base MCP function endpoints or backend secrets",
);
assertFilesDoNotInclude(
  telegramRuntimeFiles,
  /base-mcp-prepare|prepareBaseMcpAction|storePreparedActionSummary|KYRA_BASE_MCP/u,
  "Telegram runtime must not call or configure Base MCP preparation",
);

console.log("Phase 7C Base MCP runtime checks passed.");
