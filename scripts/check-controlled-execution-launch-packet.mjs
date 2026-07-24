import { readFileSync } from "node:fs";

const packet = readFileSync("docs/controlled-execution-launch-packet.md", "utf8");
for (const expected of [
  "# Controlled Execution Launch Packet",
  "Required Sequence",
  "NYX-05",
  "explicitly approves",
  "wallet signs and submits",
  "Hard Blocks",
  "Release Gate",
  "fail closed",
]) {
  if (!packet.includes(expected)) throw new Error("Launch packet missing: " + expected);
}
console.log("Controlled execution launch packet passed.");
