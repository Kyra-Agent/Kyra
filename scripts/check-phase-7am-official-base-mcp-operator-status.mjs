import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

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

const doc = read("docs/phase-7AM-official-base-mcp-operator-status.md");
const statusScript = read("scripts/status-official-base-mcp-readiness.mjs");
const packageJson = read("package.json");
const roadmap = read("docs/product-phase-roadmap.md");
const readiness = read("docs/phase-7AL-official-base-mcp-unblock-readiness.md");
const baseline = JSON.parse(
  read("docs/phase-7R-base-mcp-provider-baseline.json"),
);

for (
  const required of [
    "# Phase 7AM Official Base MCP Operator Status",
    "Status: local operator status command complete. Current decision: blocked.",
    "npm run status:base-mcp",
    "It does not call the network",
    "`decision`: `blocked`",
    "`canStartPhase7DImplementation`: `true`",
    "`canEnableWalletExecution`: `false`",
    "`officialBaseMcpAuthority`: `blocked`",
    "`telegramBoundary`: `read-only`",
    "`npm run check:phase-7am`",
  ]
) {
  assertIncludes("Phase 7AM operator status doc", doc, required);
}

for (
  const forbiddenDocRule of [
    "fetch official provider endpoints",
    "call OAuth registration, authorization, or token endpoints",
    "create PKCE, state, client metadata, tokens, sessions, or secrets",
    "list or invoke official MCP tools",
    "read `process.env`",
    "write files",
  ]
) {
  assertIncludes("Phase 7AM safety rules", doc, forbiddenDocRule);
}

for (
  const forbiddenScriptTerm of [
    "fetch(",
    "XMLHttpRequest",
    "https.request",
    "http.request",
    "process.env",
    "writeFile",
    "appendFile",
    "exec(",
    "spawn(",
    "mcp.base.org/authorize",
    "mcp.base.org/register",
    "mcp.base.org/token",
  ]
) {
  assertNotIncludes("status script", statusScript, forbiddenScriptTerm);
}

assertIncludes(
  "status script",
  statusScript,
  'readJson("docs/phase-7R-base-mcp-provider-baseline.json")',
);
assertIncludes("status script", statusScript, "canStartPhase7DImplementation: true");
assertIncludes("status script", statusScript, "canEnableWalletExecution: false");
assertIncludes("status script", statusScript, 'officialBaseMcpAuthority: "blocked"');
assertIncludes("status script", statusScript, 'telegramBoundary: "read-only"');
assertIncludes("status script", statusScript, "forbiddenUntilGo");
assertIncludes("status script", statusScript, "allowedWork");

assertIncludes("package.json", packageJson, '"status:base-mcp"');
assertIncludes("package.json", packageJson, '"check:phase-7am"');
assertIncludes("package.json", packageJson, "npm run check:phase-7am");
assertIncludes("canonical roadmap", roadmap, "docs/phase-7AL-official-base-mcp-unblock-readiness.md");
assertIncludes("readiness matrix", readiness, "Current decision: blocked.");

assert(
  existsSync(resolve(root, "supabase/functions/official-mcp-oauth-start")),
  "official MCP OAuth start disabled-only skeleton must exist after Phase 7AX.",
);
assert(
  baseline.decision === "blocked",
  "Baseline must remain blocked for the current operator status.",
);

assert(
  baseline.blockers.length >= 6,
  "Baseline must include the current blocker set for operator status.",
);
assert(
  baseline.blockers.includes("protected_resource_metadata_unavailable"),
  "Baseline must keep Protected Resource Metadata unavailable as a blocker.",
);
assert(
  statusScript.includes('"stable Protected Resource Metadata"'),
  "Status script must include missing Protected Resource Metadata evidence.",
);
assert(
  statusScript.includes('"access or refresh token storage"'),
  "Status script must forbid token storage until go.",
);
assert(
  statusScript.includes('"run read-only provider monitor"'),
  "Status script must include safe monitor work.",
);

console.log("Phase 7AM official Base MCP operator status checks passed.");
