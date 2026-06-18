import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-risk-review-test");
const outputPath = resolve(outDir, "riskReview.mjs");

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

function loadSource(path) {
  return readFileSync(resolve(root, path), "utf8")
    .replace(/import\s+[^;]+from\s+"\.\/unsignedTransactionHandoff";/s, "");
}

mkdirSync(outDir, { recursive: true });

const unsignedSource = readFileSync(
  resolve(root, "src/types/unsignedTransactionHandoff.ts"),
  "utf8",
);
const riskSource = loadSource("src/types/riskReview.ts");
const source = `${unsignedSource}\n${riskSource}`;
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    baseChainId,
    reviewPreparedActionRisk,
    reviewUnsignedTransactionHandoff,
    validateUnsignedTransactionHandoff,
    walletUnsignedTransactionHandoffVersion,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const baseHandoff = {
    version: walletUnsignedTransactionHandoffVersion,
    preparedActionId: "prepared_demo",
    ownerUserId: "owner_demo",
    workspaceId: "workspace_demo",
    agentId: "agent_demo",
    actionKind: "base_reviewed_transaction",
    chainId: baseChainId,
    chainName: "Base",
    to: "0x1111111111111111111111111111111111111111",
    valueWei: "0",
    data: "0x",
    gasPayer: "connected_wallet",
    routeSummary: "USDC -> WETH review route on Base",
    valueSummary: "Demo review only. No token spend is sent.",
    risk: "medium",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  };

  const review = reviewUnsignedTransactionHandoff(
    baseHandoff,
    validateUnsignedTransactionHandoff(baseHandoff),
  );
  assertEquals(review.level, "medium");
  assertEquals(review.status, "review_required");
  assert(
    review.explicitApprovalRequired,
    "Wallet review must require approval.",
  );
  assert(
    review.permissions.includes("wallet_prompt"),
    "Wallet prompt permission must be visible.",
  );
  assert(
    review.permissions.includes("token_spend"),
    "Token spend permission must be visible for swap review copy.",
  );
  assert(
    review.checks.some((check) => check.includes("NYX-05")),
    "NYX-05 check must be visible.",
  );

  const readOnly = reviewPreparedActionRisk({
    actionKind: "base_mcp_status_check",
    chainId: baseChainId,
    routeSummary: "Base MCP status check",
    valueSummary: "No token spend, no gas request, no calldata.",
    valueWei: "0",
    data: "0x",
    requiresWallet: false,
  });
  assertEquals(readOnly.level, "read-only");
  assertEquals(readOnly.status, "ready");
  assertEquals(readOnly.explicitApprovalRequired, false);
  assertEquals(readOnly.permissions.join(","), "read_context");

  const blockedUnknown = reviewPreparedActionRisk({
    actionKind: "arbitrary_contract_call",
    chainId: baseChainId,
    routeSummary: "Unknown contract call",
    valueSummary: "Unknown value",
    valueWei: "0",
    data: "0x1234",
    requiresWallet: true,
  });
  assertEquals(blockedUnknown.level, "blocked");
  assertEquals(blockedUnknown.status, "blocked");
  assert(
    blockedUnknown.refusalReason.includes("Unsupported action type"),
    "Unsupported actions must fail closed.",
  );

  const highRisk = reviewPreparedActionRisk({
    actionKind: "base_reviewed_transaction",
    chainId: baseChainId,
    routeSummary: "Contract approval calldata",
    valueSummary: "Spend 1 ETH",
    valueWei: "1",
    data: "0x1234",
    requiresWallet: true,
  });
  assertEquals(highRisk.level, "high");
  assertEquals(highRisk.status, "review_required");
  assert(highRisk.permissions.includes("contract_call"));
  assert(highRisk.permissions.includes("token_spend"));

  const wrongChain = reviewPreparedActionRisk({
    actionKind: "base_reviewed_transaction",
    chainId: 1,
    routeSummary: "Ethereum mainnet route",
    valueSummary: "No token spend.",
    valueWei: "0",
    data: "0x",
    requiresWallet: true,
  });
  assertEquals(wrongChain.level, "blocked");
  assertEquals(wrongChain.refusalReason, "Prepared action must target Base.");
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Risk review checks passed.");
