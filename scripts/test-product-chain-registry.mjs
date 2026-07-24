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
  if (actual !== expected) throw new Error(message ?? `Expected ${expected}, received ${actual}.`);
}

mkdirSync(outDir, { recursive: true });
const source = readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ES2020, target: ts.ScriptTarget.ES2020 },
});
writeFileSync(outputPath, transpiled.outputText);

try {
  const chains = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  assertEquals(chains.productChains.length, 2);
  assertEquals(chains.currentProductChain.key, "robinhood_mainnet");
  assertEquals(chains.currentProductChain.id, 4663);
  assertEquals(chains.currentProductChain.hexId, "0x1237");
  assertEquals(chains.robinhoodTestnetChain.key, "robinhood_testnet");
  assertEquals(chains.robinhoodTestnetChain.id, 46630);
  assertEquals(chains.robinhoodTestnetChain.hexId, "0xb626");

  assertEquals(chains.selectProductChainForRuntime({
    mode: "robinhood-testnet",
    requestedTarget: "robinhood_testnet",
    testnetWindow: "owner_testnet_window",
  }).key, "robinhood_testnet");
  assertEquals(chains.selectProductChainForRuntime({
    mode: "robinhood-mainnet",
    requestedTarget: "robinhood_mainnet",
    testnetWindow: "disabled",
    mainnetWindow: "owner_mainnet_cutover",
    releaseApproval: "owner_release_approved",
  }).key, "robinhood_mainnet");

  for (const incomplete of [
    { mode: "production", requestedTarget: "", testnetWindow: "disabled" },
    { mode: "robinhood-testnet", requestedTarget: "robinhood_testnet", testnetWindow: "disabled" },
    { mode: "robinhood-mainnet", requestedTarget: "robinhood_mainnet", testnetWindow: "disabled", mainnetWindow: "owner_mainnet_cutover", releaseApproval: "disabled" },
  ]) {
    assertEquals(
      chains.selectProductChainForRuntime(incomplete).key,
      "robinhood_mainnet",
      "Incomplete selection must fail closed to Robinhood Chain mainnet product identity.",
    );
  }

  for (const value of [4663, "4663", "0x1237", " 0X1237 ", 4663n]) {
    assertEquals(chains.normalizeEvmChainId(value), 4663);
    assert(chains.isCurrentProductChainId(value), "Robinhood mainnet chain form must pass.");
    assert(chains.isMigrationTargetChainId(value), "Robinhood mainnet target form must pass.");
  }

  for (const value of [46630, "46630", "0xb626", 46630n]) {
    assertEquals(chains.getProductChainById(value)?.key, "robinhood_testnet");
  }

  for (const value of [8453, "8453", "0x2105", null, undefined, "", "0", 0, -1, 1.5, "4663x", "0x", {}, []]) {
    if (value === 8453 || value === "8453" || value === "0x2105") {
      assertEquals(chains.getProductChainById(value), null, "Legacy networks must not resolve.");
    } else {
      assertEquals(chains.normalizeEvmChainId(value), null, `Malformed chain ID must fail closed: ${String(value)}`);
    }
  }

  assertEquals(chains.getProductChainByKey("robinhood_mainnet")?.id, 4663);
  assertEquals(chains.getProductChainByKey("legacy"), null);
  assert(Object.isFrozen(chains.currentProductChain), "Chain definitions must be immutable.");
  assert(Object.isFrozen(chains.currentProductChain.nativeCurrency), "Nested currency definitions must be immutable.");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Robinhood-only product chain registry checks passed.");