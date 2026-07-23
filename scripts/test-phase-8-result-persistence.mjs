import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-result-persistence-test");
const outputPath = resolve(outDir, "phase8ResultPersistence.mjs");

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
  return source
    .replace(/import\s+type\s+\{[\s\S]*?\}\s+from\s+"\.\/[^"]+";\n?/gu, "")
    .replace(/import\s+\{[\s\S]*?\}\s+from\s+"\.\/walletSigning";\n?/gu, "");
}

mkdirSync(outDir, { recursive: true });

const productChainsSource = readFileSync(
  resolve(root, "src/config/productChains.ts"),
  "utf8",
);
const walletSigningSource = readFileSync(
  resolve(root, "src/types/walletSigning.ts"),
  "utf8",
).replace(
  /import \{[\s\S]*?\} from "\.\.\/config\/productChains";/u,
  "",
);
const source = stripImports(
  readFileSync(resolve(root, "src/types/phase8ResultPersistence.ts"), "utf8"),
);
const transpiled = ts.transpileModule(`${productChainsSource}\n${walletSigningSource}\n${source}`, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    createPhase8PersistedExecutionResult,
    getPhase8ResultPersistenceFailureMessage,
    mapPhase8PersistedResultToDemoExecutionResult,
    reconcilePhase8PersistedExecutionResult,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const txHash =
    "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc";
  const event = {
    state: "submitted",
    ownerOnly: true,
    sanitized: true,
    txHash,
    message: "Submitted with sanitized hash reference.",
    createdAt: "2026-07-05T01:00:00.000Z",
  };
  const baseInput = {
    ownerUserId: "owner_13",
    workspaceId: "workspace_13",
    agentId: "agent_777",
    preparedActionId: "phase8_request",
    submissionNonce: "phase8-submit-nonce",
    event,
  };

  const persisted = createPhase8PersistedExecutionResult(baseInput);
  assertEquals(persisted.ok, true);
  assert(persisted.record, "record should be created");
  assertEquals(persisted.record.visibility, "owner-only");
  assertEquals(persisted.record.status, "submitted");
  assertEquals(persisted.record.txHash, txHash);
  assertEquals(persisted.record.txHashLabel, "0xcccccccc...cccccccc");

  const demo = mapPhase8PersistedResultToDemoExecutionResult(persisted.record);
  assertEquals(demo.visibility, "owner-only");
  assertEquals(demo.status, "submitted");
  assertEquals(demo.txHashLabel, "0xcccccccc...cccccccc");

  const reconciledConfirmed = reconcilePhase8PersistedExecutionResult(
    persisted.record,
    "success",
    "2026-07-05T01:05:00.000Z",
  );
  assertEquals(reconciledConfirmed.status, "confirmed");
  assertEquals(reconciledConfirmed.failureReason, null);
  assertEquals(reconciledConfirmed.updatedAt, "2026-07-05T01:05:00.000Z");

  const reconciledFailed = reconcilePhase8PersistedExecutionResult(
    persisted.record,
    "reverted",
    "2026-07-05T01:06:00.000Z",
  );
  assertEquals(reconciledFailed.status, "failed");
  assertEquals(
    reconciledFailed.failureReason,
    "Controlled transaction reverted without exposing provider internals.",
  );
  const confirmed = createPhase8PersistedExecutionResult({
    ...baseInput,
    event: { ...event, state: "confirmed" },
  });
  assertEquals(confirmed.record.status, "confirmed");
  assertEquals(confirmed.record.failureReason, null);

  const failed = createPhase8PersistedExecutionResult({
    ...baseInput,
    event: { ...event, state: "failed" },
  });
  assertEquals(failed.record.status, "failed");
  assertEquals(
    failed.record.failureReason,
    "Controlled submit failed safely after provider response.",
  );

  const missingScope = createPhase8PersistedExecutionResult({
    ...baseInput,
    ownerUserId: "",
  });
  assertEquals(missingScope.reason, "owner_scope_required");

  const publicEvent = createPhase8PersistedExecutionResult({
    ...baseInput,
    event: { ...event, ownerOnly: false },
  });
  assertEquals(publicEvent.reason, "owner_only_required");

  const unsafeEvent = createPhase8PersistedExecutionResult({
    ...baseInput,
    event: { ...event, sanitized: false },
  });
  assertEquals(unsafeEvent.reason, "sanitized_event_required");

  const unsupportedState = createPhase8PersistedExecutionResult({
    ...baseInput,
    event: { ...event, state: "ready" },
  });
  assertEquals(unsupportedState.reason, "unsupported_state");

  const invalidHash = createPhase8PersistedExecutionResult({
    ...baseInput,
    event: { ...event, txHash: "0x1234" },
  });
  assertEquals(invalidHash.reason, "transaction_hash_required");

  assertEquals(
    getPhase8ResultPersistenceFailureMessage("owner_only_required"),
    "Execution result persistence must stay owner-only.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 result persistence checks passed.");
