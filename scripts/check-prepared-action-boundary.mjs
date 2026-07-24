import { readFileSync } from "node:fs";

const prepared = readFileSync("src/types/preparedAction.ts", "utf8");
const service = readFileSync("src/services/chainActionPrepareService.ts", "utf8");
const core = readFileSync("supabase/functions/chain-action-prepare/core.ts", "utf8");
const storage = readFileSync(
  "supabase/functions/chain-action-prepare/storage-adapter.ts",
  "utf8",
);

for (const expected of [
  "chain_status_check",
  "robinhood_reviewed_transaction",
  "product_network_required",
  "wallet_execution_disabled",
]) {
  if (!prepared.includes(expected)) throw new Error("Prepared-action contract missing: " + expected);
}
for (const expected of [
  "currentProductChain.key",
  "currentProductChain.id",
  "read_only",
  "x-kyra-request-id",
]) {
  if (!service.includes(expected)) throw new Error("Browser prepare boundary missing: " + expected);
}
for (const expected of [
  "assertAgentOwnership",
  "agent_chain_mismatch",
  "agent_chain_action_locked",
  "checkRateLimit",
  "storePreparedAction",
]) {
  if (!core.includes(expected)) throw new Error("Backend prepare boundary missing: " + expected);
}
for (const expected of [
  'provider: "chain_rpc"',
  "workspace_id",
  "agent_id",
  "request_id",
  "route_summary",
  "value_summary",
]) {
  if (!storage.includes(expected)) throw new Error("Storage allowlist missing: " + expected);
}
for (const forbidden of [
  "private_key",
  "seed_phrase",
  "raw_provider_payload",
  "signed_payload",
]) {
  if ((core + storage).includes(forbidden)) throw new Error("Forbidden prepared-action field: " + forbidden);
}
console.log("Prepared-action boundary passed.");
