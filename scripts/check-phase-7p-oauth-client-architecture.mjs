import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (name, source, value) =>
  assert(source.includes(value), `${name} must include: ${value}`);
const excludes = (name, source, value) =>
  assert(!source.includes(value), `${name} must not include: ${value}`);

function readCodeTree(path) {
  const output = [];
  for (const entry of readdirSync(resolve(root, path))) {
    const relative = join(path, entry);
    const absolute = resolve(root, relative);
    if (statSync(absolute).isDirectory()) {
      output.push(...readCodeTree(relative));
    } else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(entry))) {
      output.push({ path: relative, source: read(relative) });
    }
  }
  return output;
}

const doc = read("docs/phase-7P-official-mcp-oauth-client-architecture.md");
const runtime = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const frontendEnv = read(".env.example");
const functionEnv = read("supabase/functions/.env.example");
const schema = read("supabase/schema.sql");
const frontendCode = readCodeTree("src");
const telegramCode = readCodeTree("supabase/functions/telegram-webhook");

for (
  const value of [
    "Status: backend-for-frontend architecture selected locally",
    "## Live Provider Evidence",
    "`token_endpoint_auth_methods_supported` contains only `none`",
    "Protected Resource Metadata",
    "## Rejected Architectures",
    "### Browser OAuth Client",
    "### Hardcoded Authorization Discovery",
    "### Dynamic Client Registration At Runtime",
    "## Proposed Component Boundaries",
    "### OAuth Start Boundary",
    "### OAuth Callback Boundary",
    "`HttpOnly`, `Secure`, `SameSite=Lax` cookie",
    "Referrer-Policy: no-referrer",
    "browser-binding cookie prevents",
    "### Token Broker Boundary",
    "### MCP Client Boundary",
    "### Wallet Boundary",
    "## Current Blocking Decisions",
    "No read-only scope is advertised",
    "The next safe work is scope and consent qualification",
  ]
) includes("Phase 7P architecture", doc, value);

assert(
  !existsSync(resolve(root, "supabase/functions/official-mcp-oauth-start")),
  "official MCP OAuth start function must remain absent",
);
assert(
  !existsSync(resolve(root, "supabase/functions/official-mcp-oauth-callback")),
  "official MCP OAuth callback function must remain absent",
);

includes(
  "custom runtime",
  runtime,
  'url.hostname.toLowerCase() === "mcp.base.org"',
);

for (
  const [name, source] of [
    ["frontend environment", frontendEnv],
    ["function environment", functionEnv],
  ]
) {
  for (
    const value of [
      "MCP_OAUTH_CLIENT_ID",
      "MCP_OAUTH_ACCESS_TOKEN",
      "MCP_OAUTH_REFRESH_TOKEN",
      "MCP_OAUTH_REDIRECT_URI",
      "MCP_OAUTH_START_ENABLED",
      "MCP_OAUTH_CALLBACK_ENABLED",
    ]
  ) excludes(name, source, value);
}

for (const value of ["official_mcp_oauth", "mcp_oauth_credentials"]) {
  excludes("schema", schema, value);
}

for (const { path, source } of [...frontendCode, ...telegramCode]) {
  for (
    const value of [
      "official-mcp-oauth-start",
      "official-mcp-oauth-callback",
      "agent_wallet:transact",
      "agent_wallet:escalate",
      "mcp.base.org/authorize",
      "mcp.base.org/register",
      "MCP_OAUTH_ACCESS_TOKEN",
      "MCP_OAUTH_REFRESH_TOKEN",
    ]
  ) excludes(path, source, value);
}

console.log("Phase 7P official MCP OAuth client architecture checks passed.");
