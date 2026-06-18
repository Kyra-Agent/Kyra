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

const doc = read("docs/phase-7J-base-mcp-provider-wiring.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const packageJson = read("package.json");
const dependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");
const core = read("supabase/functions/base-mcp-prepare/core.ts");
const runtimeConfig = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const providerAdapter = read("supabase/functions/base-mcp-prepare/provider-adapter.ts");
const indexTest = read("supabase/functions/base-mcp-prepare/index_test.ts");
const schema = read("supabase/schema.sql");
const baseMcpReadme = read("supabase/functions/base-mcp-prepare/README.md");
const telegramRuntimeFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const sourceFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|js|jsx)$/u.test(path)
);
const handlerBody = core.slice(
  core.indexOf("export async function handleBaseMcpPrepareRequest"),
);

for (
  const required of [
    "# Phase 7J Base MCP Status Provider Wiring",
    "Status: runtime provider adapter wiring started.",
    "## Decision",
    "## Runtime Boundary",
    "## Provider Payload Boundary",
    "## Storage Boundary",
    "## Telegram Boundary",
    "## Failure Boundary",
    "## Local Verification",
    "## Live Smoke Checklist",
    "## Rollback Plan",
    "## Done Criteria",
    "prepared-action production storage",
    "wallet prompts",
    "signing",
    "transaction submission",
  ]
) {
  assertIncludes("Phase 7J doc", doc, required);
}

for (
  const decision of [
    "adapter: `createBaseMcpStatusCheckAdapter`",
    "dependency hook: `prepareBaseMcpAction`",
    "action kind: `base_mcp_status_check`",
    "chain: `base`",
    "mode: `read_only`",
    "runtime gate: exact `KYRA_BASE_MCP_PREP_ENABLED=true`",
    "endpoint: backend-only `KYRA_BASE_MCP_ENDPOINT`, HTTPS only",
    "API key: backend-only `KYRA_BASE_MCP_API_KEY`, optional",
  ]
) {
  assertIncludes("Phase 7J decision", doc, decision);
}

for (
  const boundary of [
    "no required env reads",
    "no body read",
    "no session validation",
    "no service-role client creation",
    "no ownership lookup",
    "no provider request",
    "no storage write",
    "Agent ownership lookup.",
    "Workspace match.",
    "HTTPS endpoint configured.",
  ]
) {
  assertIncludes("Phase 7J runtime boundary", doc, boundary);
}

for (
  const forbidden of [
    "owner user id",
    "workspace id",
    "agent id",
    "wallet address",
    "token amount",
    "calldata",
    "transaction hash",
    "Telegram token",
    "private key",
    "seed phrase",
  ]
) {
  assertIncludes("Phase 7J provider boundary", doc, forbidden);
}

assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "Audit packet: `docs/phase-7J-base-mcp-provider-wiring.md`.",
);
assertIncludes("Phase 7 audit", phase7Audit, "`npm run check:phase-7j`");
assertIncludes("package.json", packageJson, '"check:phase-7j"');
assertIncludes("package.json", packageJson, "npm run check:phase-7j");

assertIncludes("dependencies", dependencies, "createBaseMcpStatusCheckAdapter");
assertIncludes("dependencies", dependencies, "baseMcpProviderTransport?: BaseMcpProviderTransport");
assertIncludes(
  "dependencies",
  dependencies,
  "if (!baseMcpPrepareRuntimeConfig.enabled)",
);
assertOrder(
  "dependencies",
  dependencies,
  "if (!baseMcpPrepareRuntimeConfig.enabled)",
  "dependencies.prepareBaseMcpAction = createBaseMcpStatusCheckAdapter",
);
assertOrder(
  "dependencies",
  dependencies,
  "dependencies.prepareBaseMcpAction = createBaseMcpStatusCheckAdapter",
  "let serviceClientPromise",
);
assertNotIncludes("dependencies", dependencies, "storePreparedActionSummary");

assertIncludes("runtime config", runtimeConfig, 'value === "true"');
assertIncludes("runtime config", runtimeConfig, 'url.protocol !== "https:"');
assertIncludes("runtime config", runtimeConfig, "return Math.min(parsed, 5000);");

assertIncludes("core", core, "Base MCP preparation is disabled.");
assertIncludes("core", core, "Base MCP preparation is not configured.");
assertIncludes("core", core, 'const baseMcpAllowedActionKinds = ["base_mcp_status_check"] as const;');
assertIncludes("core", core, 'mode: "read_only";');
assertOrder("core handler", handlerBody, "if (!runtimeConfig.enabled)", "assertBearerAuthorization");
assertOrder("core handler", handlerBody, "assertBearerAuthorization", "readJsonObjectBody");
assertOrder("core handler", handlerBody, "assertFreshRequestedAt", "lookupAgentOwnership");
assertOrder("core handler", handlerBody, "assertAgentOwnership", "prepareBaseMcpAction");
assertOrder("core handler", handlerBody, "prepareBaseMcpAction", "storePreparedActionSummary");

assertIncludes("provider adapter", providerAdapter, "baseMcpStatusPath = \"/status-check\"");
assertIncludes("provider adapter", providerAdapter, "\"x-kyra-action-kind\": \"base_mcp_status_check\"");
assertIncludes("provider adapter", providerAdapter, "actionKind: input.actionKind");
assertIncludes("provider adapter", providerAdapter, "chain: input.chain");
assertIncludes("provider adapter", providerAdapter, "mode: input.mode");
assertIncludes("provider adapter", providerAdapter, "requestId: input.requestId");
assertIncludes("provider adapter", providerAdapter, "requestedAt: input.requestedAt");
assertNotIncludes("provider adapter", providerAdapter, "ownerUserId");
assertNotIncludes("provider adapter", providerAdapter, "workspaceId: input.workspaceId");
assertNotIncludes("provider adapter", providerAdapter, "agentId: input.agentId");
assertNotIncludes("provider adapter", providerAdapter, "walletAddress");
assertNotIncludes("provider adapter", providerAdapter, "rawCalldata");
assertIncludes("provider adapter", providerAdapter, "No token spend, no gas request, no calldata.");
assertIncludes("provider adapter", providerAdapter, "opaquePayloadRef: null");

assertIncludes("index test", indexTest, "baseMcpProviderTransport: async (request)");
assertIncludes("index test", indexTest, "Provider payload must not include agent id.");
assertIncludes("index test", indexTest, "Provider payload must not include workspace id.");
assertIncludes("index test", indexTest, "Provider payload must not include owner id.");
assertIncludes("index test", indexTest, "assertEquals(dependencies.storePreparedActionSummary, undefined)");

assertNotIncludes("schema", schema, "create table public.prepared_actions");
assertIncludes("base-mcp README", baseMcpReadme, "Do not call this function from Telegram.");

assertFilesDoNotInclude(
  telegramRuntimeFiles,
  /base-mcp-prepare|prepareBaseMcpAction|createBaseMcpStatusCheckAdapter|KYRA_BASE_MCP|storePreparedActionSummary/u,
  "Telegram runtime must not trigger Base MCP provider wiring",
);
assertFilesDoNotInclude(
  sourceFiles,
  /VITE_.*(?:BASE_MCP|SERVICE_ROLE|PRIVATE_KEY|BOT_TOKEN|OPENROUTER|AGENT_BRAIN_API_KEY)/u,
  "Frontend must not expose backend secret env keys",
);

console.log("Phase 7J Base MCP provider wiring checks passed.");
