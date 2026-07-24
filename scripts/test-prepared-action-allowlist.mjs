import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-prepared-action-allowlist-test");
const outputPath = resolve(outDir, "preparedAction.mjs");

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

const unsignedSource = readFileSync(
  resolve(root, "src/types/unsignedTransactionHandoff.ts"),
  "utf8",
).replace(
  'import { currentProductChain } from "../config/productChains";',
  'const currentProductChain = Object.freeze({ id: 4663, name: "Robinhood Chain" });',
);
const preparedSource = readFileSync(
  resolve(root, "src/types/preparedAction.ts"),
  "utf8",
).replace(
  'import { currentProductChain } from "../config/productChains";',
  "",
).replace(
  /import\s+\{[\s\S]*?\}\s+from\s+"\.\/unsignedTransactionHandoff";/u,
  "",
);
const transpiled = ts.transpileModule(`${unsignedSource}\n${preparedSource}`, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    productChainId,
    isPreparedActionAllowedKind,
    preparedActionAllowedKinds,
    reviewPreparedActionAllowlist,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  assertEquals(preparedActionAllowedKinds.length, 2);
  assert(isPreparedActionAllowedKind("chain_status_check"));
  assert(isPreparedActionAllowedKind("robinhood_reviewed_transaction"));
  assert(!isPreparedActionAllowedKind("swap_any_token"));

  const statusCheck = reviewPreparedActionAllowlist({
    source: "owner_dashboard",
    walletExecutionEnabled: false,
    actionKind: "chain_status_check",
    chainId: productChainId,
  });
  assert(statusCheck.allowed, "Read-only status check should be allowed.");
  assertEquals(statusCheck.risk, "read-only");
  assertEquals(statusCheck.requiresWallet, false);
  assertEquals(statusCheck.canonical.valueWei, "0");
  assertEquals(statusCheck.canonical.data, "0x");

  const ownerPreview = reviewPreparedActionAllowlist({
    source: "owner_dashboard",
    walletExecutionEnabled: true,
    actionKind: "robinhood_reviewed_transaction",
    chainId: productChainId,
    recipient: "0x1111111111111111111111111111111111111111",
    valueWei: "0",
    data: "0x",
    routeSummary: "Owner reviewed Robinhood Chain transaction preview.",
    valueSummary: "No token spend in this Phase 7F preview.",
  });
  assert(ownerPreview.allowed, "Owner dashboard zero-value preview should pass.");
  assertEquals(ownerPreview.risk, "review");
  assertEquals(ownerPreview.requiresWallet, true);
  assertEquals(ownerPreview.canonical.chain, "Robinhood Chain");

  const telegram = reviewPreparedActionAllowlist({
    ...ownerPreview.canonical,
    source: "telegram",
    walletExecutionEnabled: true,
    actionKind: "robinhood_reviewed_transaction",
    chainId: productChainId,
  });
  assert(!telegram.allowed, "Telegram must not create prepared actions.");
  assert(telegram.reasons.includes("untrusted_source"));

  const disabled = reviewPreparedActionAllowlist({
    source: "owner_dashboard",
    walletExecutionEnabled: false,
    actionKind: "robinhood_reviewed_transaction",
    chainId: productChainId,
    recipient: "0x1111111111111111111111111111111111111111",
    valueWei: "0",
    data: "0x",
    routeSummary: "Owner reviewed Robinhood Chain transaction preview.",
    valueSummary: "No token spend in this Phase 7F preview.",
  });
  assert(!disabled.allowed, "Value-moving action must obey runtime wallet gate.");
  assert(disabled.reasons.includes("wallet_execution_disabled"));

  const tokenSpend = reviewPreparedActionAllowlist({
    source: "owner_dashboard",
    walletExecutionEnabled: true,
    actionKind: "robinhood_reviewed_transaction",
    chainId: productChainId,
    recipient: "0x1111111111111111111111111111111111111111",
    valueWei: "1",
    data: "0x",
    routeSummary: "Owner reviewed Robinhood Chain transaction preview.",
    valueSummary: "Spend one wei.",
  });
  assert(!tokenSpend.allowed, "Phase 7F must not allow token spend.");
  assert(tokenSpend.reasons.includes("token_spend_not_allowed"));

  const calldata = reviewPreparedActionAllowlist({
    source: "owner_dashboard",
    walletExecutionEnabled: true,
    actionKind: "robinhood_reviewed_transaction",
    chainId: productChainId,
    recipient: "0x1111111111111111111111111111111111111111",
    valueWei: "0",
    data: "0x1234",
    routeSummary: "Owner reviewed Robinhood Chain transaction preview.",
    valueSummary: "No token spend.",
  });
  assert(!calldata.allowed, "Phase 7F must not allow calldata.");
  assert(calldata.reasons.includes("calldata_not_allowed"));

  const wrongChain = reviewPreparedActionAllowlist({
    source: "owner_dashboard",
    walletExecutionEnabled: true,
    actionKind: "robinhood_reviewed_transaction",
    chainId: 1,
    recipient: "0x1111111111111111111111111111111111111111",
    valueWei: "0",
    data: "0x",
    routeSummary: "Owner reviewed Ethereum transaction preview.",
    valueSummary: "No token spend.",
  });
  assert(!wrongChain.allowed, "Unsupported-chain action must fail closed.");
  assert(wrongChain.reasons.includes("product_chain_required"));
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Prepared action allowlist checks passed.");
