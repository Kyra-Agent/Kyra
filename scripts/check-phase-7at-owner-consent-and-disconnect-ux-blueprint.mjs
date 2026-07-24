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

const doc = read("docs/phase-7AT-owner-consent-and-disconnect-ux-blueprint.md");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const decisionPacket = read(
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
const authorityBlueprint = read(
  "docs/phase-7AQ-owner-wallet-authority-blueprint.md",
);
const tokenBlueprint = read(
  "docs/phase-7AR-token-lifecycle-and-revocation-blueprint.md",
);
const schemaBlueprint = read(
  "docs/phase-7AS-official-mcp-token-schema-rls-blueprint.md",
);
const appConfig = read("src/config/appConfig.ts");
const walletBoundary = read("src/providers/WalletProviderBoundary.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const publicAgent = read("src/pages/PublicAgent.tsx");
const telegramWebhook = read("supabase/functions/telegram-webhook/core.ts");
const runtimeConfig = read("supabase/functions/base-mcp-prepare/runtime-config.ts");

for (
  const expected of [
    "# Phase 7AT Owner Consent And Disconnect UX Blueprint",
    "Status: blueprint complete. Runtime remains NO-GO and disabled.",
    "This phase is a blueprint only.",
    "Current UI may only show blocked/read-only status and owner education.",
    "Which deployed agent receives authority?",
    "Which official provider, issuer, and resource is being authorized?",
    "Which exact scope and tool class is requested?",
    "Where are tokens stored?",
    "How do I disconnect or revoke?",
    "Future consent UI must show all of these fields",
    "Owner",
    "Workspace",
    "Agent",
    "Provider",
    "Issuer",
    "Resource",
    "Base Account",
    "Scope",
    "Capability",
    "Value ceiling",
    "Token boundary",
    "Revocation",
    "Telegram boundary",
    "You are authorizing this deployed Kyra agent only.",
    "This does not authorize every Kyra agent.",
    "Kyra approval and Base Account approval are separate decisions.",
    "Future UI must not hide wallet authority behind generic labels",
    "Generic button text may be used only if paired with visible adjacent authority",
    "No state may skip the next state.",
    "OAuth consent cannot imply Kyra approval.",
    "Kyra approval cannot imply Base Account approval.",
    "Future disconnect UI must:",
    "Disconnect must not be possible from Telegram",
    "Future emergency disablement must be separate from ordinary disconnect.",
    "Future UI must use deterministic failure copy",
    "Telegram cannot approve, sign, submit, disconnect, or revoke wallet authority.",
    "Telegram may only say equivalent safe copy",
    "Public agent pages may show only high-level capability status",
    "Phase 7C changes from NO-GO to GO",
    "no live Base Account connect control",
    "no official Base MCP authorize button",
    "no disconnect/revoke runtime",
    "`walletExecution` remains `disabled`",
    "npm run check:phase-7at",
  ]
) {
  includes("Phase 7AT blueprint", doc, expected);
}

for (
  const forbidden of [
    "Status: live",
    "Base Account connect is live",
    "official Base MCP authorize button is enabled",
    "wallet prompt enabled",
    "transaction submission enabled",
    "Telegram may approve",
    "Telegram can disconnect",
    "OAuth route implemented",
    "token status API implemented",
  ]
) {
  excludes("Phase 7AT blueprint", doc, forbidden);
}

includes("package.json", packageJson, '"check:phase-7at"');
includes("package.json", packageJson, "npm run check:phase-7at");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AT-owner-consent-and-disconnect-ux-blueprint.md",
);
includes(
  "private context",
  context,
  "The primary product target is Robinhood Chain mainnet, chain ID `4663`.",
);

includes("Phase 7AO decision", decisionPacket, "Decision: **NO-GO**.");
includes(
  "Phase 7AQ authority blueprint",
  authorityBlueprint,
  "Consent copy must not hide wallet authority behind generic wording",
);
includes(
  "Phase 7AR token blueprint",
  tokenBlueprint,
  "Owner consent UX and disconnect UX are approved.",
);
includes(
  "Phase 7AS schema blueprint",
  schemaBlueprint,
  "Public, Telegram, And LLM Boundary",
);

includes("app config", appConfig, 'walletExecution: "disabled"');
excludes("app config", appConfig, "walletExecution: readEnv");
includes(
  "wallet boundary",
  walletBoundary,
  'appConfig.integrations.walletExecution === "disabled"',
);
includes(
  "dashboard",
  dashboard,
  "Official Base MCP wallet authority is blocked",
);
excludes("dashboard", dashboard, "official-mcp-oauth-start");
excludes("dashboard", dashboard, "official-mcp-oauth-callback");
excludes("dashboard", dashboard, "official-mcp-revoke");
excludes("dashboard", dashboard, "agent_wallet:transact");
excludes("dashboard", dashboard, "agent_wallet:escalate");
excludes("public agent", publicAgent, "official-mcp-oauth-start");
excludes("public agent", publicAgent, "official-mcp-revoke");
excludes("Telegram webhook", telegramWebhook, "official-mcp-oauth-start");
excludes("Telegram webhook", telegramWebhook, "official-mcp-revoke");
includes(
  "Base MCP runtime config",
  runtimeConfig,
  'url.hostname.toLowerCase() === "mcp.base.org"',
);

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

console.log("Phase 7AT owner consent and disconnect UX blueprint checks passed.");
