import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-funding-readiness-test");
const outputPath = resolve(outDir, "phase8FundingReadiness.mjs");

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${expected}, received ${actual}.`);
  }
}

mkdirSync(outDir, { recursive: true });

const source = readFileSync(resolve(root, "src/types/phase8FundingReadiness.ts"), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    evaluatePhase8FundingReadiness,
    formatPhase8BaseEth,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const baseInput = {
    walletConnected: true,
    baseAccountAddress: "0x1111111111111111111111111111111111111111",
    isLoading: false,
    isError: false,
    value: 1_230_000_000_000_000n,
  };

  const funded = evaluatePhase8FundingReadiness(baseInput);
  assertEquals(funded.status, "funded");
  assertEquals(funded.canOpenSubmitter, true);
  assertEquals(funded.label, "0.00123 ETH");
  assert(funded.privacyBoundary.includes("never stores private keys"));
  assert(funded.privacyBoundary.includes("never asks Telegram or public profiles"));

  const empty = evaluatePhase8FundingReadiness({ ...baseInput, value: 0n });
  assertEquals(empty.status, "empty");
  assertEquals(empty.canOpenSubmitter, false);
  assert(empty.message.includes("zero-value"));
  assert(empty.ownerAction.includes("Base ETH"));

  const walletRequired = evaluatePhase8FundingReadiness({
    ...baseInput,
    walletConnected: false,
  });
  assertEquals(walletRequired.status, "wallet_required");
  assertEquals(walletRequired.canOpenSubmitter, false);

  const addressRequired = evaluatePhase8FundingReadiness({
    ...baseInput,
    baseAccountAddress: null,
  });
  assertEquals(addressRequired.status, "address_required");

  const checking = evaluatePhase8FundingReadiness({
    ...baseInput,
    isLoading: true,
  });
  assertEquals(checking.status, "checking");

  const unavailable = evaluatePhase8FundingReadiness({
    ...baseInput,
    isError: true,
  });
  assertEquals(unavailable.status, "unavailable");

  const robinhoodEmpty = evaluatePhase8FundingReadiness({
    ...baseInput,
    value: 0n,
    networkName: "Robinhood Chain Testnet",
    walletDisplayName: "Robinhood Chain Testnet wallet",
    gasDisplayName: "Robinhood Chain Testnet ETH",
  });
  assert(robinhoodEmpty.message.includes("Robinhood Chain Testnet"));
  assert(robinhoodEmpty.ownerAction.includes("Robinhood Chain Testnet wallet"));

  assertEquals(formatPhase8BaseEth(1_000_000_000_000_000_000n), "1");
  assertEquals(formatPhase8BaseEth(12_345_678_900_000_000n), "0.012345");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 funding readiness checks passed.");
