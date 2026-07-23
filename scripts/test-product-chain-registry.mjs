import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourcePath = resolve(root, "src/config/productChains.ts");
const outDir = resolve(root, ".tmp-product-chain-registry-test");
const outputPath = resolve(outDir, "productChains.mjs");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${expected}, received ${actual}.`);
  }
}

mkdirSync(outDir, { recursive: true });

const source = readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const chains = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  assertEquals(chains.baseLegacyChain.id, 8453);
  assertEquals(chains.baseLegacyChain.hexId, "0x2105");
  assertEquals(chains.currentProductChain.key, "base");
  assertEquals(chains.currentProductChain.name, "Base");
  assertEquals(chains.migrationTargetChain.key, "robinhood_mainnet");
  assertEquals(chains.robinhoodChain.id, 4663);
  assertEquals(chains.robinhoodChain.hexId, "0x1237");
  assertEquals(chains.robinhoodTestnetChain.id, 46630);
  assertEquals(chains.robinhoodTestnetChain.hexId, "0xb626");
  assertEquals(chains.robinhoodTestnetChain.key, "robinhood_testnet");

  assertEquals(
    chains.selectProductChainForRuntime({
      mode: "robinhood-testnet",
      requestedTarget: "robinhood_testnet",
      testnetWindow: "owner_testnet_window",
      mainnetWindow: "disabled",
      releaseApproval: "disabled",
    }).key,
    "robinhood_testnet",
  );
  assertEquals(
    chains.selectProductChainForRuntime({
      mode: "robinhood-mainnet",
      requestedTarget: "robinhood_mainnet",
      testnetWindow: "disabled",
      mainnetWindow: "owner_mainnet_cutover",
      releaseApproval: "owner_release_approved",
    }).key,
    "robinhood_mainnet",
  );
  for (const selection of [
    {
      mode: "production",
      requestedTarget: "robinhood_testnet",
      testnetWindow: "owner_testnet_window",
    },
    {
      mode: "robinhood-testnet",
      requestedTarget: "robinhood_mainnet",
      testnetWindow: "owner_testnet_window",
    },
    {
      mode: "robinhood-testnet",
      requestedTarget: "robinhood_testnet",
      testnetWindow: "disabled",
    },
    {
      mode: "robinhood-mainnet",
      requestedTarget: "robinhood_mainnet",
      testnetWindow: "disabled",
      mainnetWindow: "owner_mainnet_cutover",
      releaseApproval: "disabled",
    },
    {
      mode: "production",
      requestedTarget: "robinhood_mainnet",
      testnetWindow: "disabled",
      mainnetWindow: "owner_mainnet_cutover",
      releaseApproval: "owner_release_approved",
    },
  ]) {
    assertEquals(
      chains.selectProductChainForRuntime(selection).key,
      "base",
      "Incomplete or production selection must fail closed to Base.",
    );
  }

  for (const value of [8453, "8453", "0x2105", " 0X2105 ", 8453n]) {
    assertEquals(chains.normalizeEvmChainId(value), 8453);
    assert(chains.isCurrentProductChainId(value), "Current Base chain form must pass.");
  }

  for (const value of [4663, "4663", "0x1237", 4663n]) {
    assertEquals(chains.normalizeEvmChainId(value), 4663);
    assert(
      chains.isMigrationTargetChainId(value),
      "Robinhood migration target form must pass.",
    );
    assert(
      !chains.isCurrentProductChainId(value),
      "Robinhood must fail the current runtime gate before cutover.",
    );
  }

  for (const value of [null, undefined, "", "0", 0, -1, 1.5, "8453x", "0x", {}, []]) {
    assertEquals(
      chains.normalizeEvmChainId(value),
      null,
      `Malformed chain ID must fail closed: ${String(value)}`,
    );
  }

  assertEquals(chains.getProductChainById("0x1237")?.name, "Robinhood Chain");
  assertEquals(chains.getProductChainById(1), null);
  assert(Object.isFrozen(chains.currentProductChain), "Chain definitions must be immutable.");
  assert(
    Object.isFrozen(chains.currentProductChain.nativeCurrency),
    "Nested currency definitions must be immutable.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Product chain registry checks passed.");
