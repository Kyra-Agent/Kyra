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

const doc = read("docs/phase-7AL-official-base-mcp-unblock-readiness.md");
const roadmap = read("docs/product-phase-roadmap.md");
const transitionGate = read("docs/phase-7AK-official-base-mcp-transition-gate.md");
const officialAudit = read(
  "docs/phase-7C-official-base-mcp-provider-contract-audit.md",
);
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
    "# Phase 7AL Official Base MCP Unblock Readiness",
    "Status: readiness matrix complete. Current decision: blocked.",
    "Define the exact evidence Kyra needs before Phase 7C can change from no-go",
    "## Unblock Matrix",
    "## Minimum Go Packet",
    "## Hard No-Go Conditions",
    "Known issuer and OAuth endpoints do not authorize implementation by themselves.",
    "`npm run check:phase-7al`",
    "`npm run check:phase-7`",
  ]
) {
  assertIncludes("Phase 7AL readiness", doc, required);
}

for (
  const matrixRow of [
    "| Protected Resource Metadata | unavailable at tested standard locations | stable metadata URL and response |",
    "| Resource identifier | not verified | exact resource/audience value |",
    "| Non-escalating scope | not advertised or verified | exact scope string with bounded authority |",
    "| Scope-to-tool mapping | not verified | published or otherwise verifiable mapping |",
    "| Tool IDs | not snapshotted | exact tool IDs for first allowed capability |",
    "| Tool schemas | not snapshotted | schema versions or deterministic schema snapshot |",
    "| Approval-link behavior | not verified | owner/action/chain/value/expiry/replay binding |",
    "| Token lifecycle | not verified | expiry, refresh, rotation, revocation, disconnect |",
  ]
) {
  assertIncludes("Phase 7AL matrix", doc, matrixRow);
}

for (
  const goRequirement of [
    "protected resource metadata capture with no secrets",
    "exact requested scope and why it is least privilege",
    "exact tools, schemas, chains, assets, and limits",
    "clear statement that Telegram cannot authorize or execute",
    "token storage and revocation design",
    "explicit owner approval for official hosted MCP activation",
  ]
) {
  assertIncludes("Phase 7AL minimum go packet", doc, goRequirement);
}

for (
  const noGo of [
    "protected resource metadata is still unavailable",
    "only `agent_wallet:transact` and `agent_wallet:escalate` are available",
    "scope omission or fallback is required",
    "read-only capability requires a wallet-authority scope",
    "approval-link binding, expiry, or replay behavior is unknown",
    "token refresh or revocation behavior is unknown",
    "Telegram, public routes, LLM output, page load, or background jobs can start",
  ]
) {
  assertIncludes("Phase 7AL hard no-go", doc, noGo);
}

for (
  const roadmapMarker of [
    "Status: blocked by currently verified provider metadata and scope ambiguity.",
    "Phase 7D primary Base Account runtime may proceed through its own gates.",
    "This gate keeps official MCP OAuth, token storage, authenticated sessions",
  ]
) {
  assertIncludes("canonical roadmap", roadmap, roadmapMarker);
}

for (
  const transitionMarker of [
    "# Phase 7AK Official Base MCP Transition Gate",
    "Current decision: blocked.",
    "protected resource metadata is available and stable",
    "exact scope-to-tool mapping is verified",
  ]
) {
  assertIncludes("Phase 7AK transition gate", transitionGate, transitionMarker);
}

for (
  const auditMarker of [
    "protected resource metadata with a resource identifier",
    "exact scope-to-tool mapping",
    "a non-escalating read-only scope",
    "No-go for the official hosted Base MCP adapter implementation.",
  ]
) {
  assertIncludes("Phase 7C official audit", officialAudit, auditMarker);
}

assert(baseline.decision === "blocked", "Phase 7R baseline decision must remain blocked.");
for (
  const blocker of [
    "protected_resource_metadata_unavailable",
    "wallet_authority_scopes_advertised",
    "scope_to_tool_mapping_unverified",
    "escalation_semantics_unverified",
    "mcp_challenge_resource_metadata_missing",
    "mcp_challenge_scope_missing",
  ]
) {
  assert(
    baseline.blockers.includes(blocker),
    `Phase 7R baseline must include blocker: ${blocker}`,
  );
}

assertIncludes("package.json", packageJson, '"check:phase-7al"');
assertIncludes("package.json", packageJson, "npm run check:phase-7al");

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
      "MCP_TOOL_ALLOWLIST",
      "MCP_OAUTH_SCOPE",
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
for (
  const forbiddenPath of [
    "supabase/functions/official-mcp-token-store",
    "supabase/functions/official-mcp-tools",
  ]
) {
  assert(
    !existsSync(resolve(root, forbiddenPath)),
    `${forbiddenPath} must remain absent.`,
  );
}

for (const { path, source } of [...frontendCode, ...functionCode]) {
  for (
    const forbidden of [
      "agent_wallet:transact",
      "agent_wallet:escalate",
      "mcp.base.org/authorize",
      "mcp.base.org/register",
      "OFFICIAL_BASE_MCP_ACCESS_TOKEN",
      "OFFICIAL_BASE_MCP_REFRESH_TOKEN",
      "MCP_TOOL_ALLOWLIST",
      "createOfficialMcpSession",
      "listOfficialMcpTools",
      "invokeOfficialMcpTool",
    ]
  ) {
    assertNotIncludes(path, source, forbidden);
  }
}

console.log("Phase 7AL official Base MCP unblock readiness checks passed.");
