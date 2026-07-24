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

const doc = read("docs/phase-7AS-official-mcp-token-schema-rls-blueprint.md");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const phase7b = read("docs/phase-7B-ownership-rls-write-path-audit.md");
const phase7ad = read("docs/phase-7AD-sql-verifier-final-approval-packet.md");
const decisionPacket = read(
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
const authorityBlueprint = read(
  "docs/phase-7AQ-owner-wallet-authority-blueprint.md",
);
const tokenBlueprint = read(
  "docs/phase-7AR-token-lifecycle-and-revocation-blueprint.md",
);
const appConfig = read("src/config/appConfig.ts");
const walletBoundary = read("src/providers/WalletProviderBoundary.tsx");
const runtimeConfig = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const supabaseSchema = read("supabase/schema.sql");
const preparedActionDraft = read("supabase/prepared_action_storage_schema_draft.sql");
const telegramWebhook = read("supabase/functions/telegram-webhook/core.ts");
const publicAgent = read("src/pages/PublicAgent.tsx");

for (
  const expected of [
    "# Phase 7AS Official MCP Token Schema And RLS Blueprint",
    "Status: blueprint complete. No SQL is approved or applied.",
    "This phase is design-only.",
    "OAuth transaction",
    "Wallet authority binding",
    "OAuth credential",
    "Consent packet",
    "Token audit event",
    "Disconnect tombstone",
    "No public table or public view may expose these classes.",
    "## Forbidden Columns",
    "raw authorization code",
    "raw PKCE verifier",
    "access token",
    "refresh token",
    "Telegram bot token",
    "Supabase service-role key",
    "provider API key",
    "owner_user_id",
    "workspace_id",
    "agent_id",
    "resource",
    "scope_set_hash",
    "RLS enabled on every table.",
    "`anon` has no table or view access.",
    "`authenticated` has no direct `insert`, `update`, or `delete` grants.",
    "Views must be `security_invoker = true`.",
    "secret_columns_absent_from_views",
    "boolean_only_output",
    "Telegram may only receive sanitized refusal or owner-dashboard handoff copy.",
    "Phase 7C changes from NO-GO to GO",
    "no executable official MCP token schema",
    "no `official_mcp_credentials` table in `supabase/schema.sql`",
    "`walletExecution` remains `disabled`",
    "npm run check:phase-7as",
  ]
) {
  includes("Phase 7AS blueprint", doc, expected);
}

for (
  const forbidden of [
    "Status: live",
    "Status: SQL approved",
    "SQL has been applied",
    "create table public.official_mcp_credentials",
    "grant insert on public.official_mcp_credentials to authenticated",
    "token storage is implemented",
    "OAuth callback implemented",
    "wallet prompt enabled",
    "transaction submission enabled",
    "Telegram may approve",
  ]
) {
  excludes("Phase 7AS blueprint", doc, forbidden);
}

includes("package.json", packageJson, '"check:phase-7as"');
includes("package.json", packageJson, "npm run check:phase-7as");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AS-official-mcp-token-schema-rls-blueprint.md",
);
includes(
  "private context",
  context,
  "The primary product target is Robinhood Chain mainnet, chain ID `4663`.",
);

includes("Phase 7B RLS audit", phase7b, "RLS enabled on every sensitive table.");
includes("Phase 7AD SQL packet", phase7ad, "No SQL has been applied.");
includes("Phase 7AO decision", decisionPacket, "Decision: **NO-GO**.");
includes(
  "Phase 7AQ authority blueprint",
  authorityBlueprint,
  "No table may expose tokens, codes, verifiers, states, secrets",
);
includes(
  "Phase 7AR token blueprint",
  tokenBlueprint,
  "Any future SQL must receive a separate RLS review before it is applied.",
);

includes("app config", appConfig, 'walletExecution: "disabled"');
excludes("app config", appConfig, "walletExecution: readEnv");
includes(
  "wallet boundary",
  walletBoundary,
  'appConfig.integrations.walletExecution === "disabled"',
);
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
    "official_mcp_consent_packets",
    "official_mcp_token_audit_events",
  ]
) {
  excludes("supabase/schema.sql", supabaseSchema, forbiddenSchemaTerm);
}

includes("prepared action draft", preparedActionDraft, "DRAFT ONLY - DO NOT APPLY.");
excludes("Telegram webhook", telegramWebhook, "official_mcp_credentials");
excludes("Telegram webhook", telegramWebhook, "official-mcp-token-broker");
excludes("public agent", publicAgent, "official_mcp_credentials");
excludes("public agent", publicAgent, "official-mcp-token-broker");

console.log("Phase 7AS official MCP token schema and RLS blueprint checks passed.");
