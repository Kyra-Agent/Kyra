import { readdirSync, readFileSync, statSync } from "node:fs";
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

function assertOrder(name, source, earlier, later) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert(earlierIndex >= 0, `${name} must include: ${earlier}`);
  assert(laterIndex >= 0, `${name} must include: ${later}`);
  assert(
    earlierIndex < laterIndex,
    `${name} must place ${earlier} before ${later}`,
  );
}

const doc = read("docs/phase-7Y-full-pre-provider-audit.md");
const phase7Audit = read("docs/phase-7-pre-execution-audit.md");
const entryCheck = read("scripts/check-phase-7-entry.mjs");
const packageJson = read("package.json");
const readme = read("README.md");
const runtime = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const dependencies = read(
  "supabase/functions/base-mcp-prepare/dependencies.ts",
);
const core = read("supabase/functions/base-mcp-prepare/core.ts");
const providerAdapter = read(
  "supabase/functions/base-mcp-prepare/provider-adapter.ts",
);
const providerContract = read(
  "supabase/functions/base-mcp-prepare/provider-contract.ts",
);
const dashboard = read("src/pages/Dashboard.tsx");
const baseMcpService = read("src/services/baseMcpPrepareService.ts");
const walletBoundary = read("src/providers/WalletProviderBoundary.tsx");
const appConfig = read("src/config/appConfig.ts");
const preparedActionTypes = read("src/types/preparedAction.ts");
const telegramGate = read(
  "supabase/functions/telegram-webhook/execution-gate.ts",
);
const telegram = read("supabase/functions/telegram-webhook/core.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");
const phase7X = read("docs/phase-7X-final-pre-smoke-decision-matrix.md");
const coreHandler = core.slice(
  core.indexOf("export async function handleBaseMcpPrepareRequest"),
);
const dashboardHandler = dashboard.slice(
  dashboard.indexOf("async function handleBaseMcpStatusCheck"),
);
const sourceFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|js|jsx)$/u.test(path)
);
const telegramRuntimeFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));

for (
  const value of [
    "Status: local full pre-provider audit complete.",
    "Current decision: provider selection blocked",
    "## Audit Objective",
    "It does not select a provider",
    "## Evidence Reviewed",
    "## Audit Matrix",
    "Runtime gate",
    "Dashboard trigger",
    "Telegram route",
    "Wallet boundary",
    "Provider payload",
    "## Findings",
    "No critical finding was identified",
    "These are expected blockers, not defects.",
    "## Runtime Gate Review",
    "Disabled runtime returns a bounded disabled response before bearer auth",
    "## Dashboard Caller Review",
    "Response parser accepts only read-only summary shape",
    "## Telegram And Public Route Review",
    "Telegram execution gate keeps `canExecuteFromTelegram: false`.",
    "## Wallet And Signing Review",
    "Wallet runtime providers are isolated behind the boundary.",
    "## Prepared-Action Storage Review",
    "Runtime dependency factory does not wire `storePreparedActionSummary`.",
    "## Provider Privacy Review",
    "Sent fields are action kind, protocol, chain, mode, request id, and requested",
    "## Residual Risk",
    "Production environment values cannot be proven from local source alone.",
    "## Decision",
    "Provider selection remains blocked until Phase 7Z",
    "## Done Criteria",
  ]
) includes("Phase 7Y audit", doc, value);

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
) excludes("Phase 7Y audit", doc, forbidden);

for (
  const value of [
    "### 7Y - Full Pre-Provider Audit",
    "Audit packet: `docs/phase-7Y-full-pre-provider-audit.md`.",
    "`npm run check:phase-7y`",
  ]
) includes("Phase 7 audit", phase7Audit, value);

includes(
  "Phase 7 entry checker",
  entryCheck,
  "Status: Phase 7Z provider selection sandbox complete.",
);

for (
  const value of [
    '"check:phase-7y"',
    "npm run check:phase-7y",
  ]
) includes("package scripts", packageJson, value);

includes("README", readme, "pre-provider audit");
includes("Phase 7X", phase7X, "Current decision: blocked.");

includes("runtime gate", runtime, 'return value === "true"');
includes("runtime endpoint", runtime, 'url.protocol !== "https:"');
includes(
  "runtime endpoint",
  runtime,
  'url.hostname.toLowerCase() === "mcp.base.org"',
);
includes("runtime timeout", runtime, "Math.min(parsed, 5000)");
includes(
  "dependencies",
  dependencies,
  "if (!baseMcpPrepareRuntimeConfig.enabled)",
);
includes("dependencies", dependencies, "return dependencies;");
includes(
  "dependencies",
  dependencies,
  "dependencies.prepareBaseMcpAction = createBaseMcpStatusCheckAdapter",
);
excludes("dependencies", dependencies, "storePreparedActionSummary");

assertOrder(
  "Base MCP core handler",
  coreHandler,
  "if (!runtimeConfig.enabled)",
  "const authorization = assertBearerAuthorization",
);
assertOrder(
  "Base MCP core handler",
  coreHandler,
  "const authorization = assertBearerAuthorization",
  "readJsonObjectBody",
);
assertOrder(
  "Base MCP core handler",
  coreHandler,
  "assertFreshRequestedAt",
  "safeLookupAgentOwnership",
);
assertOrder(
  "Base MCP core handler",
  coreHandler,
  "safeLookupAgentOwnership",
  "safeCheckBaseMcpRateLimit",
);
assertOrder(
  "Base MCP core handler",
  coreHandler,
  "safeCheckBaseMcpRateLimit",
  "await dependencies.prepareBaseMcpAction",
);
includes(
  "Base MCP core body keys",
  core,
  "actionKind,agentId,chain,mode,requestId,requestedAt,workspaceId",
);
includes("Base MCP core action", core, '"base_mcp_status_check"');
includes("Base MCP core chain", core, 'value !== "base"');
includes("Base MCP core mode", core, 'value !== "read_only"');

for (
  const value of [
    "actionKind: input.actionKind",
    "protocol: baseMcpProviderProtocol",
    "chain: input.chain",
    "mode: input.mode",
    "requestId: input.requestId",
    "requestedAt: input.requestedAt",
    "No token spend, no gas request, no calldata.",
  ]
) includes("provider adapter", providerAdapter, value);

for (
  const forbidden of [
    "ownerUserId",
    "workspaceId",
    "agentId",
    "walletAddress",
    "telegramToken",
    "serviceRole",
    "calldata:",
    "transactionHash",
  ]
) excludes("provider adapter", providerAdapter, forbidden);

includes("provider contract", providerContract, "kyra_status_v1");
includes("provider contract", providerContract, "requestId");
includes(
  "provider contract",
  providerContract,
  "maxBaseMcpProviderResponseBytes = 4096",
);

includes("dashboard", dashboard, "const canRunBaseMcpStatusCheck = Boolean(");
includes("dashboard", dashboard, "authSession &&");
includes("dashboard", dashboard, "agentRecord &&");
includes(
  "dashboard",
  dashboard,
  "appConfig.functions.baseMcpPrepareConfigured",
);
assertOrder(
  "dashboard handler",
  dashboardHandler,
  "ensureFreshAuthSession(authSession)",
  "prepareBaseMcpStatusCheck",
);
includes(
  "dashboard service",
  baseMcpService,
  'actionKind: "base_mcp_status_check"',
);
includes("dashboard service", baseMcpService, 'chain: "base"');
includes("dashboard service", baseMcpService, 'mode: "read_only"');
includes("dashboard service", baseMcpService, "opaquePayloadRef !== null");
includes(
  "dashboard service",
  baseMcpService,
  "Authorization: `Bearer ${session.accessToken}`",
);

includes("app config", appConfig, 'walletExecution: "disabled"');
includes(
  "wallet boundary",
  walletBoundary,
  'appConfig.integrations.walletExecution === "disabled"',
);
includes("wallet boundary", walletBoundary, "return <>{children}</>;");
includes("prepared action types", preparedActionTypes, "walletAddress?: never");
includes(
  "prepared action types",
  preparedActionTypes,
  "telegramTokenRef?: never",
);

includes("Telegram gate", telegramGate, "canExecuteFromTelegram: false");
includes("Telegram gate", telegramGate, "canCreateDraftNow: false");
assertFilesDoNotInclude(
  telegramRuntimeFiles,
  /base-mcp-prepare|prepareBaseMcpAction|storePreparedActionSummary/u,
  "Telegram runtime must not trigger Base MCP or storage",
);
excludes("public agent", publicAgent, "base-mcp-prepare");
assertFilesDoNotInclude(
  sourceFiles.filter((path) =>
    path !== "src/providers/WalletRuntimeProviders.tsx"
  ),
  /\b(?:useSendTransaction|useWriteContract|sendTransaction|writeContract|signMessage|signTypedData)\b/u,
  "Frontend must not include live signing/submission outside isolated wallet provider",
);

console.log("Phase 7Y full pre-provider audit checks passed.");
