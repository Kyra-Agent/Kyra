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

const doc = read("docs/phase-7AU-official-oauth-route-implementation-plan.md");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const threatModel = read("docs/phase-7O-official-mcp-oauth-threat-model.md");
const oauthArchitecture = read(
  "docs/phase-7P-official-mcp-oauth-client-architecture.md",
);
const decisionPacket = read(
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
const freezeGuard = read("docs/phase-7AP-no-go-runtime-freeze-guard.md");
const consentUx = read("docs/phase-7AT-owner-consent-and-disconnect-ux-blueprint.md");
const appConfig = read("src/config/appConfig.ts");
const walletBoundary = read("src/providers/WalletProviderBoundary.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const publicAgent = read("src/pages/PublicAgent.tsx");
const telegramWebhook = read("supabase/functions/telegram-webhook/core.ts");
const runtimeConfig = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const supabaseSchema = read("supabase/schema.sql");

for (
  const expected of [
    "# Phase 7AU Official OAuth Route Implementation Plan",
    "Status: implementation plan complete. Runtime remains NO-GO and disabled.",
    "This phase is planning only.",
    "Provider evidence still",
    "`official-mcp-oauth-start`",
    "`official-mcp-oauth-callback`",
    "`official-mcp-token-broker`",
    "`official-mcp-revoke`",
    "`official-mcp-status`",
    "All gates default off.",
    "KYRA_OFFICIAL_MCP_OAUTH_START_ENABLED",
    "KYRA_OFFICIAL_MCP_OAUTH_CALLBACK_ENABLED",
    "KYRA_OFFICIAL_MCP_TOKEN_PERSISTENCE_ENABLED",
    "KYRA_OFFICIAL_MCP_REVOKE_ENABLED",
    "KYRA_WALLET_EXECUTION_ENABLED",
    "Future `official-mcp-oauth-start` must:",
    "Accept POST only.",
    "Require a fresh authenticated owner session.",
    "Fetch and validate Protected Resource Metadata.",
    "Generate one 256-bit state.",
    "Generate one transaction-specific PKCE verifier.",
    "Generate one browser-binding nonce.",
    "Future `official-mcp-oauth-callback` must:",
    "Accept GET only on one fixed first-party Kyra callback path.",
    "Atomically consume one unexpired OAuth transaction before token exchange.",
    "Exchange code backend-side with the bound PKCE verifier",
    "The callback must not trust the current browser Supabase session",
    "Future token broker must be internal-only",
    "Future revoke route must:",
    "Future status route may return only owner-safe summary fields",
    "Future route implementation must include tests for:",
    "Rollback And Incident Plan",
    "Forbidden Shortcuts",
    "hardcode authorization discovery while Protected Resource Metadata is missing",
    "start OAuth from Telegram",
    "treat OAuth consent as Kyra approval",
    "treat Kyra approval as Base Account approval",
    "no `supabase/functions/official-mcp-oauth-start`",
    "no official OAuth route imports in frontend",
    "`walletExecution` remains `disabled`",
    "npm run check:phase-7au",
  ]
) {
  includes("Phase 7AU plan", doc, expected);
}

for (
  const forbidden of [
    "Status: live",
    "Runtime enabled",
    "OAuth route implemented",
    "authorization URL is generated",
    "PKCE values are generated",
    "state values are generated",
    "token exchange is implemented",
    "wallet prompt enabled",
    "transaction submission enabled",
    "Telegram may start OAuth",
  ]
) {
  excludes("Phase 7AU plan", doc, forbidden);
}

includes("package.json", packageJson, '"check:phase-7au"');
includes("package.json", packageJson, "npm run check:phase-7au");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AU-official-oauth-route-implementation-plan.md",
);
includes(
  "private context",
  context,
  "The primary product target is Robinhood Chain mainnet, chain ID `4663`.",
);

includes("Phase 7O threat model", threatModel, "Use Authorization Code flow with PKCE `S256`");
includes(
  "Phase 7P architecture",
  oauthArchitecture,
  "The browser never receives an official MCP access token",
);
includes("Phase 7AO decision", decisionPacket, "Decision: **NO-GO**.");
includes("Phase 7AP freeze", freezeGuard, "Only reviewed disabled-only skeletons may exist");
includes(
  "Phase 7AT consent UX",
  consentUx,
  "No consent or disconnect UI may become interactive until:",
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
excludes("public agent", publicAgent, "official-mcp-revoke");
excludes("Telegram webhook", telegramWebhook, "official-mcp-oauth-start");
excludes("Telegram webhook", telegramWebhook, "official-mcp-revoke");
includes(
  "Base MCP runtime config",
  runtimeConfig,
  'url.hostname.toLowerCase() === "mcp.base.org"',
);
includes("Base MCP runtime config", runtimeConfig, 'return { enabled: false };');

for (
  const requiredRuntimePath of [
    "supabase/functions/official-mcp-oauth-start",
    "supabase/functions/official-mcp-oauth-callback",
    "supabase/functions/official-mcp-token-broker",
    "supabase/functions/official-mcp-revoke",
    "supabase/functions/official-mcp-status",
  ]
) {
  assert(
    existsSync(resolve(root, requiredRuntimePath)),
    `${requiredRuntimePath} disabled-only skeleton must exist after Phase 7AX.`,
  );
}
for (
  const forbiddenRuntimePath of [
    "supabase/functions/official-mcp-refresh-token",
    "supabase/functions/official-mcp-tools",
  ]
) {
  assert(
    !existsSync(resolve(root, forbiddenRuntimePath)),
    `${forbiddenRuntimePath} must remain absent.`,
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

console.log("Phase 7AU official OAuth route implementation plan checks passed.");
