import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(label, source, expected) {
  assert(source.includes(expected), `${label} must include: ${expected}`);
}

function excludes(label, source, forbidden) {
  assert(!source.includes(forbidden), `${label} must not include: ${forbidden}`);
}

const doc = read("docs/phase-7AP-no-go-runtime-freeze-guard.md");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const decisionPacket = read(
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
const appConfig = read("src/config/appConfig.ts");
const walletBoundary = read("src/providers/WalletProviderBoundary.tsx");
const walletRuntime = read("src/providers/WalletRuntimeProviders.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const dashboardService = read("src/services/baseMcpPrepareService.ts");
const runtimeConfig = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const core = read("supabase/functions/base-mcp-prepare/core.ts");
const providerAdapter = read(
  "supabase/functions/base-mcp-prepare/provider-adapter.ts",
);
const runtimeConfigTest = read(
  "supabase/functions/base-mcp-prepare/runtime-config_test.ts",
);
const indexTest = read("supabase/functions/base-mcp-prepare/index_test.ts");
const officialMcpDisabledResponse = read(
  "supabase/functions/official-mcp-shared/disabled-response.ts",
);

for (
  const expected of [
    "# Phase 7AP NO-GO Runtime Freeze Guard",
    "Status: local runtime freeze guard complete. Current decision: NO-GO.",
    "`walletExecution` remains hardcoded `disabled`",
    "Dashboard may only request `base_mcp_status_check` with `mode: read_only`.",
    "Custom bridge config must reject `https://mcp.base.org`",
    "Only reviewed disabled-only skeletons may exist",
    "The official MCP freeze stays active while Phase 7AO is NO-GO.",
    "npm run check:phase-7ap",
  ]
) {
  includes("Phase 7AP doc", doc, expected);
}

for (
  const forbidden of [
    "Status: GO",
    "wallet prompt enabled",
    "OAuth callback implemented",
    "token storage enabled",
    "transaction submission enabled",
  ]
) {
  excludes("Phase 7AP doc", doc, forbidden);
}

includes("package.json", packageJson, '"check:phase-7ap"');
includes("package.json", packageJson, "npm run check:phase-7ap");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AP-no-go-runtime-freeze-guard.md",
);
includes(
  "private context",
  context,
  "The primary product target is Robinhood Chain mainnet, chain ID `4663`.",
);
includes("Phase 7AO decision", decisionPacket, "Decision: **NO-GO**.");

includes("app config", appConfig, 'walletExecution: "disabled"');
excludes("app config", appConfig, "walletExecution: readEnv");
excludes("app config", appConfig, "VITE_KYRA_ENABLE_WALLET");
includes(
  "wallet boundary",
  walletBoundary,
  'appConfig.integrations.walletExecution === "disabled"',
);
includes("wallet boundary", walletBoundary, "return <>{children}</>;");
includes("wallet boundary", walletBoundary, "lazy(() =>");
includes("wallet runtime", walletRuntime, "injected({ shimDisconnect: true })");
includes("wallet runtime", walletRuntime, "id: productChain.id");
includes("wallet runtime", walletRuntime, "storage: null");
includes("wallet runtime", walletRuntime, "reconnectOnMount={false}");
excludes("wallet runtime", walletRuntime, "coinbaseWallet");
excludes("wallet runtime", walletRuntime, "baseAccount(");
excludes("wallet runtime", walletRuntime, "window.ethereum");

includes("dashboard", dashboard, "Official Base MCP wallet authority is blocked");
includes("dashboard", dashboard, "handleBaseMcpStatusCheck");
includes("dashboard", dashboard, "canRunBaseMcpStatusCheck");
includes("dashboard service", dashboardService, 'actionKind: "base_mcp_status_check"');
includes("dashboard service", dashboardService, 'mode: "read_only"');
includes("dashboard service", dashboardService, "createRequestId()");
excludes("dashboard service", dashboardService, "agent_wallet:transact");
excludes("dashboard service", dashboardService, "agent_wallet:escalate");

includes(
  "runtime config",
  runtimeConfig,
  'export const baseMcpPrepareEnabledEnvKey = "KYRA_BASE_MCP_PREP_ENABLED"',
);
includes("runtime config", runtimeConfig, 'return value === "true";');
includes("runtime config", runtimeConfig, 'url.hostname.toLowerCase() === "mcp.base.org"');
includes("runtime config", runtimeConfig, 'return { enabled: false };');
includes("runtime config test", runtimeConfigTest, "base-mcp runtime gate enables only on exact true");
includes("runtime config test", runtimeConfigTest, "https://mcp.base.org/");

includes(
  "Base MCP core",
  core,
  'const baseMcpAllowedActionKinds = ["base_mcp_status_check"] as const;',
);
includes("Base MCP core", core, 'mode: "read_only";');
includes("Base MCP core", core, "opaquePayloadRef !== null");
includes("Base MCP core", core, "disabledBaseMcpPrepareRuntimeConfig");
includes("Base MCP core", core, "if (!runtimeConfig.enabled)");
includes("Base MCP index test", indexTest, "default-off reads no body env session ownership or adapter");
includes("Base MCP index test", indexTest, 'valueSummary: "No token spend, no gas request, no calldata."');

includes("provider adapter", providerAdapter, 'const baseMcpStatusPath = "/status-check";');
includes("provider adapter", providerAdapter, "\"x-kyra-action-kind\": \"base_mcp_status_check\"");
includes("provider adapter", providerAdapter, 'method: "POST"');
includes("provider adapter", providerAdapter, 'valueSummary: "No token spend, no gas request, no calldata."');
excludes("provider adapter", providerAdapter, "/authorize");
excludes("provider adapter", providerAdapter, "/register");
excludes("provider adapter", providerAdapter, "/token");
excludes("provider adapter", providerAdapter, "agent_wallet:transact");
excludes("provider adapter", providerAdapter, "agent_wallet:escalate");

for (
  const routePath of [
    "supabase/functions/official-mcp-oauth-start",
    "supabase/functions/official-mcp-oauth-callback",
    "supabase/functions/official-mcp-token-broker",
    "supabase/functions/official-mcp-revoke",
    "supabase/functions/official-mcp-status",
  ]
) {
  assert(
    existsSync(resolve(root, routePath)),
    `${routePath} disabled-only skeleton must exist after Phase 7AX.`,
  );
}
includes(
  "official MCP disabled response",
  officialMcpDisabledResponse,
  "official_mcp_${route}_disabled",
);
includes(
  "official MCP disabled response",
  officialMcpDisabledResponse,
  "official_mcp_${route}_not_implemented",
);
includes(
  "official MCP disabled response",
  officialMcpDisabledResponse,
  "gateEnabled ? 503 : 403",
);
assert(
  !existsSync(resolve(root, "supabase/functions/official-mcp-tools")),
  "Official MCP tool discovery function must remain absent during NO-GO freeze.",
);

console.log("Phase 7AP NO-GO runtime freeze checks passed.");
