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

const doc = read(
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const context = read("docs/kyra-agent-context.md");
const baseline = JSON.parse(
  read("docs/phase-7R-base-mcp-provider-baseline.json"),
);
const unblock = read("docs/phase-7AL-official-base-mcp-unblock-readiness.md");
const refresh = read(
  "docs/phase-7AN-production-ui-and-base-mcp-evidence-refresh.md",
);

for (
  const expected of [
    "# Phase 7AO Official Base MCP Go/No-Go Decision Packet",
    "Status: decision packet complete. Current decision: NO-GO for the official",
    "Decision: **NO-GO**.",
    "The official hosted MCP adapter must not start.",
    "Official Base MCP OAuth must not start.",
    "Official MCP tokens must not be requested or stored.",
    "Official MCP tools must not be listed or invoked.",
    "Wallet prompts, signing, and transactions remain disabled by their separate",
    "2026-06-20T10:04:36.669Z",
    "2026-06-20T10:11:20.655Z",
    "baseline match: `true`",
    "changes: `[]`",
    "protected resource metadata unavailable",
    "Broad wallet-authority scopes are not acceptable",
    "Required GO Conditions",
    "Exact least-privilege non-escalating scope is identified.",
    "Exact scope-to-tool mapping is verified.",
    "Owner explicitly approves enabling the official hosted MCP adapter.",
    "A future GO decision opens only official MCP adapter preparation.",
    "It does not automatically authorize:",
    "Forbidden Work While NO-GO",
    "access token or refresh token storage",
    "official MCP tool invocation",
    "npm run check:phase-7ao",
  ]
) {
  includes("Phase 7AO decision packet", doc, expected);
}

for (
  const forbidden of [
    "Decision: **GO**",
    "Phase 7D may start now",
    "OAuth is implemented",
    "token storage is implemented",
    "wallet prompt is enabled",
    "transaction submission is enabled",
  ]
) {
  excludes("Phase 7AO decision packet", doc, forbidden);
}

includes("package.json", packageJson, '"check:phase-7ao"');
includes("package.json", packageJson, "npm run check:phase-7ao");
includes(
  "canonical roadmap",
  roadmap,
  "docs/phase-7AO-official-base-mcp-go-no-go-decision-packet.md",
);
includes(
  "private context",
  context,
  "Supporting readiness packets are evidence under Phase 7",
);
includes("unblock matrix", unblock, "Hard No-Go Conditions");
includes("evidence refresh", refresh, "Keep Phase 7C blocked.");

assert(
  baseline.decision === "blocked",
  "Baseline decision must remain blocked for NO-GO packet.",
);
assert(
  baseline.blockers.includes("protected_resource_metadata_unavailable"),
  "NO-GO packet requires protected resource metadata blocker.",
);
assert(
  baseline.blockers.includes("wallet_authority_scopes_advertised"),
  "NO-GO packet requires wallet-authority scope blocker.",
);
assert(
  baseline.blockers.includes("scope_to_tool_mapping_unverified"),
  "NO-GO packet requires scope-to-tool mapping blocker.",
);
assert(
  existsSync(resolve(root, "supabase/functions/official-mcp-oauth-start")),
  "Official MCP OAuth start disabled-only skeleton must exist after Phase 7AX.",
);
assert(
  existsSync(resolve(root, "supabase/functions/official-mcp-oauth-callback")),
  "Official MCP OAuth callback disabled-only skeleton must exist after Phase 7AX.",
);

console.log("Phase 7AO official Base MCP go/no-go checks passed.");
