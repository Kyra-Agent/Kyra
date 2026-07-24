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

const doc = read("docs/phase-7AR-token-lifecycle-and-revocation-blueprint.md");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const decisionPacket = read(
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
const freezeGuard = read("docs/phase-7AP-no-go-runtime-freeze-guard.md");
const authorityBlueprint = read(
  "docs/phase-7AQ-owner-wallet-authority-blueprint.md",
);
const threatModel = read("docs/phase-7O-official-mcp-oauth-threat-model.md");
const oauthArchitecture = read(
  "docs/phase-7P-official-mcp-oauth-client-architecture.md",
);
const appConfig = read("src/config/appConfig.ts");
const walletBoundary = read("src/providers/WalletProviderBoundary.tsx");
const runtimeConfig = read("supabase/functions/base-mcp-prepare/runtime-config.ts");

for (
  const expected of [
    "# Phase 7AR Token Lifecycle And Revocation Blueprint",
    "Status: blueprint complete. Runtime remains NO-GO and disabled.",
    "This phase is a blueprint only.",
    "no official Base MCP OAuth start route",
    "no official Base MCP OAuth callback route",
    "no official token broker",
    "no token refresh function",
    "no token revocation function",
    "Authorization code",
    "PKCE verifier",
    "OAuth state",
    "Access token",
    "Refresh token family",
    "owner",
    "workspace",
    "deployed agent",
    "Base Account",
    "resource/audience",
    "exact granted scope set",
    "service-role-only access path",
    "encrypted at rest outside browser-readable rows",
    "Refresh-token reuse",
    "Future revocation must run for any of these triggers:",
    "Disconnect must not be possible from Telegram",
    "Future runtime must expose independent default-off backend gates",
    "Audit Event Allowlist",
    "authorization code",
    "refresh token",
    "Telegram bot token",
    "Wrong audience/resource",
    "Phase 7C changes from NO-GO to GO",
    "no `supabase/functions/official-mcp-token-broker`",
    "`walletExecution` remains `disabled`",
    "npm run check:phase-7ar",
  ]
) {
  includes("Phase 7AR blueprint", doc, expected);
}

for (
  const forbidden of [
    "Status: live",
    "OAuth callback implemented",
    "token storage is implemented",
    "token storage enabled",
    "refresh token stored now",
    "wallet prompt enabled",
    "transaction submission enabled",
    "Phase 7D may start now",
    "Telegram may disconnect",
  ]
) {
  excludes("Phase 7AR blueprint", doc, forbidden);
}

includes("package.json", packageJson, '"check:phase-7ar"');
includes("package.json", packageJson, "npm run check:phase-7ar");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AR-token-lifecycle-and-revocation-blueprint.md",
);
includes(
  "private context",
  context,
  "The primary product target is Robinhood Chain mainnet, chain ID `4663`.",
);

includes("Phase 7AO decision", decisionPacket, "Decision: **NO-GO**.");
includes("Phase 7AP freeze", freezeGuard, "The official MCP freeze stays active while Phase 7AO is NO-GO.");
includes(
  "Phase 7AQ authority blueprint",
  authorityBlueprint,
  "Future official Base MCP tokens must be:",
);
includes("Phase 7O threat model", threatModel, "Refresh-token reuse");
includes(
  "Phase 7P architecture",
  oauthArchitecture,
  "A future backend-only token broker would:",
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
  const requiredPath of [
    "supabase/functions/official-mcp-oauth-start",
    "supabase/functions/official-mcp-oauth-callback",
    "supabase/functions/official-mcp-token-broker",
    "supabase/functions/official-mcp-revoke",
  ]
) {
  assert(
    existsSync(resolve(root, requiredPath)),
    `${requiredPath} disabled-only skeleton must exist after Phase 7AX.`,
  );
}
for (
  const forbiddenPath of [
    "supabase/functions/official-mcp-refresh-token",
    "supabase/functions/official-mcp-tools",
  ]
) {
  assert(
    !existsSync(resolve(root, forbiddenPath)),
    `${forbiddenPath} must remain absent.`,
  );
}

console.log("Phase 7AR token lifecycle and revocation blueprint checks passed.");
