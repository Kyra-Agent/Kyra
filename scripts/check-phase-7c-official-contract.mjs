import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(name, source, value) {
  assert(source.includes(value), `${name} must include: ${value}`);
}

function excludes(name, source, value) {
  assert(!source.includes(value), `${name} must not include: ${value}`);
}

function readCodeTree(path) {
  const output = [];

  for (const entry of readdirSync(resolve(root, path))) {
    const relative = join(path, entry);
    const absolute = resolve(root, relative);

    if (statSync(absolute).isDirectory()) {
      output.push(...readCodeTree(relative));
      continue;
    }

    if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(entry))) {
      output.push({ path: relative, source: read(relative) });
    }
  }

  return output;
}

const doc = read("docs/phase-7C-official-base-mcp-provider-contract-audit.md");
const roadmap = read("docs/product-phase-roadmap.md");
const packageJson = read("package.json");
const frontendEnv = read(".env.example");
const functionEnv = read("supabase/functions/.env.example");
const frontendCode = readCodeTree("src");
const functionCode = readCodeTree("supabase/functions");

for (
  const expected of [
    "# Phase 7C Official Base MCP Provider Contract Audit",
    "Status: no-go for live wallet authority",
    "https://mcp.base.org/.well-known/oauth-authorization-server",
    "https://mcp.base.org/.well-known/oauth-protected-resource",
    "`WWW-Authenticate: Bearer realm=\"mcp\"`",
    "`agent_wallet:transact`",
    "`agent_wallet:escalate`",
    "No-go for the official hosted Base MCP adapter implementation.",
    "monitor official provider metadata, unauthenticated `/mcp` challenge",
    "`npm run observe:base-mcp-provider`",
    "Protected resource metadata is available and stable.",
    "Exact non-escalating scope candidate is known.",
    "User wallet security and user Telegram bot token security stay above product",
    "not for the independent Base Account SDK primary lane",
  ]
) {
  includes("Phase 7C official contract audit", doc, expected);
}

for (
  const rejected of [
    "| omitted scope | rejected |",
    "| `agent_wallet:transact` | rejected |",
    "| `agent_wallet:escalate` | rejected |",
    "| both advertised scopes | rejected |",
    "| hypothetical read-only scope | blocked |",
  ]
) {
  includes("Phase 7C scope decision", doc, rejected);
}

includes(
  "canonical roadmap",
  roadmap,
  "Status: blocked by currently verified provider metadata and scope ambiguity.",
);
includes("package.json", packageJson, "check:phase-7c-contract");

for (
  const [name, source] of [
    [".env.example", frontendEnv],
    ["supabase/functions/.env.example", functionEnv],
  ]
) {
  for (
    const forbidden of [
      "MCP_OAUTH_SCOPE",
      "MCP_OAUTH_SCOPES",
      "MCP_OAUTH_ACCESS_TOKEN",
      "MCP_OAUTH_REFRESH_TOKEN",
      "AGENT_WALLET_TRANSACT",
      "AGENT_WALLET_ESCALATE",
    ]
  ) {
    excludes(name, source, forbidden);
  }
}

assert(
  existsSync(resolve(root, "supabase/functions/official-mcp-oauth-start")),
  "official MCP OAuth start disabled-only skeleton must exist after Phase 7AX",
);
assert(
  existsSync(resolve(root, "supabase/functions/official-mcp-oauth-callback")),
  "official MCP OAuth callback disabled-only skeleton must exist after Phase 7AX",
);

for (const { path, source } of [...frontendCode, ...functionCode]) {
  for (
    const forbidden of [
      "agent_wallet:transact",
      "agent_wallet:escalate",
      "mcp.base.org/authorize",
      "mcp.base.org/register",
      "official-mcp-oauth-start",
      "official-mcp-oauth-callback",
      "MCP_OAUTH_ACCESS_TOKEN",
      "MCP_OAUTH_REFRESH_TOKEN",
    ]
  ) {
    excludes(path, source, forbidden);
  }
}

console.log("Phase 7C official Base MCP provider-contract checks passed.");
