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

const runbook = read("docs/phase-10B-support-ops-runbook.md");
const phase10 = read("docs/phase-10-product-release-readiness.md");
const roadmap = read("docs/product-phase-roadmap.md");
const packageJson = read("package.json");

for (const expected of [
  "# Phase 10B Support Operations and Operator Runbook",
  "Public execution runtime remains default-off.",
  "User wallet authority is priority one.",
  "Telegram bot-token privacy is priority one.",
  "Never ask a user for a seed phrase, private key, Telegram bot token, API key, or raw session token.",
  "## Support Intake",
  "## User-Facing States",
  "## Operator Runbook",
  "## Emergency Disable",
  "## Rollback",
  "## Escalation Rules",
  "## Closeout Criteria",
]) {
  includes("Phase 10B runbook", runbook, expected);
}

for (const expected of [
  "Telegram read-only refusal",
  "Wallet prompt unavailable",
  "Insufficient gas",
  "Rejected prompt",
  "Provider outage",
  "Stuck receipt",
  "Public profile issue",
]) {
  includes("Phase 10B user-facing states", runbook, expected);
}

for (const expected of [
  "## Batch 10B - Support Operations and Operator Runbook",
  "docs/phase-10B-support-ops-runbook.md",
  "npm run check:phase-10b",
]) {
  includes("Phase 10 doc", phase10, expected);
}

for (const expected of [
  "Status: active;",
  "10B - Support operations and operator runbook",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  '"check:phase-10b"',
]) {
  includes("package.json", packageJson, expected);
}

for (const forbidden of [
  "send your seed phrase",
  "send your private key",
  "send your Telegram bot token",
  "Telegram signs transactions",
  "Telegram submits transactions",
  "we can move funds for you",
  "public runtime is enabled",
]) {
  excludes("Phase 10B runbook", runbook, forbidden);
}

console.log("Phase 10B support operations checks passed.");