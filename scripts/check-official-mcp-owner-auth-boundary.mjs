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

const helperFiles = [
  "supabase/functions/official-mcp-shared/owner-auth.ts",
  "supabase/functions/official-mcp-shared/owner-auth_test.ts",
  "supabase/functions/official-mcp-shared/ownership.ts",
  "supabase/functions/official-mcp-shared/ownership_test.ts",
];

for (const path of helperFiles) {
  assert(existsSync(resolve(root, path)), `${path} is required.`);
}

const ownerAuth = read("supabase/functions/official-mcp-shared/owner-auth.ts");
const ownership = read("supabase/functions/official-mcp-shared/ownership.ts");
const helperRuntime = `${ownerAuth}\n${ownership}`;

for (
  const expected of [
    "OfficialMcpOwnerAuthDependencies",
    "OfficialMcpAuthenticatedOwner",
    "OfficialMcpSafeError",
    "readOfficialMcpBearerAuthorization",
    "authenticateOfficialMcpOwner",
    "isOfficialMcpCanonicalUuid",
    "OfficialMcpOwnershipLookup",
    "OfficialMcpOwnerAgentBinding",
    "resolveOfficialMcpOwnerAgentBinding",
    "requested_binding_not_found",
    "server_error",
    "unauthorized",
  ]
) {
  includes("Official MCP owner-auth helpers", helperRuntime, expected);
}

for (
  const forbiddenPattern of [
    [/\bDeno\.env\b/u, "environment reads"],
    [/createClient\s*\(/u, "Supabase client construction"],
    [/@supabase\/supabase-js/u, "Supabase client imports"],
    [/\bfetch\s*\(/u, "provider or network fetch"],
    [/https?:\/\//u, "provider URL"],
    [/mcp\.base\.org/iu, "official Base MCP host"],
    [/authorization_endpoint/iu, "OAuth authorization endpoint"],
    [/token_endpoint/iu, "OAuth token endpoint"],
    [/code_verifier|code_challenge/iu, "PKCE material"],
    [/access[_-]?token|refresh[_-]?token/iu, "token material"],
    [/localStorage|sessionStorage/u, "browser token storage"],
    [/signMessage|signTypedData|sendTransaction|writeContract/u, "wallet execution"],
    [/eth_sendTransaction|wallet_sendCalls/iu, "transaction RPC"],
    [/\.(?:text|json|formData|arrayBuffer)\s*\(/u, "request body read"],
    [/new URL\s*\(/u, "request query parsing"],
    [/console\.(?:log|error|warn|info|debug)/u, "helper logging"],
  ]
) {
  assert(
    !forbiddenPattern[0].test(helperRuntime),
    `Owner-auth helpers must not contain ${forbiddenPattern[1]}.`,
  );
}

for (
  const route of [
    "official-mcp-oauth-start",
    "official-mcp-oauth-callback",
    "official-mcp-token-broker",
    "official-mcp-revoke",
    "official-mcp-status",
  ]
) {
  const routeSource = read(`supabase/functions/${route}/index.ts`);
  excludes(route, routeSource, "owner-auth.ts");
  excludes(route, routeSource, "ownership.ts");
  excludes(route, routeSource, "authenticateOfficialMcpOwner");
  excludes(route, routeSource, "resolveOfficialMcpOwnerAgentBinding");
  excludes(route, routeSource, "_request.json");
  excludes(route, routeSource, "new URL(_request.url");
}

const config = read("supabase/config.toml");
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

const schema = read("supabase/schema.sql");
for (
  const term of [
    "official_mcp_credentials",
    "official_mcp_oauth_transactions",
    "official_mcp_wallet_authority_bindings",
  ]
) {
  excludes("supabase/schema.sql", schema, term);
}

const frontendSource = [
  read("src/pages/Dashboard.tsx"),
  read("src/pages/PublicAgent.tsx"),
  read("src/services/baseMcpPrepareService.ts"),
].join("\n");
const telegramSource = read("supabase/functions/telegram-webhook/core.ts");

for (
  const route of [
    "official-mcp-oauth-start",
    "official-mcp-oauth-callback",
    "official-mcp-token-broker",
    "official-mcp-revoke",
    "official-mcp-status",
  ]
) {
  excludes("frontend", frontendSource, route);
  excludes("telegram", telegramSource, route);
}

const appConfig = read("src/config/appConfig.ts");
includes("app config", appConfig, 'walletExecution: "disabled"');

console.log("Official MCP owner-auth helper boundary checks passed.");
