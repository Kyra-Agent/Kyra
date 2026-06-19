import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (name, source, value) =>
  assert(source.includes(value), `${name} must include: ${value}`);
const excludes = (name, source, value) =>
  assert(!source.includes(value), `${name} must not include: ${value}`);

const doc = read("docs/phase-7R-provider-evidence-monitor.md");
const monitor = read("scripts/observe-base-mcp-provider.mjs");
const test = read("scripts/test-phase-7r-provider-monitor.mjs");
const baseline = JSON.parse(
  read("docs/phase-7R-base-mcp-provider-baseline.json"),
);
const packageJson = read("package.json");

for (
  const value of [
    "Status: local read-only monitor complete.",
    "## Fixed Public Sources",
    "## Network Contract",
    "No redirect following.",
    "No calls to `/authorize`, `/register`, `/token`",
    "## Sanitized Report",
    "## Baseline Decision",
    "## Drift Behavior",
    "exits `2` when evidence changes",
    "## Baseline Update Procedure",
  ]
) includes("Phase 7R monitor doc", doc, value);

for (
  const value of [
    'method: "GET"',
    'redirect: "manual"',
    'credentials: "omit"',
    "forbiddenPaths",
    "readBoundedResponseBody",
    "response_too_large",
    "compareProviderEvidence",
    "process.exitCode = comparison.matches ? 0 : 2",
  ]
) includes("provider monitor", monitor, value);

for (
  const forbidden of [
    'method: "POST"',
    "Authorization:",
    "Cookie:",
    "writeFile",
    "localStorage",
    "sessionStorage",
    "Deno.env.set",
  ]
) excludes("provider monitor", monitor, forbidden);

for (
  const value of [
    "Monitor must use GET only.",
    "Monitor must not send authorization or cookie headers.",
    "Monitor must never call a sensitive OAuth endpoint.",
    "Redirects must fail closed",
    "Oversized metadata must fail closed.",
    "Scope drift must be detected.",
  ]
) includes("provider monitor tests", test, value);

assert(baseline.version === 1, "Baseline version must remain 1.");
assert(
  baseline.decision === "blocked",
  "Baseline decision must remain blocked.",
);
assert(
  baseline.authorization.scopes.includes("agent_wallet:transact") &&
    baseline.authorization.scopes.includes("agent_wallet:escalate"),
  "Baseline must preserve both rejected wallet-authority scopes.",
);
assert(
  baseline.protectedResources.root.available === false &&
    baseline.protectedResources.mcpPath.available === false,
  "Baseline must preserve unavailable protected resource metadata.",
);

for (
  const value of [
    '"observe:base-mcp-provider"',
    '"test:phase-7r"',
    '"check:phase-7r"',
  ]
) includes("package scripts", packageJson, value);

console.log("Phase 7R provider evidence monitor checks passed.");
