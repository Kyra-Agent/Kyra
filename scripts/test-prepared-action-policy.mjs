import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-prepared-action-policy-test");
const outputPath = resolve(outDir, "preparedActionPolicy.mjs");

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

function stripImport(source, specifier) {
  const escaped = specifier.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return source.replace(
    new RegExp(`import\\s+\\{[\\s\\S]*?\\}\\s+from\\s+"${escaped}";`, "u"),
    "",
  );
}

mkdirSync(outDir, { recursive: true });

const unsignedSource = readFileSync(
  resolve(root, "src/types/unsignedTransactionHandoff.ts"),
  "utf8",
);
const preparedSource = stripImport(
  readFileSync(resolve(root, "src/types/preparedAction.ts"), "utf8"),
  "./unsignedTransactionHandoff",
);
const riskSource = stripImport(
  readFileSync(resolve(root, "src/types/riskReview.ts"), "utf8"),
  "./unsignedTransactionHandoff",
);
const policySource = stripImport(
  stripImport(
    readFileSync(resolve(root, "src/types/preparedActionPolicy.ts"), "utf8"),
    "./preparedAction",
  ),
  "./riskReview",
);
const transpiled = ts.transpileModule(
  `${unsignedSource}\n${preparedSource}\n${riskSource}\n${policySource}`,
  {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
    },
  },
);

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    baseChainId,
    evaluatePreparedActionPolicy,
    getPreparedActionPolicyBlockMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const baseReviewInput = {
    source: "owner_dashboard",
    walletExecutionEnabled: true,
    ownerSignedIn: true,
    selectedAgent: true,
    preparedActionStorageEnabled: true,
    ownerApprovalRecorded: true,
    actionKind: "base_reviewed_transaction",
    chainId: baseChainId,
    recipient: "0x1111111111111111111111111111111111111111",
    valueWei: "0",
    data: "0x",
    routeSummary: "Owner reviewed Base transaction preview.",
    valueSummary: "No token spend in this policy test.",
  };

  const readOnly = evaluatePreparedActionPolicy({
    source: "owner_dashboard",
    walletExecutionEnabled: false,
    ownerSignedIn: true,
    selectedAgent: true,
    preparedActionStorageEnabled: false,
    ownerApprovalRecorded: false,
    actionKind: "base_mcp_status_check",
    chainId: baseChainId,
  });
  assertEquals(readOnly.status, "read_only_ready");
  assertEquals(readOnly.allowedForStorage, false);
  assertEquals(readOnly.riskReview.level, "read-only");

  const readyForOwnerReview = evaluatePreparedActionPolicy(baseReviewInput);
  assertEquals(readyForOwnerReview.status, "owner_review_required");
  assertEquals(readyForOwnerReview.allowedForStorage, true);
  assertEquals(readyForOwnerReview.riskReview.status, "ready");

  const noSession = evaluatePreparedActionPolicy({
    ...baseReviewInput,
    ownerSignedIn: false,
  });
  assertEquals(noSession.status, "blocked");
  assert(noSession.reasons.includes("owner_session_required"));

  const telegram = evaluatePreparedActionPolicy({
    ...baseReviewInput,
    source: "telegram",
  });
  assertEquals(telegram.status, "blocked");
  assert(
    telegram.reasons.includes("allowlist_rejected"),
    "Telegram must not create prepared actions.",
  );
  assert(telegram.allowlist.reasons.includes("untrusted_source"));

  const storageDisabled = evaluatePreparedActionPolicy({
    ...baseReviewInput,
    preparedActionStorageEnabled: false,
  });
  assertEquals(storageDisabled.status, "blocked");
  assert(storageDisabled.reasons.includes("prepared_action_storage_disabled"));

  const ownerApprovalMissing = evaluatePreparedActionPolicy({
    ...baseReviewInput,
    ownerApprovalRecorded: false,
  });
  assertEquals(ownerApprovalMissing.status, "blocked");
  assert(ownerApprovalMissing.reasons.includes("owner_approval_required"));

  const riskBlocked = evaluatePreparedActionPolicy({
    ...baseReviewInput,
    chainId: 1,
  });
  assertEquals(riskBlocked.status, "blocked");
  assert(riskBlocked.reasons.includes("allowlist_rejected"));

  assertEquals(
    getPreparedActionPolicyBlockMessage("prepared_action_storage_disabled"),
    "Prepared-action production storage is disabled until the owner-scoped storage gate is enabled.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Prepared action policy checks passed.");
