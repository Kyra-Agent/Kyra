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

const doc = read("docs/phase-7D-base-account-connection-runtime.md");
const config = read("src/config/appConfig.ts");
const boundary = read("src/providers/WalletProviderBoundary.tsx");
const providers = read("src/providers/WalletRuntimeProviders.tsx");
const component = read("src/components/OwnerWalletConnectionPanel.tsx");
const contract = read("src/types/ownerWalletConnection.ts");
const test = read("scripts/test-owner-wallet-connection.mjs");
const dashboard = read("src/pages/Dashboard.tsx");
const packageJson = read("package.json");

for (
  const expected of [
    "Status: production connection clear.",
    "authenticated owner + workspace + selected deployed agent + Base Account",
    "Only an explicit owner click can call `connectAsync`.",
    "The returned chain must be exactly Base chain ID `8453`.",
    "held only in React memory and shown masked",
    "wallet signing",
    "transaction submission",
    "official hosted MCP OAuth, tokens, sessions, tools, or approval links",
    "controlled authenticated-owner connection smoke passed",
    "Netlify production deploy for `7f96f16` is ready",
  ]
) {
  includes("Phase 7D runtime doc", doc, expected);
}

includes("app config", config, 'walletConnection: "owner_click_only"');
includes("app config", config, 'walletExecution: "disabled"');
includes(
  "wallet provider boundary",
  boundary,
  "isWalletConnectionEnabled(appConfig.integrations.walletConnection)",
);
includes(
  "wallet provider boundary",
  boundary,
  'return value === "owner_click_only"',
);
includes("wallet providers", providers, "injected({ shimDisconnect: true })");
includes("wallet providers", providers, "multiInjectedProviderDiscovery: true");
includes("wallet providers", providers, "reconnectOnMount={false}");
includes("wallet providers", providers, "storage: null");
excludes("wallet providers", providers, "coinbaseWallet");
excludes("wallet providers", providers, "baseAccount(");

for (
  const expected of [
    "useConnection",
    "useConnect",
    "useConnectors",
    "useDisconnect",
    "ensureFreshAuthSession",
    "async function handleConnect()",
    "connectMutation.connectAsync",
    "chainId: currentProductChain.id",
    "createOwnerWalletConnectionBinding",
    "walletBindingMatchesTarget",
    "walletConnectionMatchesBinding",
    "requestSequenceRef",
    "Signing and transactions remain disabled.",
    "onClick={() => void handleConnect()}",
  ]
) {
  includes("Base Account connection panel", component, expected);
}

for (
  const forbidden of [
    "useWalletClient",
    "useSendTransaction",
    "useSignMessage",
    "useSignTypedData",
    "useWriteContract",
    "sendTransaction",
    "signMessage",
    "writeContract",
    "localStorage",
    "sessionStorage",
    "fetch(",
    "mcp.base.org",
    "telegram",
    "console.",
  ]
) {
  excludes("owner wallet connection panel", component, forbidden);
}

for (
  const expected of [
    "ownerWalletChainId = currentProductChain.id",
    'ownerWalletConnectorType = "injected"',
    "ownerWalletMinimumSessionValiditySeconds = 30",
    "canonicalUuidPattern",
    "addressPattern",
    "walletBindingMatchesTarget",
    "walletConnectionMatchesBinding",
    "maskOwnerWalletAddress",
    "Wallet connection failed safely.",
  ]
) {
  includes("owner wallet connection contract", contract, expected);
}

for (
  const expected of [
    "Binding must not survive target or refreshed-session drift.",
    "Address, chain, connector ID, or connector type drift must fail closed.",
    "Wrong chain, connector, or address must be rejected.",
    "Expired connection target must be rejected at binding time.",
    "User rejection must map to fixed sanitized copy.",
  ]
) {
  includes("owner wallet connection tests", test, expected);
}

includes("dashboard", dashboard, "<OwnerWalletConnectionPanel");
includes("dashboard", dashboard, "workspaceId={agentRecord?.workspaceId ?? null}");
includes("dashboard", dashboard, "agentId={agentRecord?.id ?? null}");
includes("package.json", packageJson, '"test:owner-wallet-connection"');
includes("package.json", packageJson, '"test:base-account-connection"');
includes("package.json", packageJson, '"check:phase-7d-connection"');
includes("package.json", packageJson, "npm run check:phase-7d-connection");

console.log("Phase 7D history and owner wallet migration checks passed.");
