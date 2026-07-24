import { readFileSync } from "node:fs";

const roadmap = readFileSync("docs/product-phase-roadmap.md", "utf8");
for (let phase = 1; phase <= 10; phase += 1) {
  if (!roadmap.includes("| " + phase + " |")) throw new Error("Roadmap missing phase " + phase);
}
for (const expected of [
  "five-module stack",
  "Telegram webhook and LLM replies",
  "Robinhood Chain public cutover",
  "User wallet authority",
  "Telegram token privacy",
]) {
  if (!roadmap.includes(expected)) throw new Error("Roadmap missing: " + expected);
}
console.log("Canonical ten-phase roadmap passed.");
