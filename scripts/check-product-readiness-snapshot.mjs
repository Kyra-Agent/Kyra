import { readFileSync } from "node:fs";

const snapshot = readFileSync("docs/product-readiness-snapshot.md", "utf8");
for (const expected of [
  "# Product Readiness Snapshot",
  "## Ready",
  "## Controlled",
  "## Final Release Evidence",
  "Robinhood Chain",
  "Telegram",
  "Prepared actions",
  "fails closed",
]) {
  if (!snapshot.includes(expected)) throw new Error("Readiness snapshot missing: " + expected);
}
console.log("Product readiness snapshot passed.");
