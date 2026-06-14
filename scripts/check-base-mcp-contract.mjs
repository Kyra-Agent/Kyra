import { readdirSync, readFileSync, statSync } from "node:fs";
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

function listFiles(path) {
  const absolutePath = resolve(root, path);
  const entries = readdirSync(absolutePath);
  const files = [];

  for (const entry of entries) {
    const child = `${path}/${entry}`;
    const absoluteChild = resolve(root, child);
    const stats = statSync(absoluteChild);

    if (stats.isDirectory()) {
      files.push(...listFiles(child));
      continue;
    }

    if (stats.isFile()) {
      files.push(child);
    }
  }

  return files;
}

function assertFilesDoNotInclude(paths, forbiddenPattern, message) {
  for (const path of paths) {
    const content = read(path);

    assert(!forbiddenPattern.test(content), `${message}: ${path}`);
  }
}

const typeContract = read("src/types/baseMcp.ts");
const docsContract = read("docs/phase-6B-base-mcp-adapter-contract.md");
const functionCore = read("supabase/functions/base-mcp-prepare/core.ts");
const functionDependencies = read("supabase/functions/base-mcp-prepare/dependencies.ts");
const functionReadme = read("supabase/functions/base-mcp-prepare/README.md");
const supabaseConfig = read("supabase/config.toml");
const frontendFiles = listFiles("src").filter((path) => /\.(ts|tsx)$/u.test(path));
const telegramWebhookFiles = listFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.(ts|tsx)$/u.test(path));

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
assert(
  functionCore.includes("Base MCP preparation is disabled."),
  "Base MCP function must fail closed while disabled.",
);
assert(
  functionCore.includes("Base MCP preparation is not configured."),
  "Base MCP function must keep the live adapter unwired by default.",
);
assert(
  functionCore.includes("maxBaseMcpPrepareRequestAgeMs = 5 * 60 * 1000"),
  "Base MCP function must cap request age for replay protection.",
);
assert(
  functionCore.includes("maxBaseMcpPrepareFutureSkewMs = 60 * 1000"),
  "Base MCP function must cap future timestamp skew.",
);
assert(
  functionCore.includes("maxBaseMcpPreparePreviewTtlMs = 10 * 60 * 1000"),
  "Base MCP function must cap preview expiry TTL.",
);
assert(
  functionCore.includes("assertAgentOwnership"),
  "Base MCP function must verify ownership before adapter calls.",
);
assert(
  functionCore.includes("storePreparedActionSummary"),
  "Base MCP function must expose only an optional prepared-action storage hook.",
);
assert(
  !functionDependencies.includes("prepareBaseMcpAction"),
  "Base MCP runtime dependencies must not wire a live adapter yet.",
);
assert(
  !functionDependencies.includes("storePreparedActionSummary"),
  "Base MCP runtime dependencies must not wire prepared-action storage yet.",
);
assert(
  /\[functions\.base-mcp-prepare\]\s+verify_jwt\s*=\s*true/su.test(supabaseConfig),
  "Base MCP prepare function must keep Supabase gateway JWT verification enabled.",
);
assert(
  functionReadme.includes("Do not call this function from Telegram."),
  "Base MCP function README must document Telegram boundary.",
);
assertFilesDoNotInclude(
  frontendFiles,
  /base-mcp-prepare|KYRA_BASE_MCP/u,
  "Frontend must not reference Base MCP function endpoints or backend secrets",
);
assertFilesDoNotInclude(
  telegramWebhookFiles,
  /base-mcp-prepare|prepareBaseMcpAction|KYRA_BASE_MCP/u,
  "Telegram webhook must not call or configure Base MCP preparation",
);

console.log("Base MCP contract checks passed.");
