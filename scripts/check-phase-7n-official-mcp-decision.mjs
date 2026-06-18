import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const includes = (name, source, value) =>
  assert(source.includes(value), `${name} must include: ${value}`);
const excludes = (name, source, value) =>
  assert(!source.includes(value), `${name} must not include: ${value}`);

const doc = read("docs/phase-7N-official-base-mcp-protocol-decision.md");
const runtime = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const runtimeTest = read("supabase/functions/base-mcp-prepare/runtime-config_test.ts");
const adapterTest = read("supabase/functions/base-mcp-prepare/provider-adapter_test.ts");
const functionEnv = read("supabase/functions/.env.example");
const frontendEnv = read(".env.example");
const telegram = read("supabase/functions/telegram-webhook/core.ts");

for (const value of [
  "Status: protocol split approved locally",
  "`WWW-Authenticate: Bearer realm=\"mcp\"`",
  "`agent_wallet:transact`",
  "`agent_wallet:escalate`",
  "## Decision",
  "## Explicit Non-Actions",
  "## Required Audit Before Official MCP",
  "Do not request access or refresh tokens.",
  "Production gates remain disabled.",
]) includes("Phase 7N doc", doc, value);

includes("runtime", runtime, 'url.hostname.toLowerCase() === "mcp.base.org"');
includes("runtime test", runtimeTest, 'normalizeBaseMcpEndpoint("https://mcp.base.org/")');
includes("adapter test", adapterTest, "never calls the official OAuth MCP endpoint");
includes("adapter test", adapterTest, "assertEquals(transportCalls, 0)");

for (const source of [functionEnv, frontendEnv]) {
  excludes("environment examples", source, "agent_wallet:transact");
  excludes("environment examples", source, "MCP_OAUTH_ACCESS_TOKEN");
  excludes("environment examples", source, "MCP_OAUTH_REFRESH_TOKEN");
}
excludes("Telegram runtime", telegram, "mcp.base.org");
excludes("Telegram runtime", telegram, "agent_wallet:transact");

console.log("Phase 7N official Base MCP protocol decision checks passed.");
