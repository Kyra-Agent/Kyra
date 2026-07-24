import { readFileSync } from "node:fs";

const registry = readFileSync("src/config/productChains.ts", "utf8");
const deploy = readFileSync("supabase/functions/deploy-agent/index.ts", "utf8");
const prepare = readFileSync("supabase/functions/chain-action-prepare/core.ts", "utf8");
const migration = readFileSync(
  "supabase/migrations/20260724120000_robinhood_only_cutover.sql",
  "utf8",
);
const dashboard = readFileSync("src/pages/Dashboard.tsx", "utf8");

for (const expected of [
  "robinhood_mainnet",
  "robinhood_testnet",
  "productChains",
  "currentProductChain",
]) {
  if (!registry.includes(expected)) throw new Error("Registry binding missing: " + expected);
}
for (const expected of [
  "function assertChainTarget",
  "network: chain.key",
  "chain_key: chain.key",
  "chain_id: chain.id",
]) {
  if (!deploy.includes(expected)) throw new Error("Deploy binding missing: " + expected);
}
for (const expected of [
  "ownership.chainKey !== input.chainKey",
  "ownership.chainActionStatus",
  "agent_chain_mismatch",
]) {
  if (!prepare.includes(expected)) throw new Error("Prepare binding missing: " + expected);
}
for (const expected of [
  "agent_instances_network_check",
  "wallet_policies_chain_identity_check",
  "approval_requests_chain_identity_check",
  "prepared_actions_chain_identity_check",
]) {
  if (!migration.includes(expected)) throw new Error("Database binding missing: " + expected);
}
for (const expected of [
  "selectedAgentMatchesRuntime",
  "selectedAgentChainActionReady",
  "runtimeBoundWalletConnected",
]) {
  if (!dashboard.includes(expected)) throw new Error("Dashboard binding missing: " + expected);
}
console.log("Agent-to-Robinhood chain binding passed.");
