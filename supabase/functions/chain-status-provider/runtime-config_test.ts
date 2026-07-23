import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  createChainStatusProviderRuntimeConfig,
  parseAllowedRpcHosts,
} from "./runtime-config.ts";

Deno.test("chain provider runtime is default-off and reads one gate", () => {
  const reads: string[] = [];
  const config = createChainStatusProviderRuntimeConfig((key) => {
    reads.push(key);
    return "";
  });

  assertEquals(config, { enabled: false });
  assertEquals(reads, ["KYRA_CHAIN_STATUS_PROVIDER_ENABLED"]);
});

Deno.test("chain provider runtime binds managed endpoint to exact chain", () => {
  const values = new Map([
    ["KYRA_CHAIN_STATUS_PROVIDER_ENABLED", "true"],
    ["KYRA_CHAIN_PROVIDER_SHARED_SECRET", "secret-value"],
    ["KYRA_CHAIN_RPC_URL", "https://testnet-only.example.test/v2/private"],
    ["KYRA_CHAIN_RPC_PROVIDER", "managed_private"],
    ["KYRA_CHAIN_RPC_ALLOWED_HOSTS", "testnet-only.example.test"],
    ["KYRA_ROBINHOOD_MAINNET_RPC_URL", "https://rpc.example.test/v2/private"],
    ["KYRA_ROBINHOOD_MAINNET_RPC_ALLOWED_HOSTS", "rpc.example.test"],
    ["KYRA_CHAIN_KEY", "robinhood_mainnet"],
    ["KYRA_CHAIN_ID", "4663"],
  ]);
  const config = createChainStatusProviderRuntimeConfig((key) =>
    values.get(key) ?? ""
  );

  if (!config.enabled) throw new Error("Expected enabled config.");
  assertEquals(config.chain.chainIdHex, "0x1237");
  assertEquals(config.rpcUrl, "https://rpc.example.test/v2/private");
  assertEquals(config.allowedRpcHosts, ["rpc.example.test"]);
});

Deno.test("mainnet provider never falls back to generic or testnet RPC secrets", () => {
  const values = new Map([
    ["KYRA_CHAIN_STATUS_PROVIDER_ENABLED", "true"],
    ["KYRA_CHAIN_PROVIDER_SHARED_SECRET", "secret-value"],
    ["KYRA_CHAIN_RPC_URL", "https://testnet-only.example.test/v2/private"],
    ["KYRA_CHAIN_RPC_PROVIDER", "managed_private"],
    ["KYRA_CHAIN_RPC_ALLOWED_HOSTS", "testnet-only.example.test"],
    ["KYRA_CHAIN_KEY", "robinhood_mainnet"],
    ["KYRA_CHAIN_ID", "4663"],
  ]);
  const config = createChainStatusProviderRuntimeConfig((key) =>
    values.get(key) ?? ""
  );

  if (!config.enabled) throw new Error("Expected enabled config.");
  assertEquals(config.rpcUrl, "");
  assertEquals(config.allowedRpcHosts, []);
});

Deno.test("chain provider runtime rejects chain and host drift", () => {
  assertEquals(
    parseAllowedRpcHosts("rpc.one.test,rpc.two.test"),
    ["rpc.one.test", "rpc.two.test"],
  );
  assertThrows(() => parseAllowedRpcHosts("rpc.test,rpc.test"));
  assertThrows(() => parseAllowedRpcHosts("https://rpc.test"));

  const values = new Map([
    ["KYRA_CHAIN_STATUS_PROVIDER_ENABLED", "true"],
    ["KYRA_CHAIN_RPC_PROVIDER", "managed_private"],
    ["KYRA_CHAIN_KEY", "robinhood_mainnet"],
    ["KYRA_CHAIN_ID", "46630"],
  ]);
  assertThrows(() =>
    createChainStatusProviderRuntimeConfig((key) => values.get(key) ?? "")
  );
});
