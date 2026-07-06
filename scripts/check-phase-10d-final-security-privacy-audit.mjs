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

const audit = read("docs/phase-10D-final-security-privacy-audit.md");
const phase10 = read("docs/phase-10-product-release-readiness.md");
const roadmap = read("docs/product-phase-roadmap.md");
const packageJson = read("package.json");

for (const expected of [
  "# Phase 10D Final Security and Privacy Audit",
  "Public execution runtime remains default-off.",
  "It is a release gate, not a runtime enablement step.",
  "User wallet authority is priority one.",
  "User Telegram bot-token privacy is priority one.",
  "## Public Surface Audit",
  "## Private Surface Audit",
  "## Supabase and Edge Function Audit",
  "## Runtime Gate Audit",
  "## Secret Hygiene Audit",
  "## Release Blockers",
  "## Closeout Criteria",
]) {
  includes("Phase 10D audit", audit, expected);
}

for (const expected of [
  "Landing page",
  "Public agent profile",
  "GitHub README",
  "Telegram replies",
  "Support copy",
  "Owner dashboard",
  "Base Account connection",
  "Prepared action review",
  "Runtime submitter",
  "Result closeout",
  "Emergency disable",
]) {
  includes("Phase 10D surface coverage", audit, expected);
}

for (const expected of [
  "Public views must exclude forbidden private columns.",
  "Backend LLM calls must remain server-side.",
  "Official hosted Base MCP adapter remains no-go",
  "Base Account SDK lane remains the primary user transaction boundary.",
  "public and Telegram routes blocked from direct execution",
]) {
  includes("Phase 10D backend/security coverage", audit, expected);
}

for (const expected of [
  "OpenRouter or LLM API keys",
  "Supabase service role keys",
  "Telegram bot tokens",
  "private keys or seed phrases",
  "raw Base Account session tokens",
  "raw provider payload bodies",
  "raw Edge Function error dumps",
  "owner wallet internals on public routes",
]) {
  includes("Phase 10D secret coverage", audit, expected);
}

for (const expected of [
  "## Batch 10D - Final Security and Privacy Audit",
  "docs/phase-10D-final-security-privacy-audit.md",
  "npm run check:phase-10d",
]) {
  includes("Phase 10 doc", phase10, expected);
}

for (const expected of [
  "10D - Final security and privacy audit",
]) {
  includes("roadmap", roadmap, expected);
}

includes("package.json", packageJson, '"check:phase-10d"');

for (const forbidden of [
  "public runtime execution is already approved",
  "Telegram signs transactions directly",
  "Telegram submits transactions directly",
  "store secrets publicly",
  "official hosted Base MCP adapter is approved for execution",
]) {
  excludes("Phase 10D audit", audit, forbidden);
}

console.log("Phase 10D final security and privacy audit checks passed.");