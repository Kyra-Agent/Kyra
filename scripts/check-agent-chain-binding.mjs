import fs from "node:fs";

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function includes(label, source, expected) {
  if (!source.includes(expected)) {
    throw new Error(label + " must include: " + expected);
  }
}

function excludes(label, source, forbidden) {
  if (source.includes(forbidden)) {
    throw new Error(label + " must not include: " + forbidden);
  }
}

const registry = read("src/config/productChains.ts");
const database = read("src/types/database.ts");
const backend = read("src/types/backend.ts");
const deployService = read("src/services/supabaseDeployService.ts");
const deployFunction = read("supabase/functions/deploy-agent/index.ts");
const prepareCore = read("supabase/functions/chain-action-prepare/core.ts");
const prepareDependencies = read(
  "supabase/functions/chain-action-prepare/dependencies.ts",
);
const chainBindingMigration = read(
  "supabase/migrations/20260723100000_enforce_agent_chain_binding.sql",
);
const dashboardService = read("src/services/supabaseDashboardService.ts");
const publicAgentService = read("src/services/supabasePublicAgentService.ts");
const chainActionPrepareService = read(
  "src/services/chainActionPrepareService.ts",
);
const walletPanel = read("src/components/OwnerWalletConnectionPanel.tsx");
const dashboard = read("src/pages/Dashboard.tsx");

for (const expected of [
  "export type ProductChainKey",
  "getProductChainByKey",
  "currentProductChain",
]) {
  includes("chain registry", registry, expected);
}

for (const expected of [
  "network: KyraChainKey",
  "chain_action_status",
  "chain_key: KyraChainKey",
  "chain_id: number",
]) {
  includes("database contract", database, expected);
}

includes("backend agent contract", backend, "chainKey: ProductChainKey");
for (const expected of [
  "network: currentProductChain.key",
  'currentProductChain.key === "robinhood_testnet"',
  "chain_key: currentProductChain.key",
  "chain_id: currentProductChain.id",
  "chainKey: currentProductChain.key",
  "chainId: currentProductChain.id",
]) {
  includes("frontend deploy persistence", deployService, expected);
}
excludes("frontend deploy persistence", deployService, 'network: "base"');

for (const expected of [
  "function assertChainTarget",
  'chain.key === "robinhood_mainnet"',
  'Deno.env.get("KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED") !== "true"',
  "network: chain.key",
  'chain.key === "robinhood_testnet"',
  "chain_key: chain.key",
  "chain_id: chain.id",
]) {
  includes("deploy-agent Edge Function", deployFunction, expected);
}
excludes("deploy-agent Edge Function", deployFunction, 'network: "base"');

for (const expected of [
  "ownership.chainKey !== input.chainKey",
  "ownership.chainActionStatus",
  '"agent_chain_mismatch"',
  '"agent_chain_action_locked"',
]) {
  includes("chain action ownership gate", prepareCore, expected);
}
for (const expected of [
  "lookupChainActionAgentOwnership",
  '"id,workspace_id,network,chain_action_status"',
  "chainKey: agent.network",
  "chainActionStatus: agent.chain_action_status",
]) {
  includes("chain action ownership lookup", prepareDependencies, expected);
}

for (const expected of [
  "enforce_wallet_policy_agent_chain_scope",
  "enforce_approval_request_agent_chain_scope",
  "enforce_prepared_action_agent_scope",
  "enforce_chain_action_rate_limit_agent_scope",
  "enforce_agent_network_rebinding",
  "agents.network = p_chain_key",
  "agents.chain_action_status in ('ready', 'active')",
]) {
  includes("database chain binding", chainBindingMigration, expected);
}

for (const expected of [
  "chainKey: row.network",
  'network: chain?.name ?? "Unsupported network"',
  "chainActionStatus: row.chain_action_status",
  "policy.chain_key",
  "policy.chain_id",
  "policyChain.key !== currentProductChain.key",
]) {
  includes("dashboard chain mapping", dashboardService, expected);
}

for (const expected of [
  "type PublicAgentNetwork = ProductChainKey",
  "chainKey: row.network",
  'network: chain?.name ?? "Unsupported network"',
  'chainActionStatus: "disabled"',
]) {
  includes("public agent chain mapping", publicAgentService, expected);
}
excludes(
  "public agent chain mapping",
  publicAgentService,
  'row.network === "base" ? "Base" : "Base"',
);

for (const expected of [
  'actionKind: "chain_status_check"',
  "chainKey: currentProductChain.key",
  "chainId: currentProductChain.id",
  'mode: "read_only"',
  'keys === "ok,status,summary"',
  'keys === "code,message,ok,status"',
  'response.headers.get("x-kyra-request-id") === requestId',
]) {
  includes("chain action browser contract", chainActionPrepareService, expected);
}

for (const expected of [
  "agentChainKey: ProductChainKey | null",
  "agentChainMatchesRuntime",
  "agentChainKey === currentProductChain.key",
  "Selected agent belongs to another chain",
]) {
  includes("owner wallet binding", walletPanel, expected);
}

for (const expected of [
  "selectedAgentMatchesRuntime",
  "selectedAgentChainActionReady",
  "prepareChainActionStatusCheck",
  "runtimeBoundWalletConnected",
  "agentChainKey={agentRecord?.chainKey ?? null}",
]) {
  includes("dashboard execution binding", dashboard, expected);
}

console.log("Agent chain binding regression checks passed.");
