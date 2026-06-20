import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertIncludes(name, source, value) {
  assert(source.includes(value), `${name} must include: ${value}`);
}

function assertNotIncludes(name, source, value) {
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

const gate = read("docs/phase-7AK-official-base-mcp-transition-gate.md");
const roadmap = read("docs/product-phase-roadmap.md");
const officialAudit = read(
  "docs/phase-7C-official-base-mcp-provider-contract-audit.md",
);
const monitorDoc = read("docs/phase-7R-provider-evidence-monitor.md");
const baseline = JSON.parse(
  read("docs/phase-7R-base-mcp-provider-baseline.json"),
);
const packageJson = read("package.json");
const frontendEnv = read(".env.example");
const functionEnv = read("supabase/functions/.env.example");
const frontendCode = readCodeTree("src");
const functionCode = readCodeTree("supabase/functions");

for (
  const required of [
    "# Phase 7AK Official Base MCP Transition Gate",
    "Status: local transition gate complete. Current decision: blocked.",
    "prevents Kyra from moving from Phase 7C monitoring into Base Account",
    "absence of least-privilege evidence is a",
    "## Blocked Until",
    "## Transition Rules",
    "## Allowed Work",
    "User wallet security and user Telegram bot token security remain the highest",
    "`npm run check:phase-7ak`",
    "`npm run check:phase-7`",
  ]
) {
  assertIncludes("Phase 7AK transition gate", gate, required);
}

for (
  const blocked of [
    "do not open `https://mcp.base.org/authorize`",
    "do not call `https://mcp.base.org/register`",
    "do not request `agent_wallet:transact`",
    "do not request `agent_wallet:escalate`",
    "do not request omitted or fallback scopes",
    "do not create OAuth client metadata",
    "do not create PKCE or state for official Base MCP",
    "do not store official MCP access or refresh tokens",
    "do not initialize an authenticated official MCP session",
    "do not list official MCP tools",
    "do not invoke official MCP tools",
    "do not create official provider approval links",
  ]
) {
  assertIncludes("Phase 7AK blocked transition rule", gate, blocked);
}

for (
  const roadmapMarker of [
    "### 7C - Official Base MCP Provider Contract",
    "Status: blocked by currently verified provider metadata and scope ambiguity.",
    "### 7D - Base Account Connection Per Deployed Agent",
    "Only after a go decision, implement Base Account connection and OAuth",
  ]
) {
  assertIncludes("canonical roadmap", roadmap, roadmapMarker);
}

for (
  const auditMarker of [
    "Status: no-go for live wallet authority",
    "No-go for Phase 7D wallet/Base MCP implementation.",
    "monitor official provider metadata, unauthenticated `/mcp` challenge",
    "Exact non-escalating scope candidate is known.",
  ]
) {
  assertIncludes("Phase 7C official audit", officialAudit, auditMarker);
}

for (
  const monitorMarker of [
    "## Current Live Observation",
    "baseline match: true",
    "decision: blocked",
    "`/mcp` challenge: bearer realm `mcp`, no `resource_metadata`, no scope",
  ]
) {
  assertIncludes("Phase 7R provider monitor", monitorDoc, monitorMarker);
}

assert(baseline.decision === "blocked", "Phase 7R baseline decision must remain blocked.");
assert(
  baseline.mcpChallenge?.available === true,
  "Phase 7R baseline must preserve the unauthenticated MCP challenge.",
);
assert(
  baseline.mcpChallenge?.bearerRealm === "mcp",
  "Phase 7R baseline must preserve the MCP bearer realm.",
);
assert(
  baseline.mcpChallenge?.resourceMetadata === null,
  "Phase 7R baseline must preserve missing resource metadata.",
);
assert(
  Array.isArray(baseline.mcpChallenge?.scopes) &&
    baseline.mcpChallenge.scopes.length === 0,
  "Phase 7R baseline must preserve missing scope guidance.",
);

assertIncludes("package.json", packageJson, '"check:phase-7ak"');
assertIncludes("package.json", packageJson, "npm run check:phase-7ak");

for (
  const [name, source] of [
    [".env.example", frontendEnv],
    ["supabase/functions/.env.example", functionEnv],
  ]
) {
  for (
    const forbidden of [
      "OFFICIAL_BASE_MCP_ENABLED",
      "OFFICIAL_BASE_MCP_CLIENT_ID",
      "OFFICIAL_BASE_MCP_ACCESS_TOKEN",
      "OFFICIAL_BASE_MCP_REFRESH_TOKEN",
      "MCP_OAUTH_SCOPE",
      "MCP_OAUTH_SCOPES",
      "AGENT_WALLET_TRANSACT",
      "AGENT_WALLET_ESCALATE",
    ]
  ) {
    assertNotIncludes(name, source, forbidden);
  }
}

for (
  const requiredPath of [
    "supabase/functions/official-mcp-oauth-start",
    "supabase/functions/official-mcp-oauth-callback",
  ]
) {
  assert(
    existsSync(resolve(root, requiredPath)),
    `${requiredPath} disabled-only skeleton must exist after Phase 7AX.`,
  );
}
assert(
  !existsSync(resolve(root, "supabase/functions/official-base-mcp-tools")),
  "Official Base MCP tools function must remain absent.",
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
      "OFFICIAL_BASE_MCP_ACCESS_TOKEN",
      "OFFICIAL_BASE_MCP_REFRESH_TOKEN",
    ]
  ) {
    assertNotIncludes(path, source, forbidden);
  }
}

console.log("Phase 7AK official Base MCP transition gate checks passed.");
