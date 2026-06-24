import { readFileSync } from "node:fs";

const doc = readFileSync(
  "docs/optional-cdp-node-infrastructure.md",
  "utf8",
);
const provider = readFileSync(
  "supabase/functions/base-mcp-status-provider/core.ts",
  "utf8",
);
const providerIndex = readFileSync(
  "supabase/functions/base-mcp-status-provider/index.ts",
  "utf8",
);
const validator = readFileSync(
  "scripts/validate-coinbase-cdp-base-rpc.mjs",
  "utf8",
);
const envExample = readFileSync("supabase/functions/.env.example", "utf8");

for (
  const expected of [
    "optional infrastructure prepared; not part of the primary Phase 7",
    "The Base Account SDK plus Kyra's bounded",
    "KYRA_BASE_RPC_PROVIDER=coinbase_cdp",
    "KYRA_BASE_MCP_PREP_ENABLED=false",
    "calls only `eth_chainId` and `eth_blockNumber`",
    "No payment method, account registration, endpoint creation, or key handling was",
  ]
) {
  assertIncludes("optional CDP document", doc, expected);
}

for (
  const expected of [
    'provider === "coinbase_cdp"',
    'url.hostname !== "api.developer.coinbase.com"',
    '/^\\/rpc\\/v1\\/base\\/',
    'provider === "base_public_smoke"',
    'url.hostname !== "mainnet.base.org"',
  ]
) {
  assertIncludes("provider RPC allowlist", provider, expected);
}

assertIncludes(
  "provider environment",
  providerIndex,
  '"KYRA_BASE_RPC_PROVIDER"',
);
assertIncludes(
  "function environment example",
  envExample,
  "KYRA_BASE_RPC_PROVIDER=",
);

for (
  const expected of [
    'process.env.KYRA_BASE_RPC_URL',
    '"eth_chainId"',
    '"eth_blockNumber"',
    'chainId !== "0x2105"',
    "Coinbase CDP Base RPC validation passed.",
  ]
) {
  assertIncludes("CDP validator", validator, expected);
}

for (
  const forbidden of [
    "console.log(rpcUrl",
    "console.log(url",
    "YOUR_CLIENT_API_KEY",
    "sk-or-v1-",
    "SUPABASE_SERVICE_ROLE_KEY=",
  ]
) {
  assertExcludes("optional CDP sources", `${provider}\n${validator}`, forbidden);
}

console.log("Optional CDP Node infrastructure checks passed.");

function assertIncludes(label, source, expected) {
  if (!source.includes(expected)) {
    throw new Error(`${label} missing expected text: ${expected}`);
  }
}

function assertExcludes(label, source, forbidden) {
  if (source.includes(forbidden)) {
    throw new Error(`${label} contains forbidden text: ${forbidden}`);
  }
}
