import { readFileSync } from "node:fs";

const blueprint = readFileSync(
  "docs/robinhood-chain-migration-blueprint.md",
  "utf8",
);
const roadmap = readFileSync("docs/product-phase-roadmap.md", "utf8");
const snapshot = readFileSync("docs/product-readiness-snapshot.md", "utf8");

for (const expected of [
  "# Robinhood Chain Migration Blueprint",
  "Runtime cutover has not",
  "Chain ID | `4663`",
  "Hex chain ID | `0x1237`",
  "testnet `eth_chainId` returned `0xb626`",
  "Public RPC endpoints are rate-limited",
  "does not document an official Robinhood MCP",
  "service equivalent to the former Base MCP lane.",
  "The user's EVM wallet remains the signing and submission authority.",
  "No chain ID, RPC URL, or explorer URL may remain duplicated",
  "no provider API key in Vite variables",
  "Historical Base records remain immutable historical evidence.",
  "User wallet authority and Telegram bot-token privacy remain priority one.",
  "Public wording must not imply Robinhood affiliation",
  "removed the direct `@base-org/account` package",
  "now returns zero vulnerabilities",
  "### Batch 1 - Evidence and architecture",
  "Status: locally complete and verified; not deployed",
  "currentProductChain` remains Base",
  "npm run check:chain-abstraction",
  "### Batch 3 - Wallet migration",
  "EIP-1193 injected connector with EIP-6963",
  "npm run check:owner-wallet-migration",
  "### Batch 6 - Controlled mainnet cutover",
  "## Cutover Gates",
  "## Rollback",
]) {
  includes("migration blueprint", blueprint, expected);
}

for (const url of [
  "https://docs.robinhood.com/chain/connecting/",
  "https://docs.robinhood.com/chain/add-network-to-wallet/",
  "https://status.robinhoodchain.offchain.io/",
]) {
  includes("official migration source", blueprint, url);
}

for (const expected of [
  "Active release track: Robinhood Chain migration.",
  "does not create Phase 11",
  "release batches, not additional phases",
  "docs/robinhood-chain-migration-blueprint.md",
]) {
  includes("canonical roadmap migration state", roadmap, expected);
}

for (const expected of [
  "## Active Migration Notice",
  "Robinhood Chain is not yet an",
  "advertised live Kyra transaction lane.",
  "docs/robinhood-chain-migration-blueprint.md",
]) {
  includes("product snapshot migration state", snapshot, expected);
}

for (const forbidden of [
  "Robinhood MCP is live",
  "Robinhood Chain execution is live",
  "Kyra is endorsed by Robinhood",
  "private key required for Kyra",
  "seed phrase required for Kyra",
  "public RPC is approved for production",
]) {
  excludes("migration documents", `${blueprint}\n${roadmap}\n${snapshot}`, forbidden);
}

console.log("Robinhood Chain migration blueprint checks passed.");

function includes(label, source, expected) {
  if (!source.includes(expected)) {
    throw new Error(`${label} missing expected text: ${expected}`);
  }
}

function excludes(label, source, forbidden) {
  if (source.includes(forbidden)) {
    throw new Error(`${label} contains forbidden text: ${forbidden}`);
  }
}
