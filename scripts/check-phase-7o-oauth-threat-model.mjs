import { readdirSync, readFileSync, statSync } from "node:fs";
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

const doc = read("docs/phase-7O-official-mcp-oauth-threat-model.md");
const runtime = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const frontendEnv = read(".env.example");
const functionEnv = read("supabase/functions/.env.example");
const packageJson = read("package.json");
const frontendCode = readCodeTree("src");
const telegramCode = readCodeTree("supabase/functions/telegram-webhook");

for (
  const value of [
    "Status: threat model approved locally",
    "## Crown Jewels",
    "## Trust Boundaries",
    "## Mandatory Security Invariants",
    "PKCE `S256`",
    "metadata advertises PKCE `S256` support",
    "one-time state",
    "Token passthrough",
    "`agent_wallet:transact`",
    "`agent_wallet:escalate`",
    "Authorization, Kyra approval, wallet prompt, wallet signature, and chain",
    "## Threat Matrix",
    "## Token Storage Contract Before Implementation",
    "## Kill Switch And Incident Response",
    "No official MCP OAuth callback route exists.",
    "No registration, authorization, token, session, tool call, signature, or",
  ]
) includes("Phase 7O threat model", doc, value);

includes(
  "custom runtime",
  runtime,
  'url.hostname.toLowerCase() === "mcp.base.org"',
);

for (
  const [name, source] of [
    ["frontend environment", frontendEnv],
    ["function environment", functionEnv],
    ["package manifest", packageJson],
  ]
) {
  for (
    const value of [
      "MCP_OAUTH_CLIENT_ID",
      "MCP_OAUTH_ACCESS_TOKEN",
      "MCP_OAUTH_REFRESH_TOKEN",
      "MCP_OAUTH_CLIENT_SECRET",
      "MCP_OAUTH_REDIRECT_URI",
    ]
  ) excludes(name, source, value);
}

for (const { path, source } of [...frontendCode, ...telegramCode]) {
  for (
    const value of [
      "agent_wallet:transact",
      "agent_wallet:escalate",
      "mcp.base.org/authorize",
      "mcp.base.org/register",
      'method: "tools/call"',
      'method: "tools/list"',
      "MCP_OAUTH_ACCESS_TOKEN",
      "MCP_OAUTH_REFRESH_TOKEN",
    ]
  ) excludes(path, source, value);
}

console.log("Phase 7O official MCP OAuth threat-model checks passed.");
