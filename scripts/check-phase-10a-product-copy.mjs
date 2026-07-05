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
  "Phase%209%20Complete%20%7C%20Phase%2010%20Active",
  "Kyra Agent is a Base-native AI agent console",
  "| 9 | Structurally complete: public execution hardening; runtime default-off |",
  "| 10 | Active: product release readiness |",
  "## Phase 10 Release Readiness",
  "10A | Public product copy and UX final",
  "10E | Release decision and closeout",
  "Phase 10 does not bypass owner approval",
  "public runtime default-off",
]) {
  includes("README", readme, expected);
}

for (const expected of [
  "## Phase 10 - Product Release Readiness",
  "Status: active; Batch",
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
  "Public copy must not claim Telegram can sign or submit transactions.",
  "User wallet authority and Telegram bot-token privacy",
]) {
  includes("Phase 10 doc", phase10, expected);
}

for (const forbidden of [
  "Phase 9 | Pending",
  "Pending: public execution hardening",
  "Not live in the current demo",
  "Telegram can sign",
  "autonomous fund movement is live",
  "public runtime execution is already open",
]) {
  excludes("README", readme, forbidden);
}

for (const expected of [
  '"check:phase-10a"',
]) {
  includes("package.json", packageJson, expected);
}

console.log("Phase 10A product copy checks passed.");