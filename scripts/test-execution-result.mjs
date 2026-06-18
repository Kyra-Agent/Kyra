import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-execution-result-test");
const outputPath = resolve(outDir, "executionResult.mjs");

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
    .replace(/import\s+\{\s*isTransactionHash\s*\}\s+from\s+"\.\/walletSigning";/s, "");
}

mkdirSync(outDir, { recursive: true });

const executionResultSource = loadSource("src/types/executionResult.ts");
const source = `
function isTransactionHash(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/u.test(value);
}

${executionResultSource}
`;
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    formatExecutionResultForActivity,
    sanitizeExecutionFailureReason,
    transitionExecutionResult,
    validateExecutionResultRecord,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const hash = `0x${"b".repeat(64)}`;
  const baseRecord = {
    id: "execution_demo",
    preparedActionId: "prepared_demo",
    workspaceId: "workspace_demo",
    agentId: "agent_demo",
    ownerUserId: "owner_demo",
    createdAt: "2026-06-18T00:00:00.000Z",
    updatedAt: "2026-06-18T00:00:01.000Z",
    publicSummary: "Owner-only execution state.",
    visibleInPublicProfile: false,
  };

  assertEquals(
    transitionExecutionResult({
      status: "pending",
      event: "approve",
      ownerAction: true,
    }).status,
    "approved",
  );
  assertEquals(
    transitionExecutionResult({
      status: "pending",
      event: "approve",
    }).ok,
    false,
    "Approval must require explicit owner action.",
  );
  assertEquals(
    transitionExecutionResult({
      status: "pending",
      event: "reject",
      txHash: hash,
    }).ok,
    false,
    "Rejected actions must not carry a transaction hash.",
  );
  assertEquals(
    transitionExecutionResult({
      status: "approved",
      event: "submit",
      txHash: hash,
    }).status,
    "submitted",
  );
  assertEquals(
    transitionExecutionResult({
      status: "approved",
      event: "submit",
    }).ok,
    false,
    "Submitted actions require a transaction hash.",
  );
  assertEquals(
    transitionExecutionResult({
      status: "submitted",
      event: "confirm",
      txHash: hash,
      confirmationId: "base:receipt:demo",
    }).status,
    "confirmed",
  );
  assertEquals(
    transitionExecutionResult({
      status: "submitted",
      event: "fail",
      txHash: hash,
      failureCode: "confirmation_timeout",
    }).sanitizedFailureReason,
    "Transaction confirmation was not observed in time.",
  );
  assertEquals(
    sanitizeExecutionFailureReason("unknown"),
    "Execution failed safely.",
  );

  assert(
    validateExecutionResultRecord({
      ...baseRecord,
      status: "pending",
      txHash: hash,
    }).errors.includes("Transaction hash is only allowed after submission."),
    "Pending records must not store transaction hashes.",
  );
  assert(
    validateExecutionResultRecord({
      ...baseRecord,
      status: "submitted",
    }).errors.includes("Submitted execution results require a transaction hash."),
    "Submitted records require tx hash.",
  );
  assert(
    validateExecutionResultRecord({
      ...baseRecord,
      status: "confirmed",
      txHash: hash,
      confirmationId: "base:receipt:demo",
    }).ok,
    "Confirmed record with tx hash and confirmation id should pass.",
  );
  assert(
    validateExecutionResultRecord({
      ...baseRecord,
      status: "failed",
      sanitizedFailureReason: "provider rpc failed at https://example.test",
    }).ok,
    "Sanitized provider copy should pass when it does not expose secrets.",
  );
  assert(
    !validateExecutionResultRecord({
      ...baseRecord,
      status: "failed",
      sanitizedFailureReason: `private key 0x${"a".repeat(64)}`,
    }).ok,
    "Sensitive-looking failure text must be rejected.",
  );
  assert(
    !validateExecutionResultRecord({
      ...baseRecord,
      status: "confirmed",
      txHash: hash,
      confirmationId: "base:receipt:demo",
      visibleInPublicProfile: true,
    }).ok,
    "Execution results must stay owner-only.",
  );
  assertEquals(
    formatExecutionResultForActivity({
      ...baseRecord,
      status: "confirmed",
      txHash: hash,
      confirmationId: "base:receipt:demo",
    }),
    "confirmed tx 0xbbbbbb...bbbbbb",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Execution result checks passed.");
