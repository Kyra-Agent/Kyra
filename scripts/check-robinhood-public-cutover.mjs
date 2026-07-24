import { readFileSync } from "node:fs";

const sources = [
  readFileSync("README.md", "utf8"),
  readFileSync("index.html", "utf8"),
  readFileSync("public/og-card.svg", "utf8"),
  readFileSync("docs/product-readiness-snapshot.md", "utf8"),
].join("\n");

for (const expected of [
  "Robinhood Chain",
  "approval",
  "Telegram",
  "wallet",
]) {
  if (!sources.includes(expected)) throw new Error("Public product copy missing: " + expected);
}
for (const forbidden of [
  "autonomous fund movement is enabled",
  "transactions are publicly live",
  "endorsed by Robinhood",
]) {
  if (sources.includes(forbidden)) throw new Error("Unsafe public claim: " + forbidden);
}
console.log("Robinhood public cutover copy passed.");
