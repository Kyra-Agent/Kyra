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

const snapshot = read("docs/product-readiness-snapshot.md");
const readme = read("README.md");
const packageJson = read("package.json");

for (const expected of [
  "# Product Readiness Snapshot",
  "Robinhood Chain public cutover candidate",
  "not a new phase",
  "## Release Decision",
  "## Verified Migration Evidence",
  "## Product Surface Matrix",
  "## Required Release Checks",
  "## Transaction Release Gate",
  "## Privacy And Security Requirements",
  "User wallet authority and Telegram bot-token privacy are priority one.",
]) {
  includes("product readiness snapshot", snapshot, expected);
}

for (const expected of [
  "account-scoped sign-in and persistence",
  "template-based agent deployment",
  "private account workspaces",
  "shareable public agent profiles",
  "Telegram read-only commands and planning",
  "backend-only LLM enrichment",
  "Robinhood Chain EVM wallet connect and disconnect",
  "managed mainnet read-only provider lane",
]) {
  includes("snapshot ready scope", snapshot, expected);
}

for (const expected of [
  "real mainnet transaction submission",
  "token approvals, swaps, bridges, and arbitrary calldata",
  "Telegram or public-profile transaction submission",
  "autonomous retries or fund movement",
]) {
  includes("snapshot controlled scope", snapshot, expected);
}

for (const expected of [
  "`npm run build:robinhood-mainnet`",
  "`npm run check:robinhood-migration`",
  "`npm run check:phase-8-all`",
  "`npm run check:privacy`",
  "`npm audit --audit-level=high`",
  "`git diff --check`",
  "Secret scan",
]) {
  includes("snapshot verification", snapshot, expected);
}

for (const expected of [
  "seed phrases or private keys",
  "Telegram bot tokens",
  "LLM API keys",
  "Supabase service-role values",
  "managed RPC credentials",
  "raw session tokens or provider payloads",
]) {
  includes("snapshot privacy list", snapshot, expected);
}

includes("README snapshot link", readme, "docs/product-readiness-snapshot.md");
includes("package.json", packageJson, '"check:product-snapshot"');

for (const forbidden of [
  "transactions are publicly live",
  "Telegram submits transactions directly",
  "seed phrase collection",
  "private key custody",
]) {
  excludes("product readiness snapshot", snapshot, forbidden);
}

console.log("Product readiness snapshot checks passed.");
