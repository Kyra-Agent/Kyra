import { readFileSync } from "node:fs";

const registry = readFileSync("supabase/functions/_shared/chain-runtime.ts", "utf8");
const schema = readFileSync("supabase/schema.sql", "utf8");
const config = readFileSync("supabase/config.toml", "utf8");
const provider = readFileSync("supabase/functions/chain-status-provider/core.ts", "utf8");
const prepare = readFileSync("supabase/functions/chain-action-prepare/core.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260724120000_robinhood_only_cutover.sql",
  "utf8",
);
const verifier = readFileSync(
  "supabase/migrations/20260724121000_verify_robinhood_only_cutover.sql",
  "utf8",
);
const bootstrap = readFileSync(
  "supabase/migrations/20260619130000_base_mcp_status_rate_limit.sql",
  "utf8",
);
const receiptMigration = readFileSync(
  "supabase/migrations/20260726120000_transaction_intent_receipt_verification.sql",
  "utf8",
);
const receiptVerifier = readFileSync(
  "supabase/migrations/20260726121000_verify_transaction_intent_receipt_verification.sql",
  "utf8",
);
const telegramDeliveryRetryMigration = readFileSync(
  "supabase/migrations/20260726122000_telegram_delivery_retry.sql",
  "utf8",
);
const telegramDeliveryRetryVerifier = readFileSync(
  "supabase/migrations/20260726123000_verify_telegram_delivery_retry.sql",
  "utf8",
);

for (const chain of ["robinhood_mainnet", "robinhood_testnet"]) {
  for (const [label, source] of [["registry", registry], ["schema", schema], ["migration", migration]]) {
    if (!source.includes(chain)) throw new Error(label + " missing " + chain);
  }
}
for (const name of ["chain-status-provider", "chain-action-prepare"]) {
  if (!config.includes("[functions." + name + "]")) throw new Error("Missing function config: " + name);
}
for (const expected of ["eth_chainId", "read_only", "expectedBearerSecret"]) {
  if (!provider.includes(expected)) throw new Error("Provider boundary missing: " + expected);
}
for (const expected of ["assertAgentOwnership", "checkRateLimit", "storePreparedAction"]) {
  if (!prepare.includes(expected)) throw new Error("Prepare boundary missing: " + expected);
}
for (const expected of ["drop column if exists", "public_agent_profiles", "chain_action_status"]) {
  if (!migration.includes(expected)) throw new Error("Cutover migration missing: " + expected);
}
if (!verifier.includes("public agent view is not Robinhood cutover ready")) {
  throw new Error("Cutover verifier is incomplete.");
}

for (const expected of [
  "create table if not exists public.workspaces",
  "create table if not exists public.agent_instances",
  "create table if not exists public.telegram_sessions",
]) {
  if (!bootstrap.includes(expected)) {
    throw new Error("Clean bootstrap baseline missing: " + expected);
  }
}

if (receiptMigration.match(/^begin;$/gmu)?.length !== 1 ||
  receiptMigration.match(/^commit;$/gmu)?.length !== 1 ||
  receiptMigration.trimEnd().endsWith("commit;") === false) {
  throw new Error("Receipt verification migration must use one complete transaction.");
}
if (/alter table public\.execution_results\s+create or replace function/u.test(receiptMigration)) {
  throw new Error("Receipt verification migration contains an incomplete ALTER TABLE statement.");
}

for (const expected of [
  "prepared_action_record_id",
  "receipt_block_number",
  "receipt_checked_at",
  "new.recipient is distinct from old.recipient",
  "new.value_wei is distinct from old.value_wei",
  "new.calldata is distinct from old.calldata",
  "p_chain_key not in ('robinhood_mainnet', 'robinhood_testnet')",
]) {
  if (!receiptMigration.includes(expected)) {
    throw new Error("Receipt verification migration missing: " + expected);
  }
}

for (const expected of [
  "prepared_actions transaction intent fields missing",
  "execution_results receipt verification fields missing",
  "chain action rate limiter still accepts Base",
]) {
  if (!receiptVerifier.includes(expected)) {
    throw new Error("Receipt migration verifier missing: " + expected);
  }
}

for (const expected of [
  "create table if not exists public.prepared_actions",
  "prepared_actions_transaction_shape_check",
  "execution_results_prepared_action_record_idx",
  "execution_result_receipt_verification_required",
  "p_chain_key not in ('robinhood_mainnet', 'robinhood_testnet')",
]) {
  if (!schema.includes(expected)) {
    throw new Error("Final schema snapshot missing: " + expected);
  }
}

if (
  telegramDeliveryRetryMigration.match(/^begin;$/gmu)?.length !== 1 ||
  telegramDeliveryRetryMigration.match(/^commit;$/gmu)?.length !== 1 ||
  !telegramDeliveryRetryMigration.trimEnd().endsWith("commit;")
) {
  throw new Error("Telegram delivery retry migration must use one transaction.");
}

for (const expected of [
  "delivery_status",
  "lease_expires_at",
  "attempt_count",
  "delivered_at",
  "telegram_processed_updates_retry_idx",
  "pg_advisory_xact_lock",
  "mark_telegram_update_delivered",
  "grant execute on function public.mark_telegram_update_delivered",
]) {
  if (!telegramDeliveryRetryMigration.includes(expected)) {
    throw new Error("Telegram delivery retry migration missing: " + expected);
  }
  if (!schema.includes(expected)) {
    throw new Error("Final schema retry state missing: " + expected);
  }
}

for (const expected of [
  "telegram delivery completion is publicly executable",
  "telegram delivery metadata is publicly accessible",
  "telegram delivery retry service role access missing",
]) {
  if (!telegramDeliveryRetryVerifier.includes(expected)) {
    throw new Error("Telegram delivery retry verifier missing: " + expected);
  }
}
console.log("Robinhood backend contract passed.");
