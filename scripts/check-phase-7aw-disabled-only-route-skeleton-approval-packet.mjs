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

const doc = read(
  "docs/phase-7AW-disabled-only-route-skeleton-approval-packet.md",
);
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const decisionPacket = read(
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
const freezeGuard = read("docs/phase-7AP-no-go-runtime-freeze-guard.md");
const routePlan = read("docs/phase-7AU-official-oauth-route-implementation-plan.md");
const harnessPlan = read("docs/phase-7AV-disabled-route-test-harness-plan.md");
const appConfig = read("src/config/appConfig.ts");
const walletBoundary = read("src/providers/WalletProviderBoundary.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const publicAgent = read("src/pages/PublicAgent.tsx");
const telegramWebhook = read("supabase/functions/telegram-webhook/core.ts");
const runtimeConfig = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const supabaseSchema = read("supabase/schema.sql");

for (
  const expected of [
    "# Phase 7AW Disabled-Only Route Skeleton Approval Packet",
    "Status: approval packet complete. Code-bearing route skeletons are not approved.",
    "Approval state: `ready_to_request_owner_skeleton_approval`.",
    "No implicit continuation",
    "`owner_approved_disabled_skeleton`",
    "Exact Future Scope",
    "Future Allowed File Boundary",
    "The list is an approval boundary, not permission to create the files.",
    "Fixed Disabled Contract",
    "official_mcp_oauth_start_disabled",
    "official_mcp_oauth_callback_disabled",
    "official_mcp_token_broker_disabled",
    "official_mcp_revoke_disabled",
    "official_mcp_status_disabled",
    "Test-First Order",
    "Commit locally only.",
    "KYRA_OFFICIAL_MCP_OAUTH_START_ENABLED",
    "KYRA_OFFICIAL_MCP_OAUTH_CALLBACK_ENABLED",
    "KYRA_OFFICIAL_MCP_TOKEN_BROKER_ENABLED",
    "KYRA_OFFICIAL_MCP_REVOKE_ENABLED",
    "KYRA_OFFICIAL_MCP_STATUS_ENABLED",
    "Only the exact lowercase string `true` may evaluate as enabled.",
    "Forbidden Changes",
    "User wallet authority and user Telegram bot-token privacy remain the highest",
    "Rollback Rule",
    "Code-bearing skeleton work still requires separate explicit owner approval.",
    "npm run check:phase-7aw",
  ]
) {
  includes("Phase 7AW approval packet", doc, expected);
}

for (
  const forbidden of [
    "Status: live",
    "Approval state: `owner_approved_disabled_skeleton`.",
    "route skeletons are implemented",
    "provider calls are enabled",
    "OAuth is enabled",
    "token storage is enabled",
    "wallet execution is enabled",
    "deploy completed",
    "push completed",
  ]
) {
  excludes("Phase 7AW approval packet", doc, forbidden);
}

includes("package.json", packageJson, '"check:phase-7aw"');
includes("package.json", packageJson, "npm run check:phase-7aw");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AW-disabled-only-route-skeleton-approval-packet.md",
);
includes(
  "private context",
  context,
  "Phase 7AW disabled-only route skeleton approval packet is complete",
);

includes("Phase 7AO decision", decisionPacket, "Decision: **NO-GO**.");
includes(
  "Phase 7AP freeze",
  freezeGuard,
  "Official MCP OAuth start/callback functions must remain absent.",
);
includes(
  "Phase 7AU route plan",
  routePlan,
  "All gates default off. Enabling one gate must not enable another.",
);
includes(
  "Phase 7AV harness plan",
  harnessPlan,
  "Those files are not approved in Phase 7AV.",
);

includes("app config", appConfig, 'walletExecution: "disabled"');
excludes("app config", appConfig, "walletExecution: readEnv");
includes(
  "wallet boundary",
  walletBoundary,
  'appConfig.integrations.walletExecution === "disabled"',
);
includes("dashboard", dashboard, "Official Base MCP wallet authority is blocked");
excludes("dashboard", dashboard, "official-mcp-oauth-start");
excludes("dashboard", dashboard, "official-mcp-oauth-callback");
excludes("dashboard", dashboard, "official-mcp-token-broker");
excludes("dashboard", dashboard, "official-mcp-revoke");
excludes("public agent", publicAgent, "official-mcp-oauth-start");
excludes("public agent", publicAgent, "official-mcp-status");
excludes("Telegram webhook", telegramWebhook, "official-mcp-oauth-start");
excludes("Telegram webhook", telegramWebhook, "official-mcp-revoke");
includes(
  "Base MCP runtime config",
  runtimeConfig,
  'url.hostname.toLowerCase() === "mcp.base.org"',
);
includes("Base MCP runtime config", runtimeConfig, "return { enabled: false };");

for (
  const forbiddenRuntimePath of [
    "supabase/functions/official-mcp-shared",
    "supabase/functions/official-mcp-oauth-start",
    "supabase/functions/official-mcp-oauth-callback",
    "supabase/functions/official-mcp-token-broker",
    "supabase/functions/official-mcp-refresh-token",
    "supabase/functions/official-mcp-revoke",
    "supabase/functions/official-mcp-status",
    "supabase/functions/official-mcp-tools",
  ]
) {
  assert(
    !existsSync(resolve(root, forbiddenRuntimePath)),
    `${forbiddenRuntimePath} must remain absent during Phase 7AW.`,
  );
}

for (
  const forbiddenSchemaTerm of [
    "official_mcp_credentials",
    "official_mcp_oauth_transactions",
    "official_mcp_wallet_authority_bindings",
  ]
) {
  excludes("supabase/schema.sql", supabaseSchema, forbiddenSchemaTerm);
}

console.log(
  "Phase 7AW disabled-only route skeleton approval packet checks passed.",
);
