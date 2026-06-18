import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(name, source, value) {
  assert(source.includes(value), `${name} must include: ${value}`);
}

function excludes(name, source, value) {
  assert(!source.includes(value), `${name} must not include: ${value}`);
}

function ordered(name, source, values) {
  let offset = -1;
  for (const value of values) {
    const next = source.indexOf(value, offset + 1);
    assert(next > offset, `${name} must preserve order at: ${value}`);
    offset = next;
  }
}

const doc = read("docs/phase-7L-controlled-live-smoke-preparation.md");
const core = read("supabase/functions/base-mcp-prepare/core.ts");
const runtime = read("supabase/functions/base-mcp-prepare/runtime-config.ts");
const providerContract = read("supabase/functions/base-mcp-prepare/provider-contract.ts");
const limiter = read("supabase/functions/base-mcp-prepare/rate-limit.ts");
const forward = read("supabase/base_mcp_status_rate_limit_forward_review.sql");
const rollback = read("supabase/base_mcp_status_rate_limit_rollback_review.sql");
const verifier = read("supabase/verify_base_mcp_status_rate_limit_contract.sql");
const envExample = read(".env.example");
const functionEnv = read("supabase/functions/.env.example");
const dashboard = read("src/pages/Dashboard.tsx");
const telegram = read("supabase/functions/telegram-webhook/core.ts");

for (const value of [
  "Status: local preparation complete; production gate remains disabled.",
  "`kyra_status_v1`",
  "`https://mcp.base.org/` requires Bearer authentication",
  "path returns 404",
  "No production provider endpoint is selected.",
  "6 checks per agent per minute",
  "per agent per hour.",
  "No external observability sink",
  "Set `KYRA_BASE_MCP_PREP_ENABLED=false` first.",
]) includes("Phase 7L doc", doc, value);

includes("provider contract", providerContract, 'baseMcpProviderProtocol = "kyra_status_v1"');
includes("runtime config", runtime, 'value === "true"');
includes("function env", functionEnv, "KYRA_BASE_MCP_PROVIDER_PROTOCOL=");
excludes("frontend env", envExample, "VITE_BASE_MCP_URL");
includes("limiter", limiter, "baseMcpStatusMinuteMax = 6");
includes("limiter", limiter, "baseMcpStatusHourMax = 60");
includes("limiter", limiter, '"consume_base_mcp_status_rate_limit"');
ordered("Base MCP handler", core, [
  "assertAgentOwnership(",
  'runtimeConfig.providerProtocol !== "kyra_status_v1"',
  "safeCheckBaseMcpRateLimit(",
  "await dependencies.prepareBaseMcpAction(",
]);
includes("Base MCP handler", core, '"x-kyra-request-id"');
includes("Base MCP handler", core, '"x-kyra-base-mcp-outcome"');
includes("dashboard", dashboard, 'result.status === "base_mcp_rate_limited"');

for (const sql of [forward, rollback]) {
  includes("SQL review packet", sql, "REVIEW DRAFT - DO NOT APPLY");
}
includes("forward SQL", forward, "enable row level security");
includes("forward SQL", forward, "security invoker");
includes("forward SQL", forward, "pg_advisory_xact_lock");
includes("forward SQL", forward, "minute_count >= 6");
includes("forward SQL", forward, "hour_count >= 60");
includes("forward SQL", forward, "to service_role");
excludes("rate-limit table", forward, "owner_user_id uuid not null");
includes("verifier", verifier, "Returns booleans only");
includes("verifier", verifier, "anon_function_denied");
includes("verifier", verifier, "authenticated_function_denied");
includes("verifier", verifier, "service_delete_denied");
includes("rollback", rollback, "KYRA_BASE_MCP_PREP_ENABLED");
excludes("Telegram runtime", telegram, "base-mcp-prepare");
excludes("Telegram runtime", telegram, "consume_base_mcp_status_rate_limit");

console.log("Phase 7L controlled live-smoke preparation checks passed.");
