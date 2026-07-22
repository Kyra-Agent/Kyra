import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const read = (path) => readFileSync(resolve(root, path), "utf8");
const requireText = (source, value, label) => {
  if (!source.includes(value)) throw new Error(`${label} is missing: ${value}`);
};
const rejectText = (source, pattern, label) => {
  if (pattern.test(source)) throw new Error(`${label} contains forbidden behavior.`);
};

const env = read("supabase/functions/.env.example");
const schema = read("supabase/schema.sql");
const config = read("supabase/config.toml");
const providerConfig = read(
  "supabase/functions/chain-status-provider/runtime-config.ts",
);
const providerCore = read("supabase/functions/chain-status-provider/core.ts");
const prepareCore = read("supabase/functions/chain-action-prepare/core.ts");
const prepareStorage = read(
  "supabase/functions/chain-action-prepare/storage-adapter.ts",
);
const migration = read(
  "supabase/migrations/20260722180000_chain_action_foundation.sql",
);
const verifier = read(
  "supabase/migrations/20260722181000_verify_chain_action_foundation.sql",
);
const rollback = read("supabase/chain_action_foundation_rollback_review.sql");

for (const flag of [
  "KYRA_CHAIN_STATUS_PROVIDER_ENABLED=false",
  "KYRA_CHAIN_ACTION_PREPARE_ENABLED=false",
]) {
  requireText(env, flag, "default-off environment contract");
}

for (const functionName of ["chain-status-provider", "chain-action-prepare"]) {
  requireText(config, `[functions.${functionName}]`, "Supabase function config");
}

for (const chain of ["base", "robinhood_mainnet", "robinhood_testnet"]) {
  requireText(schema, `'${chain}'`, "canonical schema chain allowlist");
  requireText(migration, `'${chain}'`, "migration chain allowlist");
}
requireText(schema, "chain_action_status", "canonical agent chain status");
requireText(
  migration,
  "wallet_policies_chain_identity_check",
  "wallet policy chain identity",
);
requireText(
  migration,
  "approval_requests_chain_identity_check",
  "approval receipt chain identity",
);
requireText(migration, "enable row level security", "RLS migration");
requireText(migration, "public.owns_workspace(workspace_id)", "owner RLS policy");
requireText(migration, "security_invoker = true", "owner summary view");
requireText(migration, "pg_advisory_xact_lock", "atomic rate limiter");
requireText(
  migration,
  "enforce_prepared_action_immutable_fields",
  "prepared action replay guard",
);
requireText(verifier, "forbidden_column_count", "migration privacy verifier");
requireText(rollback, "incompatible_agent_count", "rollback data guard");

requireText(providerConfig, "KYRA_CHAIN_STATUS_PROVIDER_ENABLED", "provider gate");
requireText(providerCore, 'method: "eth_chainId"', "read-only RPC contract");
requireText(prepareCore, "assertAgentOwnership", "prepare owner boundary");
requireText(prepareCore, "checkRateLimit", "prepare limiter boundary");
requireText(prepareStorage, 'provider: "chain_rpc"', "sanitized storage contract");

const runtimeSource = `${providerCore}\n${prepareCore}\n${prepareStorage}`;
rejectText(
  runtimeSource,
  /eth_(?:sendTransaction|sendRawTransaction|sign|signTransaction)|wallet_(?:sendCalls|addEthereumChain)|personal_sign|private[_ ]?key|seed[_ ]?phrase|mnemonic/iu,
  "disabled backend runtime",
);

for (const forbiddenColumn of [
  "wallet_address",
  "private_key",
  "seed_phrase",
  "telegram_bot_token",
  "raw_provider_payload",
  "raw_calldata",
  "signed_payload",
  "tx_hash",
]) {
  requireText(verifier, `'${forbiddenColumn}'`, "privacy verifier column blocklist");
}

console.log(
  "Robinhood backend foundation: default-off, owner-scoped, chain-bound, rate-limited, and privacy-guarded.",
);
