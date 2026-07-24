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

const readme = read("README.md");
const roadmap = read("docs/product-phase-roadmap.md");
const phase10 = read("docs/phase-10-product-release-readiness.md");
const packageJson = read("package.json");

for (const expected of [
  "Product-Release%20Ready",
  "Kyra Agent lets users deploy account-scoped AI agents",
  "## Product Surface",
  "## Approval-First Execution",
  "## Robinhood Chain Boundary",
  "## Product Status",
  "the agent can prepare, but the user wallet decides",
  "Transaction submission remains controlled and fail-closed",
]) {
  includes("README", readme, expected);
}

for (const expected of [
  "## Phase 10 - Product Release Readiness",
  "10A - Public product copy and UX final",
  "10B - Support operations and operator runbook",
  "10C - Launch QA and production health evidence",
  "10D - Final security and privacy audit",
  "10E - Release decision and closeout",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "# Phase 10 Product Release Readiness",
  "## Batch 10A - Public Product Copy and UX Final",
  "Public execution runtime default-off until explicit release approval.",
  "User wallet authority and Telegram bot-token privacy",
]) {
  includes("Phase 10 doc", phase10, expected);
}

for (const forbidden of [
  "Base-native AI agent platform",
  "Not live in the current demo",
  "Telegram can sign",
  "autonomous fund movement is live",
  "public runtime execution is already open",
]) {
  excludes("README", readme, forbidden);
}

includes("package.json", packageJson, '"check:phase-10a"');
console.log("Phase 10A product copy checks passed.");
