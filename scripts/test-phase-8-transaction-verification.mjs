import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-transaction-verification-test");
const outputPath = resolve(outDir, "phase8TransactionVerification.mjs");

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

function stripImports(source) {
  return source.replace(/import\s+\{[\s\S]*?\}\s+from\s+"\.\/walletSigning";\n?/gu, "");
}

mkdirSync(outDir, { recursive: true });

const productChainsSource = readFileSync(resolve(root, "src/config/productChains.ts"), "utf8");
const walletSigningSource = readFileSync(
  resolve(root, "src/types/walletSigning.ts"),
  "utf8",
).replace(
  /import \{[\s\S]*?\} from "\.\.\/config\/productChains";/u,
  "",
);
const source = stripImports(readFileSync(resolve(root, "src/types/phase8TransactionVerification.ts"), "utf8"));
const transpiled = ts.transpileModule(`${productChainsSource}\n${walletSigningSource}\n${source}`, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    evaluatePhase8TransactionVerification,
    getPhase8TransactionVerificationBlockMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const txHash = "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
  const baseInput = {
    ownerUserId: "owner_22",
    workspaceId: "workspace_22",
    agentId: "agent_777",
    preparedActionId: "phase8_request",
    txHash,
    receiptStatus: null,
    receiptLoading: true,
    receiptError: false,
    visibleInPublicProfile: false,
  };

  const notStarted = evaluatePhase8TransactionVerification({
    ...baseInput,
    txHash: null,
    receiptLoading: false,
  });
  assertEquals(notStarted.status, "not_started");
  assertEquals(notStarted.canPromoteToConfirmed, false);

  const invalidHash = evaluatePhase8TransactionVerification({
    ...baseInput,
    txHash: "0x1234",
    receiptLoading: false,
  });
  assertEquals(invalidHash.status, "blocked");
  assert(invalidHash.reasons.includes("transaction_hash_required"));

  const pending = evaluatePhase8TransactionVerification(baseInput);
  assertEquals(pending.status, "pending_receipt");
  assert(pending.reasons.includes("receipt_pending"));

  const confirmed = evaluatePhase8TransactionVerification({
    ...baseInput,
    receiptStatus: "success",
    receiptLoading: false,
  });
  assertEquals(confirmed.status, "confirmed");
  assertEquals(confirmed.canPromoteToConfirmed, true);
  assert(confirmed.confirmationId.startsWith("base-receipt-"));
  assertEquals(confirmed.txHashLabel, "0xeeeeeeee...eeeeeeee");

  const reverted = evaluatePhase8TransactionVerification({
    ...baseInput,
    receiptStatus: "reverted",
    receiptLoading: false,
  });
  assertEquals(reverted.status, "failed");
  assert(reverted.reasons.includes("receipt_reverted"));
  assertEquals(
    reverted.sanitizedFailureReason,
    "Transaction receipt shows a reverted transaction.",
  );

  const unavailable = evaluatePhase8TransactionVerification({
    ...baseInput,
    receiptLoading: false,
    receiptError: true,
  });
  assertEquals(unavailable.status, "failed");
  assert(unavailable.reasons.includes("receipt_unavailable"));

  const publicResult = evaluatePhase8TransactionVerification({
    ...baseInput,
    receiptStatus: "success",
    receiptLoading: false,
    visibleInPublicProfile: true,
  });
  assert(publicResult.reasons.includes("public_visibility_forbidden"));

  assertEquals(
    getPhase8TransactionVerificationBlockMessage("receipt_reverted"),
    "Transaction receipt shows a reverted transaction.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 transaction verification checks passed.");
