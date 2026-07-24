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

const doc = read("docs/phase-7AV-disabled-route-test-harness-plan.md");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const freezeGuard = read("docs/phase-7AP-no-go-runtime-freeze-guard.md");
const routePlan = read("docs/phase-7AU-official-oauth-route-implementation-plan.md");
const decisionPacket = read(
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
const tokenBlueprint = read(
  "docs/phase-7AR-token-lifecycle-and-revocation-blueprint.md",
);
const consentUx = read("docs/phase-7AT-owner-consent-and-disconnect-ux-blueprint.md");
const appConfig = read("src/config/appConfig.ts");
const walletBoundary = read("src/providers/WalletProviderBoundary.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const publicAgent = read("src/pages/PublicAgent.tsx");
const telegramWebhook = read("supabase/functions/telegram-webhook/core.ts");
const runtimeConfig = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const supabaseSchema = read("supabase/schema.sql");
const disabledResponse = read(
  "supabase/functions/official-mcp-shared/disabled-response.ts",
);

for (
  const expected of [
    "# Phase 7AV Disabled Route Test Harness Plan",
    "Status: test harness plan complete. Runtime remains NO-GO and disabled.",
    "This phase is planning and verification only.",
    "routes must remain absent.",
    "Disabled behavior must be tested before enabled behavior.",
    "Static absence verifier",
    "Disabled route contract tests",
    "Gate parsing tests",
    "Request shape tests",
    "Secret redaction tests",
    "Frontend import tests",
    "official_mcp_oauth_start_disabled",
    "official_mcp_oauth_callback_disabled",
    "official_mcp_token_broker_disabled",
    "official_mcp_revoke_disabled",
    "official_mcp_status_disabled",
    "exact lowercase `true` means enabled",
    "Gate parsing must run before request body parsing",
    "callback with code/state still fails closed while disabled",
    "Secret Redaction Contract",
    "Static No-Wiring Checks",
    "no `supabase/functions/official-mcp-oauth-start`",
    "no official OAuth imports in `src`",
    "no official MCP token tables in `supabase/schema.sql`",
    "Future Harness File Plan",
    "supabase/functions/official-mcp-shared/gates_test.ts",
    "scripts/check-official-mcp-disabled-routes.mjs",
    "`not_applicable`",
    "`disabled_safe`",
    "`rejected`",
    "official route skeletons are absent",
    "`walletExecution` remains `disabled`",
    "npm run check:phase-7av",
  ]
) {
  includes("Phase 7AV harness plan", doc, expected);
}

for (
  const forbidden of [
    "Status: live",
    "route skeletons are implemented",
    "disabled tests are implemented",
    "authorization URL generator is implemented",
    "PKCE generator is implemented",
    "token broker is implemented",
    "wallet prompt enabled",
    "transaction submission enabled",
    "deploy completed",
    "push completed",
  ]
) {
  excludes("Phase 7AV harness plan", doc, forbidden);
}

includes("package.json", packageJson, '"check:phase-7av"');
includes("package.json", packageJson, "npm run check:phase-7av");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AV-disabled-route-test-harness-plan.md",
);
includes(
  "private context",
  context,
  "The primary product target is Robinhood Chain mainnet, chain ID `4663`.",
);

includes(
  "Phase 7AP freeze",
  freezeGuard,
  "Only reviewed disabled-only skeletons may exist",
);
includes(
  "Phase 7AU route plan",
  routePlan,
  "Disabled-route tests are written before gates can turn on.",
);
includes("Phase 7AO decision", decisionPacket, "Decision: **NO-GO**.");
includes(
  "Phase 7AR token blueprint",
  tokenBlueprint,
  "Future runtime must expose independent default-off backend gates",
);
includes(
  "Phase 7AT consent UX",
  consentUx,
  "official MCP authorize controls",
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
    "supabase/functions/official-mcp-shared",
    "supabase/functions/official-mcp-oauth-start",
    "supabase/functions/official-mcp-oauth-callback",
    "supabase/functions/official-mcp-token-broker",
    "supabase/functions/official-mcp-revoke",
    "supabase/functions/official-mcp-status",
  ]
) {
  assert(
    existsSync(resolve(root, requiredRuntimePath)),
    `${requiredRuntimePath} must exist after the approved Phase 7AX transition.`,
  );
}
includes("disabled response", disabledResponse, "official_mcp_${route}_disabled");
includes(
  "disabled response",
  disabledResponse,
  "official_mcp_${route}_not_implemented",
);
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

console.log("Phase 7AV disabled route test harness plan checks passed.");
