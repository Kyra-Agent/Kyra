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

const roadmap = read("docs/product-phase-roadmap.md");
const readme = read("README.md");
const phase5 = read("docs/phase-5-telegram-closeout.md");
const phase6 = read("docs/phase-6-closeout-audit.md");
const phase7 = read("docs/phase-7-pre-execution-audit.md");
const context = read("docs/kyra-agent-context.md");
const blueprint = read("docs/robinhood-chain-migration-blueprint.md");
const readinessCloseout = read("docs/supporting-readiness-closeout.md");
const providerSeparation = read("docs/phase-7-provider-separation-decision.md");

for (const expected of [
  "canonical source of truth for product phases",
  "Kyra is a platform for deploying user-owned AI agents.",
  "Active release track: Robinhood Chain migration.",
  "does not create Phase 11",
  "public product build now targets Robinhood Chain",
  "Mainnet transaction submission remains fail-closed",
  "## The 10 Product Phases",
  "This is the only active roadmap.",
  "| 1 | Product Foundation |",
  "| 2 | Backend Foundation |",
  "| 3 | Security + Privacy Foundation |",
  "| 4 | Agent Deployment Flow |",
  "| 5 | Telegram + LLM Live |",
  "| 6 | Wallet/Approval Foundation |",
  "| 7 | Wallet + Execution Readiness |",
  "| 8 | Controlled Live Transaction |",
  "| 9 | Public Execution Hardening |",
  "| 10 | Product Release Readiness |",
  "Historical evidence boundary",
  "Base Account and Base MCP sections below document",
  "User wallet authority and user Telegram bot-token privacy are priority one.",
]) includes("canonical roadmap", roadmap, expected);

for (const source of [readme, phase5, phase6, phase7]) {
  includes("canonical roadmap reference", source, "docs/product-phase-roadmap.md");
}

for (const expected of [
  "## Product Status",
  "Robinhood Chain",
  "Public execution is deliberately narrower",
  "docs/product-phase-roadmap.md",
  "docs/robinhood-chain-migration-blueprint.md",
]) includes("README roadmap", readme, expected);

for (const expected of [
  "# Kyra Agent Context",
  "## Canonical 10-Phase Roadmap",
  "Robinhood Chain migration",
  "not Phase 11",
  "User wallet authority and Telegram bot-token privacy are priority one.",
  "Do not use old Base-native positioning",
]) includes("writer context roadmap", context, expected);

for (const expected of [
  "# Supporting Readiness Closeout",
  "They support the 10-phase product roadmap",
  "The groups are not additional product phases.",
]) includes("supporting readiness closeout", readinessCloseout, expected);

for (const expected of [
  "# Phase 7 Provider Separation Decision",
  "Kyra Prepared-Action Adapter",
  "Official Hosted Base MCP Adapter",
]) includes("historical provider decision", providerSeparation, expected);

for (const expected of [
  "# Robinhood Chain Migration Blueprint",
  "release track under the existing 10-phase product roadmap",
  "not Phase 11",
]) includes("migration blueprint", blueprint, expected);

for (const forbidden of [
  "must use a platform-owned wallet",
  "Telegram signs and submits",
  "Robinhood Chain execution is live",
  "Kyra is endorsed by Robinhood",
]) excludes("canonical current sources", `${roadmap}\n${readme}\n${context}\n${blueprint}`, forbidden);

console.log("Canonical product phase roadmap checks passed.");
