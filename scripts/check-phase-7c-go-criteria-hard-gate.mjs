import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

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

function readCodeTree(path) {
  const output = [];

  for (const entry of readdirSync(resolve(root, path))) {
    const relative = join(path, entry).replaceAll("\\", "/");
    const absolute = resolve(root, relative);

    if (statSync(absolute).isDirectory()) {
      output.push(...readCodeTree(relative));
    } else if ([".ts", ".tsx", ".js", ".mjs"].includes(extname(entry))) {
      output.push({ path: relative, source: read(relative) });
    }
  }

  return output;
}

const doc = read("docs/phase-7C-go-criteria-hard-gate.md");
const roadmap = read("docs/product-phase-roadmap.md");
const audit = read("docs/phase-7C-official-base-mcp-provider-contract-audit.md");
const readiness = read("docs/phase-7AL-official-base-mcp-unblock-readiness.md");
const decision = read("docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md");
const packageJson = read("package.json");
const baseline = JSON.parse(read("docs/phase-7R-base-mcp-provider-baseline.json"));
const appConfig = read("src/config/appConfig.ts");
const frontendEnv = read(".env.example");
const functionEnv = read("supabase/functions/.env.example");
const config = read("supabase/config.toml");
const schema = read("supabase/schema.sql");

for (
  const expected of [
    "# Phase 7C GO Criteria Hard Gate",
    "Status: hard gate complete. Current decision remains NO-GO.",
    "`decision`: `blocked`",
    "`baselineMatch`: `true`",
    "protected resource metadata: unavailable",
    "advertised scopes: `agent_wallet:transact`, `agent_wallet:escalate`",
    "Stable protected resource metadata exists.",
    "Exact resource/audience identifier is verified.",
    "Exact non-escalating least-privilege scope is known.",
    "Exact scope-to-tool mapping is verified outside untrusted tool text.",
    "Owner explicitly approves the transition from Phase 7C to Phase 7D.",
    "protected resource metadata is unavailable",
    "only wallet-authority scopes are available",
    "official Base MCP OAuth start",
    "access-token or refresh-token storage",
    "Base Account connection prompt",
    "npm run check:phase-7c-hard-gate",
  ]
) {
  includes("Phase 7C hard gate", doc, expected);
}

for (
  const forbidden of [
    "Status: GO",
    "Current decision is GO",
    "runtime approved",
    "OAuth enabled",
    "token storage enabled",
    "wallet prompt enabled",
    "transaction submission enabled",
  ]
) {
  excludes("Phase 7C hard gate", doc, forbidden);
}

includes("roadmap", roadmap, "Phase 7D foundation is clear.");
includes("roadmap", roadmap, "Phase 7E runtime OAuth and token work must not begin yet.");
includes("roadmap", roadmap, "Do not start the next runtime phase until the roadmap, Phase 7C audit");
includes("official audit", audit, "No-go for Phase 7D wallet/Base MCP implementation.");
includes("readiness", readiness, "Any missing required evidence keeps the result blocked.");
includes("decision packet", decision, "Decision: **NO-GO**.");
includes("package.json", packageJson, "\"check:phase-7c-hard-gate\"");
includes("package.json", packageJson, "npm run check:phase-7c-hard-gate");
includes("app config", appConfig, 'walletExecution: "disabled"');

assert(baseline.decision === "blocked", "Provider baseline must remain blocked.");
assert(
  baseline.protectedResources.root.available === false &&
    baseline.protectedResources.mcpPath.available === false,
  "Protected resource metadata must remain unavailable in the current baseline.",
);
assert(
  baseline.mcpChallenge.resourceMetadata === null &&
    Array.isArray(baseline.mcpChallenge.scopes) &&
    baseline.mcpChallenge.scopes.length === 0,
  "Current MCP challenge baseline must not contain resource metadata or scopes.",
);
for (const scope of ["agent_wallet:transact", "agent_wallet:escalate"]) {
  assert(
    baseline.authorization.scopes.includes(scope),
    `Current baseline must still advertise ${scope}.`,
  );
}

for (
  const [label, source] of [
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
      "MCP_TOOL_ALLOWLIST",
      "AGENT_WALLET_TRANSACT",
      "AGENT_WALLET_ESCALATE",
    ]
  ) {
    excludes(label, source, forbidden);
  }
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
  excludes(route, routeSource, "mcp.base.org/authorize");
  excludes(route, routeSource, "mcp.base.org/register");
  excludes(route, routeSource, "agent_wallet:transact");
  excludes(route, routeSource, "agent_wallet:escalate");
  excludes(route, routeSource, "_request.json");
  excludes(route, routeSource, "new URL(_request.url");
  excludes("supabase/config.toml", config, `[functions.${route}]`);
}

for (
  const forbiddenPath of [
    "supabase/functions/official-mcp-token-store",
    "supabase/functions/official-mcp-tools",
    "supabase/functions/official-mcp-session",
  ]
) {
  assert(!existsSync(resolve(root, forbiddenPath)), `${forbiddenPath} must remain absent.`);
}

excludes("schema", schema, "official_mcp_credentials");
excludes("schema", schema, "official_mcp_oauth_transactions");
excludes("schema", schema, "official_mcp_wallet_authority_bindings");

for (const { path, source } of [...readCodeTree("src"), ...readCodeTree("supabase/functions")]) {
  for (
    const forbidden of [
      "OFFICIAL_BASE_MCP_ACCESS_TOKEN",
      "OFFICIAL_BASE_MCP_REFRESH_TOKEN",
      "createOfficialMcpSession",
      "listOfficialMcpTools",
      "invokeOfficialMcpTool",
      "wallet_sendCalls",
      "eth_sendTransaction",
    ]
  ) {
    excludes(path, source, forbidden);
  }
}

console.log("Phase 7C GO criteria hard gate checks passed.");
