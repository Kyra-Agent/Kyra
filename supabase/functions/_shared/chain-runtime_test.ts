import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  backendChainRegistry,
  normalizeChainIdHex,
  readBackendChain,
  readBackendChainFromHex,
} from "./chain-runtime.ts";

Deno.test("backend chain registry exposes only Robinhood Chain networks", () => {
  assertEquals(Object.keys(backendChainRegistry).sort(), [
    "robinhood_mainnet",
    "robinhood_testnet",
  ]);
  assertEquals(backendChainRegistry.robinhood_mainnet.chainId, 4663);
  assertEquals(backendChainRegistry.robinhood_mainnet.chainIdHex, "0x1237");
  assertEquals(backendChainRegistry.robinhood_testnet.chainId, 46630);
  assertEquals(backendChainRegistry.robinhood_testnet.chainIdHex, "0xb626");
});

Deno.test("backend chain readers bind key, decimal id, and canonical hex", () => {
  assertEquals(
    readBackendChain("robinhood_mainnet", 4663).name,
    "Robinhood Chain",
  );
  assertEquals(
    readBackendChainFromHex("robinhood_testnet", "0xB626").chainId,
    46630,
  );
  assertEquals(normalizeChainIdHex("0x1237"), "0x1237");
});

Deno.test("backend chain readers reject legacy, drifted, and malformed values", () => {
  for (const [key, id] of [
    ["robinhood_mainnet", 46630],
    ["robinhood_testnet", 4663],
    ["unknown", 4663],
    ["legacy", 8453],
  ] as const) {
    assertThrows(() => readBackendChain(key, id));
  }

  for (const value of ["1237", "0x", "0x00", "0x01237", "0x-1", "0xg", ""]) {
    assertThrows(() => normalizeChainIdHex(value));
  }

  assertThrows(() => readBackendChainFromHex("legacy", "0x2105"));
});