import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const typeContract = read("src/types/baseMcp.ts");
const docsContract = read("docs/phase-6B-base-mcp-adapter-contract.md");

const allowedListMatch = typeContract.match(
  /baseMcpAllowedActionKinds\s*=\s*\[([^\]]+)\]\s*as\s+const/u,
);

assert(allowedListMatch, "Missing baseMcpAllowedActionKinds contract.");

const allowedKinds = allowedListMatch[1]
  .split(",")
  .map((item) => item.trim().replace(/^["']|["']$/g, ""))
  .filter(Boolean);

assert(
  allowedKinds.length === 1 && allowedKinds[0] === "base_mcp_status_check",
  `Unexpected Base MCP allowed action kinds: ${allowedKinds.join(", ")}`,
);

for (const forbidden of [
  "swap",
  "send",
  "transfer",
  "approval",
  "contract_call",
  "arbitrary_calldata",
]) {
  assert(!allowedKinds.includes(forbidden), `Forbidden Base MCP action is allowed: ${forbidden}`);
}

assert(
  typeContract.includes('code: "base_mcp_unknown_action"'),
  "Unknown Base MCP action must return base_mcp_unknown_action.",
);
assert(
  typeContract.includes("No Base MCP action can be prepared right now."),
  "Base MCP sanitizer must return a fixed generic message.",
);
assert(
  docsContract.includes("Do not add browser-exposed `VITE_` variables"),
  "Base MCP contract must forbid browser-exposed secret variables.",
);
assert(
  docsContract.includes("Telegram may not:"),
  "Base MCP contract must document Telegram execution boundaries.",
);
assert(
  docsContract.includes("retry count: 0"),
  "Base MCP contract must keep first adapter retry count at zero.",
);

console.log("Base MCP contract checks passed.");
