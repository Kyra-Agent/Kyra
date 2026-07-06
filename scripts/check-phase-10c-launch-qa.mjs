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

const qa = read("docs/phase-10C-launch-qa-production-health.md");
const phase10 = read("docs/phase-10-product-release-readiness.md");
const roadmap = read("docs/product-phase-roadmap.md");
const packageJson = read("package.json");

for (const expected of [
  "# Phase 10C Launch QA and Production Health Evidence",
  "Public execution runtime remains default-off.",
  "This document does not claim a new production deployment has happened",
  "## Launch QA Scope",
  "Landing page",
  "README/GitHub",
  "Dashboard",
  "Deploy flow",
  "Public agent profile",
  "Telegram read-only",
  "Natural Telegram planning",
  "Wallet/Base Account",
  "Transaction boundary",
  "Support state copy",
  "## Production Health Evidence",
  "Netlify production deploy",
  "Supabase project health",
  "Edge Functions",
  "Base Account provider",
  "npm run check:privacy",
  "npm run check:roadmap",
  "npm run build",
  "## Manual Smoke Script",
  "## Evidence Rules",
  "## Closeout Criteria",
]) {
  includes("Phase 10C QA doc", qa, expected);
}

for (const expected of [
  "wallet internals, token refs, session ids, internal ids, provider payload refs, transaction intent internals, and raw error details",
  "Do not capture Telegram bot tokens, API keys, service-role data, raw session tokens, provider payload bodies, or raw Edge Function errors.",
  "If any private value appears publicly, stop release review and use emergency disable plus rollback.",
]) {
  includes("Phase 10C privacy evidence", qa, expected);
}

for (const expected of [
  "## Batch 10C - Launch QA and Production Health Evidence",
  "docs/phase-10C-launch-qa-production-health.md",
  "npm run check:phase-10c",
]) {
  includes("Phase 10 doc", phase10, expected);
}

for (const expected of [
  "Status: active; Batch 10C launch QA and production health evidence in progress.",
  "10C - Launch QA and production health evidence",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  '"check:phase-10c"',
]) {
  includes("package.json", packageJson, expected);
}

for (const forbidden of [
  "new production deployment is already live",
  "public runtime is enabled",
  "store Telegram bot tokens in evidence",
  "store API keys in evidence",
  "store service-role data in evidence",
]) {
  excludes("Phase 10C QA doc", qa, forbidden);
}

console.log("Phase 10C launch QA checks passed.");