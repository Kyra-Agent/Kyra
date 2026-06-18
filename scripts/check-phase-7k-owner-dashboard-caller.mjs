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
  assert(firstIndex < secondIndex, `${sourceName} must preserve safe call order.`);
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

const doc = read("docs/phase-7K-owner-dashboard-status-caller.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const packageJson = read("package.json");
const appConfig = read("src/config/appConfig.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const service = read("src/services/baseMcpPrepareService.ts");
const dependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");
const telegramRuntimeFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const sourceFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|js|jsx)$/u.test(path)
);

for (
  const required of [
    "# Phase 7K Owner Dashboard Base MCP Status Caller",
    "Status: local owner-dashboard caller implemented.",
    "## Objective",
    "## Dashboard Boundary",
    "## Response Boundary",
    "## Runtime State",
    "## Preserved Safety Boundaries",
    "## Verification",
    "## Done Criteria",
    "runtime gate remains default-off",
    "Prepared-action storage remains unwired.",
    "Telegram runtime cannot call the function.",
  ]
) {
  assertIncludes("Phase 7K doc", doc, required);
}

assertIncludes("package.json", packageJson, '"check:phase-7k"');
assertIncludes("package.json", packageJson, "npm run check:phase-7k");
assertIncludes(
  "Phase 7 audit",
  phase7Audit,
  "Audit packet: `docs/phase-7K-owner-dashboard-status-caller.md`.",
);

assertIncludes("app config", appConfig, "/functions/v1/base-mcp-prepare");
assertIncludes("app config", appConfig, "baseMcpPrepareConfigured");
assertNotIncludes("app config", appConfig, "VITE_KYRA_BASE_MCP");
assertNotIncludes("app config", appConfig, "KYRA_BASE_MCP_API_KEY");
assertNotIncludes("app config", appConfig, "KYRA_BASE_MCP_ENDPOINT");

for (
  const requestField of [
    'actionKind: "base_mcp_status_check"',
    "agentId,",
    "workspaceId,",
    "requestId: createRequestId()",
    'chain: "base"',
    'mode: "read_only"',
    "requestedAt: new Date().toISOString()",
  ]
) {
  assertIncludes("Base MCP dashboard service", service, requestField);
}

for (
  const responseGuard of [
    'value.actionKind !== "base_mcp_status_check"',
    'value.chain !== "Base"',
    'value.risk !== "read-only"',
    "value.opaquePayloadRef !== null",
    "value.routeSummary.length > 160",
    "value.valueSummary.length > 160",
    "expiryMs > nowMs + maxPreviewTtlMs",
    'status === "preview_ready"',
  ]
) {
  assertIncludes("Base MCP dashboard service", service, responseGuard);
}

for (
  const forbidden of [
    "walletAddress",
    "tokenAmount",
    "recipient",
    "calldata:",
    "privateKey",
    "seedPhrase",
    "botToken",
    "KYRA_BASE_MCP_API_KEY",
    "KYRA_BASE_MCP_ENDPOINT",
    "storePreparedActionSummary",
  ]
) {
  assertNotIncludes("Base MCP dashboard service", service, forbidden);
}

assertIncludes("dashboard", dashboard, "handleBaseMcpStatusCheck");
assertIncludes("dashboard", dashboard, "ensureFreshAuthSession(authSession)");
assertIncludes("dashboard", dashboard, "agentId: agentRecord.id");
assertIncludes("dashboard", dashboard, "workspaceId: agentRecord.workspaceId");
assertIncludes("dashboard", dashboard, "baseMcpRequestSequenceRef");
assertIncludes(
  "dashboard",
  dashboard,
  "requestSequence !== baseMcpRequestSequenceRef.current",
);
assertIncludes("dashboard", dashboard, "Check Base MCP status");
assertIncludes(
  "dashboard",
  dashboard,
  "No storage write, wallet prompt, signing, or transaction submission.",
);
assertOrder(
  "dashboard",
  dashboard,
  "ensureFreshAuthSession(authSession)",
  "prepareBaseMcpStatusCheck({",
);

assertNotIncludes("runtime dependencies", dependencies, "storePreparedActionSummary");
assertFilesDoNotInclude(
  telegramRuntimeFiles,
  /base-mcp-prepare|prepareBaseMcpStatusCheck|storePreparedActionSummary/u,
  "Telegram runtime must not call the Phase 7K dashboard path",
);
assertNotIncludes(
  "public agent",
  read("src/pages/PublicAgent.tsx"),
  "prepareBaseMcpStatusCheck",
);
assertFilesDoNotInclude(
  sourceFiles,
  /VITE_.*(?:SERVICE_ROLE|PRIVATE_KEY|BOT_TOKEN|OPENROUTER|AGENT_BRAIN_API_KEY|BASE_MCP_API_KEY|BASE_MCP_ENDPOINT)/u,
  "Frontend must not expose backend secret env keys",
);

console.log("Phase 7K owner dashboard caller checks passed.");
