import { readFileSync } from "node:fs";

const blueprint = readFileSync("docs/robinhood-chain-migration-blueprint.md", "utf8");
const roadmap = readFileSync("docs/product-phase-roadmap.md", "utf8");
const snapshot = readFileSync("docs/product-readiness-snapshot.md", "utf8");

for (const expected of [
  "# Robinhood Chain Migration",
  "Canonical Networks",
  "Completed Cutover",
  "Safety Boundary",
  "Rollback",
]) {
  if (!blueprint.includes(expected)) throw new Error("Migration document missing: " + expected);
}
if (!roadmap.includes("one ten-phase product roadmap")) throw new Error("Roadmap is not canonical.");
if (!snapshot.includes("Robinhood Chain is the only active product chain family")) {
  throw new Error("Readiness snapshot is not cut over.");
}
console.log("Robinhood migration documentation passed.");
