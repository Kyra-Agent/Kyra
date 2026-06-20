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

const doc = read("docs/phase-7Q-official-mcp-scope-consent-qualification.md");
const runtime = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const frontendEnv = read(".env.example");
const functionEnv = read("supabase/functions/.env.example");
const frontendCode = readCodeTree("src");
const functionCode = readCodeTree("supabase/functions");

for (
  const value of [
    "Status: scope qualification complete locally",
    "## Scope Selection Hazard",
    "omit the scope parameter",
    "Protected Resource Metadata is unavailable",
    "## Qualification Matrix",
    "`agent_wallet:transact`",
    "`agent_wallet:escalate`",
    "Hypothetical read-only scope",
    "No scope is eligible",
    "## Capability Risk Classification",
    "### Message Signing",
    "### Arbitrary Contract Calls And Plugins",
    "### x402 Payments",
    "## Provider Approval Is Necessary But Not Sufficient",
    "## Minimum Consent Contract",
    "## Re-Consent Triggers",
    "## Required Provider Contract Before Reconsideration",
    "Phase 7R should define the provider qualification evidence contract",
  ]
) includes("Phase 7Q qualification", doc, value);

includes(
  "custom runtime",
  runtime,
  'url.hostname.toLowerCase() === "mcp.base.org"',
);

assert(
  existsSync(resolve(root, "supabase/functions/official-mcp-oauth-start")),
  "official MCP OAuth start disabled-only skeleton must exist after Phase 7AX",
);
assert(
  existsSync(resolve(root, "supabase/functions/official-mcp-oauth-callback")),
  "official MCP OAuth callback disabled-only skeleton must exist after Phase 7AX",
);

for (
  const [name, source] of [
    ["frontend environment", frontendEnv],
    ["function environment", functionEnv],
  ]
) {
  for (
    const value of [
      "MCP_OAUTH_SCOPE",
      "MCP_OAUTH_SCOPES",
      "MCP_OAUTH_ACCESS_TOKEN",
      "MCP_OAUTH_REFRESH_TOKEN",
    ]
  ) excludes(name, source, value);
}

for (const { path, source } of [...frontendCode, ...functionCode]) {
  for (
    const value of [
      "agent_wallet:transact",
      "agent_wallet:escalate",
      "mcp.base.org/authorize",
      "official-mcp-oauth-start",
      "official-mcp-oauth-callback",
    ]
  ) excludes(path, source, value);
}

console.log("Phase 7Q official MCP scope and consent checks passed.");
