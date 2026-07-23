import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function includes(label, source, expected) {
  if (!source.includes(expected)) {
    throw new Error(`${label} must include: ${expected}`);
  }
}

function excludes(label, source, forbidden) {
  if (source.includes(forbidden)) {
    throw new Error(`${label} must exclude: ${forbidden}`);
  }
}

const chains = read("src/config/productChains.ts");
const appConfig = read("src/config/appConfig.ts");
const walletRuntime = read("src/providers/WalletRuntimeProviders.tsx");
const envExample = read(".env.example");
const functionEnvExample = read("supabase/functions/.env.example");
const deployAgent = read("supabase/functions/deploy-agent/index.ts");
const chainStatusConfig = read("supabase/functions/chain-status-provider/runtime-config.ts");
const chainStatusCore = read("supabase/functions/chain-status-provider/core.ts");
const netlify = read("netlify.toml");
const packageJson = read("package.json");
const runbook = read("docs/robinhood-mainnet-cutover-runbook.md");
const blueprint = read("docs/robinhood-chain-migration-blueprint.md");

for (const expected of [
  'selection.mode === "robinhood-mainnet"',
  'selection.requestedTarget === "robinhood_mainnet"',
  'selection.mainnetWindow === "owner_mainnet_cutover"',
  'selection.releaseApproval === "owner_release_approved"',
  "return robinhoodChain",
  "return baseLegacyChain",
]) {
  includes("mainnet runtime selector", chains, expected);
}

includes(
  "app config",
  appConfig,
  'mainnetCutoverMode: currentProductChain.key === "robinhood_mainnet"',
);
includes(
  "wallet runtime",
  walletRuntime,
  "createWalletRuntimeConfig(currentProductChain)",
);
excludes("wallet runtime", walletRuntime, "createWalletRuntimeConfig(robinhoodChain)");

for (const expected of [
  "VITE_KYRA_CHAIN_RELEASE_TARGET=base",
  "VITE_KYRA_ROBINHOOD_MAINNET_WINDOW=disabled",
  "VITE_KYRA_ROBINHOOD_MAINNET_RELEASE=disabled",
  "VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION=disabled",
  "VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION=disabled",
]) {
  includes("frontend defaults", envExample, expected);
}
excludes("frontend defaults", envExample, "VITE_KYRA_CHAIN_RPC_URL");
excludes("frontend defaults", envExample, "VITE_KYRA_CHAIN_PROVIDER_SHARED_SECRET");

includes(
  "backend defaults",
  functionEnvExample,
  "KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED=false",
);
for (const expected of [
  "KYRA_ROBINHOOD_MAINNET_RPC_URL=",
  "KYRA_ROBINHOOD_MAINNET_RPC_ALLOWED_HOSTS=",
]) {
  includes("backend mainnet defaults", functionEnvExample, expected);
}
includes(
  "mainnet deploy gate",
  deployAgent,
  'Deno.env.get("KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED") !== "true"',
);
includes("mainnet deploy gate", deployAgent, '"chain_release_locked"');
includes("provider policy", chainStatusConfig, '"managed_private"');
includes("provider policy", chainStatusConfig, "KYRA_CHAIN_RPC_ALLOWED_HOSTS");
includes(
  "mainnet provider isolation",
  chainStatusConfig,
  "KYRA_ROBINHOOD_MAINNET_RPC_URL",
);
includes(
  "mainnet provider isolation",
  chainStatusConfig,
  "KYRA_ROBINHOOD_MAINNET_RPC_ALLOWED_HOSTS",
);
includes(
  "mainnet provider isolation",
  chainStatusConfig,
  'chain.key === "robinhood_mainnet"',
);
includes("provider policy", chainStatusCore, 'hostname === "rpc.mainnet.chain.robinhood.com"');

for (const expected of [
  "https://rpc.mainnet.chain.robinhood.com",
  "https://rpc.testnet.chain.robinhood.com",
  'command = "npm run build"',
]) {
  includes("Netlify boundary", netlify, expected);
}

for (const expected of [
  '"dev:robinhood-mainnet"',
  '"build:robinhood-mainnet"',
  '"check:robinhood-mainnet-cutover"',
]) {
  includes("package scripts", packageJson, expected);
}

for (const expected of [
  "# Robinhood Chain Mainnet Cutover Runbook",
  "Public RPC is not a production provider",
  "No wallet private key, Telegram token, provider key, wallet address, or transaction hash",
  "## Rollback",
  "## Live Configuration Audit",
  "`KYRA_ROBINHOOD_MAINNET_RPC_ALLOWED_HOSTS` is not configured yet",
  "`KYRA_ROBINHOOD_MAINNET_DEPLOY_ENABLED` is not configured yet",
  "no accidental mainnet deploy or public cutover is active",
  "owner_release_approved",
]) {
  includes("cutover runbook", runbook, expected);
}

includes("migration blueprint", blueprint, "Batch 6 software readiness");
includes("migration blueprint", blueprint, "Kyra-owned managed production RPC");

console.log("Robinhood mainnet cutover readiness checks passed.");
