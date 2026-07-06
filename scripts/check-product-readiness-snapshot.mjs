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
const phase10 = read("docs/phase-10-product-release-readiness.md");
const closeout = read("docs/phase-10E-release-decision-closeout.md");
const packageJson = read("package.json");

for (const expected of [
  "# Product Readiness Snapshot",
  "Status: product-ready snapshot for Kyra Agent.",
  "not a new product phase",
  "## Snapshot Decision",
  "ready for public product review and controlled owner use",
  "not automatic public transaction enablement",
  "## Product Surface Matrix",
  "## Verification Snapshot",
  "## Manual Product Smoke",
  "## Privacy And Security Requirements",
  "## Release Gate",
  "User wallet authority and Telegram bot-token privacy remain priority one.",
]) {
  includes("product readiness snapshot", snapshot, expected);
}

for (const expected of [
  "Base-native AI agent positioning",
  "Account-scoped agent deployment",
  "Private dashboard workspace views",
  "Shareable public agent profiles",
  "Telegram-native read-only agent commands",
  "Backend-only LLM planning enrichment",
  "Base Account connection and disconnect",
  "Controlled owner execution architecture",
]) {
  includes("snapshot ready scope", snapshot, expected);
}

for (const expected of [
  "public transaction execution",
  "Telegram transaction submission",
  "public profile transaction submission",
  "token approvals",
  "swaps and transfers",
  "arbitrary calldata",
  "autonomous fund movement",
  "official hosted Base MCP execution adapter",
  "bypasses owner approval or wallet approval",
]) {
  includes("snapshot protected scope", snapshot, expected);
}

for (const expected of [
  "`npm run build`",
  "`npm run check:privacy`",
  "`npm run check:roadmap`",
  "`npm run check:phase-10a`",
  "`npm run check:phase-10b`",
  "`npm run check:phase-10c`",
  "`npm run check:phase-10d`",
  "`npm run check:phase-10e`",
  "`npm run check:product-snapshot`",
  "`npm audit --audit-level=high`",
  "`git diff --check`",
  "Secret scan",
]) {
  includes("snapshot verification", snapshot, expected);
}

for (const expected of [
  "Open `https://kyraagent.xyz/`",
  "Open `/dashboard`",
  "Open `/deploy`",
  "Open a public agent route",
  "Connect and disconnect Base Account",
  "Send Telegram read-only commands",
  "Send a Telegram execution request",
  "Confirm Netlify deploy health, Supabase project health, and route availability",
]) {
  includes("snapshot manual smoke", snapshot, expected);
}

for (const expected of [
  "seed phrases",
  "private keys",
  "Telegram bot tokens",
  "OpenRouter or LLM API keys",
  "Supabase service-role data",
  "raw session tokens",
  "raw provider payload bodies",
  "raw Edge Function errors",
  "wallet internals",
  "transaction intent internals",
]) {
  includes("snapshot privacy list", snapshot, expected);
}

for (const expected of [
  "docs/product-readiness-snapshot.md",
  "Product Readiness Snapshot",
]) {
  includes("README snapshot link", readme, expected);
  includes("Phase 10 snapshot link", phase10, expected);
  includes("Phase 10E snapshot link", closeout, expected);
}

includes("package.json", packageJson, '"check:product-snapshot"');

for (const forbidden of [
  "automatic public transaction enablement is live",
  "Telegram submits transactions directly",
  "autonomous fund movement is enabled",
  "seed phrase collection",
  "private key custody",
  "skip owner approval",
  "skip wallet approval",
]) {
  excludes("product readiness snapshot", snapshot, forbidden);
}

console.log("Product readiness snapshot checks passed.");