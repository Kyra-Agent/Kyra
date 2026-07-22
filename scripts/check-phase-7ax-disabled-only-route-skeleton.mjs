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

const doc = read("docs/phase-7AX-disabled-only-route-skeleton.md");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const decisionPacket = read(
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
const appConfig = read("src/config/appConfig.ts");
const runtimeConfig = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const config = read("supabase/config.toml");
const schema = read("supabase/schema.sql");
const gates = read("supabase/functions/official-mcp-shared/gates.ts");
const disabledResponse = read(
  "supabase/functions/official-mcp-shared/disabled-response.ts",
);

for (
  const expected of [
    "# Phase 7AX Disabled-Only Route Skeleton",
    "Status: local disabled-only skeleton complete. Runtime remains NO-GO.",
    "The owner explicitly approved Phase 7AX local disabled-only skeleton work",
    "This approval permits local code and tests only.",
    "fixed sanitized disabled responses",
    "fixed sanitized not-implemented responses",
    "If a route gate is mistakenly set to exact lowercase `true`",
    "The route skeletons do not read request bodies",
    "User wallet authority and user Telegram bot-token privacy remain the highest",
    "The functions are not configured for deployment in `supabase/config.toml`.",
    "Phase 7AX result: `disabled_safe`.",
    "It does not authorize controlled enablement",
    "No push or deploy occurred.",
    "npm run check:phase-7ax",
  ]
) {
  includes("Phase 7AX document", doc, expected);
}

for (
  const forbidden of [
    "Status: live",
    "Phase 7AX result: `enabled`",
    "provider contact approved",
    "OAuth enablement approved",
    "token storage enabled",
    "wallet execution enabled",
    "push completed",
    "deploy completed",
  ]
) {
  excludes("Phase 7AX document", doc, forbidden);
}

includes("package.json", packageJson, '"check:official-mcp-disabled-routes"');
includes("package.json", packageJson, '"check:phase-7ax"');
includes("package.json", packageJson, "npm run check:phase-7ax");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AX-disabled-only-route-skeleton.md",
);
includes(
  "private context",
  context,
  "Supporting readiness packets are evidence under Phase 7",
);
includes("Phase 7AO decision", decisionPacket, "Decision: **NO-GO**.");
includes("app config", appConfig, 'walletExecution: "disabled"');
excludes("app config", appConfig, "walletExecution: readEnv");
includes(
  "Base MCP runtime config",
  runtimeConfig,
  'url.hostname.toLowerCase() === "mcp.base.org"',
);
includes("Base MCP runtime config", runtimeConfig, "return { enabled: false };");
includes("official MCP gates", gates, 'return value === "true";');
includes(
  "disabled response",
  disabledResponse,
  "official_mcp_${route}_not_implemented",
);
includes(
  "disabled response",
  disabledResponse,
  "official_mcp_${route}_disabled",
);
includes("disabled response", disabledResponse, "gateEnabled ? 503 : 403");

for (
  const path of [
    "supabase/functions/official-mcp-shared",
    "supabase/functions/official-mcp-oauth-start",
    "supabase/functions/official-mcp-oauth-callback",
    "supabase/functions/official-mcp-token-broker",
    "supabase/functions/official-mcp-revoke",
    "supabase/functions/official-mcp-status",
  ]
) {
  assert(existsSync(resolve(root, path)), `${path} must exist in Phase 7AX.`);
}

for (
  const path of [
    "supabase/functions/official-mcp-refresh-token",
    "supabase/functions/official-mcp-tools",
  ]
) {
  assert(!existsSync(resolve(root, path)), `${path} must remain absent.`);
}

for (
  const section of [
    "[functions.official-mcp-oauth-start]",
    "[functions.official-mcp-oauth-callback]",
    "[functions.official-mcp-token-broker]",
    "[functions.official-mcp-revoke]",
    "[functions.official-mcp-status]",
  ]
) {
  excludes("supabase/config.toml", config, section);
}

for (
  const term of [
    "official_mcp_credentials",
    "official_mcp_oauth_transactions",
    "official_mcp_wallet_authority_bindings",
  ]
) {
  excludes("supabase/schema.sql", schema, term);
}

console.log("Phase 7AX disabled-only route skeleton checks passed.");
