import { readFileSync } from "node:fs";

const read = (path) => readFileSync(path, "utf8");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function includes(label, source, expected) {
  assert(source.includes(expected), `${label} must include: ${expected}`);
}

function excludes(label, source, forbidden) {
  assert(!source.includes(forbidden), `${label} must not include: ${forbidden}`);
}

const providers = read("src/providers/WalletRuntimeProviders.tsx");
const panel = read("src/components/OwnerWalletConnectionPanel.tsx");
const contract = read("src/types/ownerWalletConnection.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const packageJson = read("package.json");
const packageLock = read("package-lock.json");

for (const expected of [
  "defineChain",
  "id: productChain.id",
  "productChain.publicRpcUrl",
  "createWalletRuntimeConfig(currentProductChain)",
  "injected({ shimDisconnect: true })",
  "multiInjectedProviderDiscovery: true",
  "storage: null",
  "reconnectOnMount={false}",
]) {
  includes("wallet runtime", providers, expected);
}

for (const forbidden of [
  "baseAccount(",
  'from "wagmi/chains"',
  "robinhoodChain",
]) {
  excludes("wallet runtime", providers, forbidden);
}

for (const expected of [
  "ownerWalletConnectorType",
  "isOwnerWalletConnectionTarget",
  "ensureFreshAuthSession",
  "walletBindingMatchesTarget",
  "walletConnectionMatchesBinding",
  "connector.type",
  "connection.connector?.name",
  "Wallet provider",
  "Choose which installed wallet Kyra should open.",
  "Connected EVM wallet",
  "sessionExpiresAt",
  "requestSequenceRef",
  "Signing and transactions remain disabled.",
  "No signing, token approval, or transaction request is made.",
]) {
  includes("owner wallet panel", panel, expected);
}

for (const forbidden of [
  "useWalletClient",
  "useSendTransaction",
  "useSignMessage",
  "useSignTypedData",
  "useWriteContract",
  "localStorage",
  "sessionStorage",
  "fetch(",
  "telegram",
  "console.",
]) {
  excludes("owner wallet panel", panel, forbidden);
}

for (const expected of [
  'ownerWalletConnectorType = "injected"',
  "ownerWalletMinimumSessionValiditySeconds = 30",
  "connectorIdPattern",
  "walletBindingMatchesTarget",
  "walletConnectionMatchesBinding",
  "Wallet connection failed safely.",
]) {
  includes("owner wallet contract", contract, expected);
}

includes("dashboard", dashboard, "<OwnerWalletConnectionPanel");
includes("package", packageJson, '"test:owner-wallet-connection"');
excludes("package", packageJson, '"@base-org/account"');
excludes("lockfile", packageLock, 'node_modules/@base-org/account');
excludes("lockfile", packageLock, 'node_modules/@coinbase/cdp-sdk');

console.log("Owner wallet migration checks passed.");
