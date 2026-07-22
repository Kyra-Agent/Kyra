import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { chainStatusProviderProtocol } from "../chain-status-provider/core.ts";
import {
  createChainActionPrepareRuntimeConfig,
  normalizeChainStatusEndpoint,
  parseChainActionTimeoutMs,
} from "./runtime-config.ts";

Deno.test("chain action runtime remains default-off after one env read", () => {
  const reads: string[] = [];
  assertEquals(
    createChainActionPrepareRuntimeConfig((key) => {
      reads.push(key);
      return "";
    }),
    { enabled: false },
  );
  assertEquals(reads, ["KYRA_CHAIN_ACTION_PREPARE_ENABLED"]);
});

Deno.test("chain action runtime binds exact endpoint, protocol, and chain", () => {
  const values = new Map([
    ["KYRA_CHAIN_ACTION_PREPARE_ENABLED", "true"],
    ["KYRA_CHAIN_STATUS_ENDPOINT", "https://project.supabase.co/functions/v1/chain-status-provider/"],
    ["KYRA_CHAIN_STATUS_ENDPOINT_HOST", "project.supabase.co"],
    ["KYRA_CHAIN_PROVIDER_SHARED_SECRET", "x".repeat(32)],
    ["KYRA_CHAIN_ACTION_TIMEOUT_MS", "3500"],
    ["KYRA_CHAIN_PROVIDER_PROTOCOL", chainStatusProviderProtocol],
    ["KYRA_CHAIN_KEY", "robinhood_testnet"],
    ["KYRA_CHAIN_ID", "46630"],
  ]);
  const config = createChainActionPrepareRuntimeConfig((key) => values.get(key) ?? "");
  if (!config.enabled) throw new Error("Expected enabled runtime.");
  assertEquals(config.chain.chainIdHex, "0xb626");
  assertEquals(config.timeoutMs, 3500);
  assertEquals(config.endpoint, "https://project.supabase.co/functions/v1/chain-status-provider");
});

Deno.test("chain action runtime rejects endpoint and chain drift", () => {
  assertEquals(
    normalizeChainStatusEndpoint("https://project.supabase.co/path/", "project.supabase.co"),
    "https://project.supabase.co/path",
  );
  assertEquals(
    normalizeChainStatusEndpoint("https://evil.test/path", "project.supabase.co"),
    null,
  );
  assertEquals(parseChainActionTimeoutMs("100"), 2500);
  assertEquals(parseChainActionTimeoutMs("9999"), 5000);

  const values = new Map([
    ["KYRA_CHAIN_ACTION_PREPARE_ENABLED", "true"],
    ["KYRA_CHAIN_KEY", "robinhood_mainnet"],
    ["KYRA_CHAIN_ID", "46630"],
  ]);
  assertThrows(() => createChainActionPrepareRuntimeConfig((key) => values.get(key) ?? ""));
});
