import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}
function includes(label, source, expected) {
  if (!source.includes(expected)) throw new Error(`${label} missing expected text: ${expected}`);
}
function excludes(label, source, forbidden) {
  if (source.includes(forbidden)) throw new Error(`${label} contains forbidden text: ${forbidden}`);
}

const blueprint = read("docs/robinhood-chain-migration-blueprint.md");
const roadmap = read("docs/product-phase-roadmap.md");
const snapshot = read("docs/product-readiness-snapshot.md");

for (const expected of [
  "# Robinhood Chain Migration Blueprint",
  "public Robinhood Chain cutover candidate",
  "Chain ID | `4663`",
  "Hex chain ID | `0x1237`",
  "testnet `eth_chainId` returned `0xb626`",
  "Public RPC endpoints are rate-limited",
  "does not document an official Robinhood MCP",
  "The user's EVM wallet remains the signing and submission authority.",
  "Historical Base records remain immutable historical evidence.",
  "User wallet authority and Telegram bot-token privacy remain priority one.",
  "Public wording must not imply Robinhood affiliation",
  "### Batch 1 - Evidence and architecture",
  "### Batch 3 - Wallet migration",
  "### Batch 4 - Backend and provider migration",
  "Owner-confirmed manual evidence on 2026-07-23:",
  "### Batch 6 - Controlled mainnet cutover",
  "normal user-account deployment",
  "One bounded mainnet receipt",
  "## Cutover Gates",
  "## Rollback",
]) includes("migration blueprint", blueprint, expected);

for (const url of [
  "https://docs.robinhood.com/chain/connecting/",
  "https://docs.robinhood.com/chain/add-network-to-wallet/",
  "https://status.robinhoodchain.offchain.io/",
]) includes("official migration source", blueprint, url);

for (const expected of [
  "Active release track: Robinhood Chain migration.",
  "does not create Phase 11",
  "public product build now targets Robinhood Chain",
  "legacy rollback and historical compatibility lane",
  "docs/robinhood-chain-migration-blueprint.md",
]) includes("canonical roadmap migration state", roadmap, expected);

for (const expected of [
  "Robinhood Chain public cutover candidate",
  "normal user-account mainnet agent deployment",
  "Base is retained only as an explicit legacy rollback",
  "Transaction Release Gate",
]) includes("product snapshot migration state", snapshot, expected);

for (const forbidden of [
  "Robinhood MCP is live",
  "Robinhood Chain execution is live",
  "Kyra is endorsed by Robinhood",
  "private key required for Kyra",
  "seed phrase required for Kyra",
  "public RPC is approved for production",
]) excludes("migration documents", `${blueprint}\n${roadmap}\n${snapshot}`, forbidden);

console.log("Robinhood Chain migration blueprint checks passed.");
