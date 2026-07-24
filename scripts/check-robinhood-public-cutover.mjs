import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(label, source, expected) {
  if (!source.includes(expected)) throw new Error(`${label} missing: ${expected}`);
}

function excludes(label, source, forbidden) {
  if (source.includes(forbidden)) throw new Error(`${label} contains stale copy: ${forbidden}`);
}

const netlify = read("netlify.toml");
const packageJson = read("package.json");
const index = read("index.html");
const readme = read("README.md");
const ogCard = read("public/og-card.svg");
const app = read("src/App.tsx");
const chains = read("src/config/productChains.ts");
const envExample = read(".env.example");
const context = read("docs/kyra-agent-context.md");
const snapshot = read("docs/product-readiness-snapshot.md");
const runbook = read("docs/robinhood-mainnet-cutover-runbook.md");

includes("Netlify", netlify, 'command = "npm run build:robinhood-mainnet"');
includes("Netlify CSP", netlify, "https://rpc.mainnet.chain.robinhood.com");
includes("package description", packageJson, "Robinhood Chain AI agent platform");
includes("package keyword", packageJson, '"robinhood-chain"');
includes("metadata", index, "Kyra Agent | Robinhood Chain AI Agents");
includes("README", readme, "## Robinhood Chain Boundary");
includes("OG card", ogCard, "AI agents for Robinhood Chain");
includes("app banner", app, "explicit user and wallet approval");

for (const expected of [
  'selection.mode === "robinhood-mainnet"',
  'selection.requestedTarget === "robinhood_mainnet"',
  'selection.mainnetWindow === "owner_mainnet_cutover"',
  'selection.releaseApproval === "owner_release_approved"',
]) {
  includes("runtime selector", chains, expected);
}

for (const expected of [
  "VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION=disabled",
  "VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION=disabled",
]) {
  includes("fail-closed defaults", envExample, expected);
}

for (const source of [context, snapshot, runbook]) {
  includes("current docs", source, "Robinhood Chain");
  includes("current docs", source, "transaction submission");
}

for (const [label, source] of [
  ["index", index],
  ["README", readme],
  ["OG card", ogCard],
]) {
  for (const forbidden of ["Base-native", "Base Account", "Base MCP", "agents for Base"]) {
    excludes(label, source, forbidden);
  }
}

for (const forbidden of [
  "Robinhood Chain execution is live",
  "Robinhood Chain transactions are publicly live.",
  "autonomous fund movement is enabled",
  "Kyra is endorsed by Robinhood",
]) {
  excludes("public cutover sources", `${readme}\n${context}\n${snapshot}\n${runbook}`, forbidden);
}

console.log("Robinhood public cutover checks passed.");