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
const component = read("src/components/BaseAccountConnectionPanel.tsx");
const contract = read("src/types/baseAccountConnection.ts");
const test = read("scripts/test-base-account-connection.mjs");
const dashboard = read("src/pages/Dashboard.tsx");
const packageJson = read("package.json");

for (
  const expected of [
    "Status: local runtime implementation complete. Not deployed and not live.",
    "authenticated owner + workspace + selected deployed agent + Base Account",
    "Only an explicit owner click can call `connectAsync`.",
    "The returned chain must be exactly Base chain ID `8453`.",
    "held only in React memory and shown masked",
    "wallet signing",
    "transaction submission",
    "official hosted MCP OAuth, tokens, sessions, tools, or approval links",
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
includes("wallet providers", providers, "baseAccount({ appName: appConfig.appName })");
includes("wallet providers", providers, "reconnectOnMount={false}");
includes("wallet providers", providers, "storage: null");
excludes("wallet providers", providers, "coinbaseWallet");

for (
  const expected of [
    "useConnection",
    "useConnect",
    "useConnectors",
    "useDisconnect",
    "ensureFreshAuthSession",
    "async function handleConnect()",
    "connectMutation.connectAsync",
    "chainId: base.id",
    "createBaseAccountConnectionBinding",
    "bindingMatchesTarget",
    "connectionMatchesBinding",
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
  excludes("Base Account connection panel", component, forbidden);
}

for (
  const expected of [
    "baseAccountChainId = 8453",
    'baseAccountConnectorId = "baseAccount"',
    "canonicalUuidPattern",
    "addressPattern",
    "bindingMatchesTarget",
    "connectionMatchesBinding",
    "maskBaseAccountAddress",
    "Base Account connection failed safely.",
  ]
) {
  includes("Base Account connection contract", contract, expected);
}

for (
  const expected of [
    "Binding must not transfer to another agent.",
    "Binding must not transfer to another owner.",
    "Binding must not transfer to another workspace.",
    "Address, chain, or connector drift must fail closed.",
    "Non-Base chain must be rejected.",
    "Non-Base-Account connector must be rejected.",
    "Malformed wallet address must be rejected.",
  ]
) {
  includes("Base Account connection tests", test, expected);
}

includes("dashboard", dashboard, "<BaseAccountConnectionPanel");
includes("dashboard", dashboard, "workspaceId={agentRecord?.workspaceId ?? null}");
includes("dashboard", dashboard, "agentId={agentRecord?.id ?? null}");
includes("package.json", packageJson, '"test:base-account-connection"');
includes("package.json", packageJson, '"check:phase-7d-connection"');
includes("package.json", packageJson, "npm run check:phase-7d-connection");

console.log("Phase 7D Base Account connection checks passed.");
