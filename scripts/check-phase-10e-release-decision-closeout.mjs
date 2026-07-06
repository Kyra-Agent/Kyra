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

const closeout = read("docs/phase-10E-release-decision-closeout.md");
const phase10 = read("docs/phase-10-product-release-readiness.md");
const roadmap = read("docs/product-phase-roadmap.md");
const packageJson = read("package.json");

for (const expected of [
  "# Phase 10E Release Decision and Closeout",
  "Public execution runtime remains default-off until explicit release approval.",
  "This is not a silent runtime enablement step.",
  "## Release Decision",
  "Current decision: ready for release-candidate review, not automatic public execution enablement.",
  "## Phase 10 Closeout Evidence",
  "## Final Gate Summary",
  "## Required Checks",
  "## Public Release Boundary",
  "## Next Product Track",
  "## Closeout Criteria",
]) {
  includes("Phase 10E closeout", closeout, expected);
}

for (const expected of [
  "public product positioning",
  "backend-connected deployed agent demo flow",
  "Telegram-native read-only agent replies",
  "Base Account connection and disconnect flow",
  "approval-first prepared-action review model",
  "controlled owner-only transaction lane architecture",
]) {
  includes("Phase 10E ready scope", closeout, expected);
}

for (const expected of [
  "public transaction execution",
  "Telegram transaction submission",
  "public profile transaction submission",
  "token approvals",
  "swaps and transfers",
  "arbitrary calldata",
  "official hosted Base MCP execution adapter",
  "autonomous fund movement",
]) {
  includes("Phase 10E gated scope", closeout, expected);
}

for (const expected of [
  "docs/phase-10E-release-decision-closeout.md",
  "npm run check:phase-10e",
  "runtime public execution stays default-off unless explicitly approved",
  "user wallet authority remains owner-controlled",
  "Telegram bot-token privacy remains protected",
]) {
  includes("Phase 10E boundary", closeout, expected);
}

for (const expected of [
  "## Batch 10E - Release Decision and Closeout",
  "docs/phase-10E-release-decision-closeout.md",
  "npm run check:phase-10e",
]) {
  includes("Phase 10 doc", phase10, expected);
}

for (const expected of [
  "Status: complete for product release readiness; runtime public execution remains gated pending explicit release approval.",
  "10E - Release decision and closeout",
]) {
  includes("roadmap", roadmap, expected);
}

includes("package.json", packageJson, '"check:phase-10e"');

for (const forbidden of [
  "automatic public execution enabled",
  "Telegram submits transactions directly",
  "autonomous fund movement is enabled",
  "official hosted Base MCP execution adapter approved",
  "skip Base Account approval",
]) {
  excludes("Phase 10E closeout", closeout, forbidden);
}

console.log("Phase 10E release decision closeout checks passed.");