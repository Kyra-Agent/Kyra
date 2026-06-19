import { readFileSync } from "node:fs";

function read(path) {
  return readFileSync(path, "utf8");
}

function includes(label, source, expected) {
  if (!source.includes(expected)) {
    throw new Error(`${label} missing expected text: ${expected}`);
  }
}

function excludes(label, source, forbidden) {
  if (source.includes(forbidden)) {
    throw new Error(`${label} contains forbidden text: ${forbidden}`);
  }
}

const closeout = read("docs/phase-7AJ-read-only-base-live-closeout.md");
const provider = read("supabase/functions/base-mcp-status-provider/core.ts");
const providerIndex = read(
  "supabase/functions/base-mcp-status-provider/index.ts",
);
const providerReadme = read(
  "supabase/functions/base-mcp-status-provider/README.md",
);
const adapter = read(
  "supabase/functions/base-mcp-prepare/provider-adapter.ts",
);
const config = read("supabase/config.toml");
const migration = read(
  "supabase/migrations/20260619130000_base_mcp_status_rate_limit.sql",
);
const verifier = read(
  "supabase/migrations/20260619131000_verify_base_mcp_status_rate_limit.sql",
);

for (
  const expected of [
    "one controlled read-only Base status smoke completed successfully",
    "`KYRA_BASE_MCP_PREP_ENABLED=false`",
    "Result: `preview_ready`",
    "Closeout result: `base_mcp_disabled`",
    "No push or Netlify deploy occurred",
    "sustained traffic remains blocked",
  ]
) {
  includes("Phase 7AJ closeout", closeout, expected);
}

for (
  const expected of [
    'baseMcpStatusProviderProtocol = "kyra_status_v1"',
    'baseMainnetChainId = "0x2105"',
    '"eth_chainId"',
    "assertBearerSecret",
    "constantTimeSecretEquals",
    "assertFreshRequest",
    "maxBaseMcpStatusProviderBodyBytes",
    "maxBaseRpcResponseBytes",
  ]
) {
  includes("status provider", provider, expected);
}

includes(
  "status provider index",
  providerIndex,
  '"KYRA_BASE_MCP_PROVIDER_SHARED_SECRET"',
);
includes("status provider index", providerIndex, '"KYRA_BASE_RPC_URL"');
includes(
  "status provider README",
  providerReadme,
  "Performs only `eth_chainId`.",
);
includes(
  "provider adapter",
  adapter,
  'url.pathname.replace(/\\/+$/u, "")',
);
includes(
  "Supabase function config",
  config,
  "[functions.base-mcp-status-provider]",
);
includes("Supabase function config", config, "verify_jwt = false");
includes(
  "rate-limit migration",
  migration,
  "create table public.base_mcp_status_rate_limits",
);
includes(
  "verification migration",
  verifier,
  "base_mcp_status_rate_limits RLS disabled",
);

for (
  const forbidden of [
    "SUPABASE_SERVICE_ROLE_KEY=",
    "KYRA_TELEGRAM_AGENT_BRAIN_API_KEY=",
    "sk-or-v1-",
    "seed phrase",
  ]
) {
  excludes("Phase 7AJ tracked sources", [
    closeout,
    provider,
    providerIndex,
    providerReadme,
    adapter,
    migration,
    verifier,
  ].join("\n"), forbidden);
}

console.log("Phase 7AJ read-only Base live closeout checks passed.");
