import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const registryPath = "src/config/productChains.ts";

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function walk(path) {
  const absolutePath = resolve(root, path);
  if (statSync(absolutePath).isFile()) return [path];

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const child = `${path}/${entry.name}`;
    return entry.isDirectory() ? walk(child) : [child];
  });
}

const registry = read(registryPath);
const appConfig = read("src/config/appConfig.ts");
const walletProviders = read("src/providers/WalletRuntimeProviders.tsx");
const unsignedHandoff = read("src/types/unsignedTransactionHandoff.ts");
const ownerWalletConnection = read("src/types/ownerWalletConnection.ts");
const walletSigning = read("src/types/walletSigning.ts");

for (const expected of [
  'id: 8453',
  'hexId: "0x2105"',
  'id: 4663',
  'hexId: "0x1237"',
  'id: 46630',
  'hexId: "0xb626"',
  'publicRpcUrl: "https://rpc.mainnet.chain.robinhood.com"',
  'explorerUrl: "https://robinhoodchain.blockscout.com"',
  'selection.mode === "robinhood-testnet"',
  'selection.requestedTarget === "robinhood_testnet"',
  'selection.testnetWindow === "owner_testnet_window"',
  'selection.mode === "robinhood-mainnet"',
  'selection.requestedTarget === "robinhood_mainnet"',
  'selection.mainnetWindow === "owner_mainnet_cutover"',
  'selection.releaseApproval === "owner_release_approved"',
  'return baseLegacyChain',
  'export const migrationTargetChain = robinhoodChain',
  'productionRpcPolicy: "backend_secret_required"',
  "normalizeEvmChainId",
  "isCurrentProductChainId",
  "isMigrationTargetChainId",
]) {
  assert(registry.includes(expected), `Chain registry must include: ${expected}`);
}

for (const [label, source, expected] of [
  ["app config", appConfig, "network: currentProductChain.name"],
  ["app config", appConfig, 'cutoverStatus: "pending"'],
  ["app config", appConfig, 'testnetEvidenceMode: currentProductChain.key === "robinhood_testnet"'],
  ["app config", appConfig, 'mainnetCutoverMode: currentProductChain.key === "robinhood_mainnet"'],
  ["app config", appConfig, 'walletExecution: "disabled"'],
  ["wallet providers", walletProviders, "id: productChain.id"],
  ["wallet providers", walletProviders, "productChain.publicRpcUrl"],
  ["wallet providers", walletProviders, "createWalletRuntimeConfig(currentProductChain)"],
  ["unsigned handoff", unsignedHandoff, "baseChainId = currentProductChain.id"],
  ["owner wallet binding", ownerWalletConnection, "ownerWalletChainId = currentProductChain.id"],
  ["wallet signing", walletSigning, "isCurrentProductChainId(chainId)"],
]) {
  assert(source.includes(expected), `${label} must include: ${expected}`);
}

const activeSourceFiles = walk("src").filter((path) =>
  /\.(?:ts|tsx)$/u.test(path) && path !== registryPath
);
const duplicatedChainFacts = activeSourceFiles.flatMap((path) => {
  const source = read(path);
  const matches = source.match(/\b(?:8453|4663|46630)\b|0x(?:2105|1237|b626)\b/giu);
  return matches?.map((match) => `${path}: ${match}`) ?? [];
});

assert(
  duplicatedChainFacts.length === 0,
  `Chain IDs must only exist in ${registryPath}: ${duplicatedChainFacts.join(", ")}`,
);

for (const policyPath of [
  "src/types/phase8OwnerActionCandidate.ts",
  "src/types/phase8LowValueTransactionReadiness.ts",
  "src/types/phase8UserSafeTransactionPolicy.ts",
  "src/types/phase9ExecutionEligibility.ts",
]) {
  assert(
    read(policyPath).includes('from "./unsignedTransactionHandoff"'),
    `${policyPath} must consume the canonical runtime chain alias.`,
  );
}

assert(
  !walletProviders.includes("baseLegacyChain") &&
    !walletProviders.includes("robinhoodTestnetChain") &&
    !walletProviders.includes("robinhoodChain"),
  "Wallet runtime must consume only the fully gated current product chain.",
);

console.log("Product chain abstraction checks passed.");
