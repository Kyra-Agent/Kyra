import { readFileSync } from "node:fs";
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

const doc = read(
  "docs/phase-7AN-production-ui-and-base-mcp-evidence-refresh.md",
);
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const baseline = JSON.parse(
  read("docs/phase-7R-base-mcp-provider-baseline.json"),
);

for (
  const expected of [
    "# Phase 7AN Production UI And Base MCP Evidence Refresh",
    "Status: production audit complete. Current official Base MCP decision: blocked.",
    "https://kyraagent.xyz",
    "`/dashboard` | pass | pass",
    "Official Base MCP wallet authority",
    "npm run observe:base-mcp-provider",
    "2026-06-20T10:04:36.669Z",
    "`decision`: `blocked`",
    "`baselineMatch`: `true`",
    "`changes`: `[]`",
    "protected_resource_metadata_unavailable",
    "wallet_authority_scopes_advertised",
    "scope_to_tool_mapping_unverified",
    "mcp_challenge_resource_metadata_missing",
    "Keep Phase 7C blocked.",
    "Forbidden until a go decision:",
    "access token or refresh token storage",
    "wallet signing",
    "transaction submission",
    "npm run check:phase-7an",
  ]
) {
  includes("Phase 7AN audit doc", doc, expected);
}

for (
  const forbidden of [
    "Status: live execution",
    "Phase 7C complete",
    "Base Account prompt enabled",
    "OAuth start implemented",
    "token storage implemented",
    "transaction submission enabled",
  ]
) {
  excludes("Phase 7AN audit doc", doc, forbidden);
}

includes("package.json", packageJson, '"check:phase-7an"');
includes("package.json", packageJson, "npm run check:phase-7an");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AN-production-ui-and-base-mcp-evidence-refresh.md",
);
includes(
  "private context",
  context,
  "The primary product target is Robinhood Chain mainnet, chain ID `4663`.",
);
includes(
  "private context",
  context,
  "Mainnet transaction submission is still release-gated.",
);

assert(
  baseline.decision === "blocked",
  "Provider baseline decision must remain blocked.",
);
assert(
  baseline.blockers.includes("protected_resource_metadata_unavailable"),
  "Baseline must keep protected resource metadata unavailable.",
);
assert(
  baseline.blockers.includes("scope_to_tool_mapping_unverified"),
  "Baseline must keep scope-to-tool mapping unverified.",
);
assert(
  baseline.authorization.scopes.includes("agent_wallet:transact") &&
    baseline.authorization.scopes.includes("agent_wallet:escalate"),
  "Baseline must keep the current wallet-authority scopes.",
);

console.log(
  "Phase 7AN production UI and Base MCP evidence refresh checks passed.",
);
