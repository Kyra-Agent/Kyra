import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(label, source, expected) {
  assert(source.includes(expected), `${label} must include: ${expected}`);
}

function excludes(label, source, forbidden) {
  assert(!source.includes(forbidden), `${label} must not include: ${forbidden}`);
}

const registry = read("src/config/productChains.ts");
const providers = read("src/providers/WalletRuntimeProviders.tsx");
const appConfig = read("src/config/appConfig.ts");
const envExample = read(".env.example");
const gitignore = read(".gitignore");
const packageJson = read("package.json");
const netlify = read("netlify.toml");
const dashboard = read("src/pages/Dashboard.tsx");
const closeout = read("src/types/robinhoodTestnetCloseout.ts");
const resultPersistence = read("src/types/phase8ResultPersistence.ts");
const styles = read("src/styles.css");

for (const expected of [
  'selection.mode === "robinhood-testnet"',
  'selection.requestedTarget === "robinhood_testnet"',
  'selection.testnetWindow === "owner_testnet_window"',
  "return robinhoodTestnetChain",
  "return baseLegacyChain",
  'currentProductChain.key === "base"',
  'export const migrationTargetChain = robinhoodChain',
]) {
  includes("chain registry", registry, expected);
}

for (const forbidden of [
  'selection.requestedTarget === "robinhood_mainnet"',
  'return robinhoodChain;',
  "VITE_KYRA_ROBINHOOD_MAINNET",
]) {
  excludes("runtime-selectable chain registry", registry, forbidden);
}

for (const expected of [
  "robinhoodTestnetChain",
  'currentProductChain.key === "robinhood_testnet"',
  "createWalletRuntimeConfig(baseLegacyChain)",
  "storage: null",
  "reconnectOnMount={false}",
]) {
  includes("wallet provider boundary", providers, expected);
}
excludes("wallet provider boundary", providers, "createWalletRuntimeConfig(robinhoodChain)");

for (const expected of [
  "VITE_KYRA_CHAIN_RELEASE_TARGET=base",
  "VITE_KYRA_ROBINHOOD_TESTNET_WINDOW=disabled",
  "VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION=disabled",
  "VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION=disabled",
]) {
  includes("environment defaults", envExample, expected);
}

includes("local secret ignore policy", gitignore, "*.local");
includes("package scripts", packageJson, '"dev:robinhood-testnet"');
includes("package scripts", packageJson, '"build:robinhood-testnet"');
includes("app config", appConfig, 'walletExecution: "disabled"');
includes("app config", appConfig, 'testnetEvidenceMode: currentProductChain.key === "robinhood_testnet"');

for (const forbidden of [
  "VITE_KYRA_CHAIN_RELEASE_TARGET",
  "VITE_KYRA_ROBINHOOD_TESTNET_WINDOW",
  "robinhood_mainnet",
  "robinhood_testnet",
]) {
  excludes("Netlify production config", netlify, forbidden);
}

for (const expected of [
  "evaluateRobinhoodTestnetCloseout",
  "Check testnet status",
  "Open transaction review",
  "Continue to wallet confirmation",
  "Zero value, no calldata, no token approval, no swap, no Telegram execution.",
  "is-robinhood-testnet",
  "Testnet transaction setup",
  "phase8ScopedPersistedResult",
]) {
  includes("owner dashboard testnet workflow", dashboard, expected);
}

for (const expected of [
  '"check_chain_status"',
  '"connect_wallet"',
  '"open_review_window"',
  '"submit_transaction"',
  '"wait_for_receipt"',
  '"complete"',
]) {
  includes("testnet closeout state machine", closeout, expected);
}

for (const expected of [
  "reconcilePhase8PersistedExecutionResult",
  'receiptStatus: "success" | "reverted" | null',
  'receiptStatus === "success"',
]) {
  includes("testnet receipt persistence", resultPersistence, expected);
}
for (const expected of [
  ".robinhood-testnet-closeout",
  ".prepared-action-panel.is-robinhood-testnet .prepared-action-policy-panel",
  ".execution-result-panel.is-robinhood-testnet .phase-9-closeout-panel",
  ".execution-result-panel.is-robinhood-testnet .execution-result-list",
]) {
  includes("testnet workflow styles", styles, expected);
}

console.log("Robinhood owner-only testnet lane checks passed.");
