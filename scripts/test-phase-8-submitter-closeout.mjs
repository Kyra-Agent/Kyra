import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-submitter-closeout-test");
const outputPath = resolve(outDir, "phase8SubmitterCloseout.mjs");

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
  readFileSync(resolve(root, "src/types/phase8SubmitterCloseout.ts"), "utf8"),
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
    createPhase8SubmittedCloseoutEvent,
    getPhase8SubmitterCloseoutFailureMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const hash =
    "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
  const baselineInput = {
    ownerUserId: "owner_8",
    workspaceId: "workspace_8",
    agentId: "agent_777",
    preparedActionId: "phase8_request",
    submissionNonce: "phase8-submit-nonce",
    txHash: hash,
    createdAt: "2026-07-05T00:00:00.000Z",
  };

  const ok = createPhase8SubmittedCloseoutEvent(baselineInput);
  assertEquals(ok.ok, true);
  assert(ok.event, "closeout event should be returned");
  assertEquals(ok.event.state, "submitted");
  assertEquals(ok.event.ownerOnly, true);
  assertEquals(ok.event.sanitized, true);
  assertEquals(ok.event.txHash, hash);
  assertEquals(ok.event.message, "Submitted with sanitized hash reference.");

  const missingScope = createPhase8SubmittedCloseoutEvent({
    ...baselineInput,
    ownerUserId: "",
  });
  assertEquals(missingScope.ok, false);
  assertEquals(missingScope.reason, "owner_scope_required");
  assertEquals(missingScope.event, null);

  const missingPreparedAction = createPhase8SubmittedCloseoutEvent({
    ...baselineInput,
    preparedActionId: "",
  });
  assertEquals(missingPreparedAction.reason, "prepared_action_required");

  const missingNonce = createPhase8SubmittedCloseoutEvent({
    ...baselineInput,
    submissionNonce: "",
  });
  assertEquals(missingNonce.reason, "submission_nonce_required");

  const invalidHash = createPhase8SubmittedCloseoutEvent({
    ...baselineInput,
    txHash: "0x1234",
  });
  assertEquals(invalidHash.reason, "transaction_hash_required");

  assertEquals(
    getPhase8SubmitterCloseoutFailureMessage("submission_nonce_required"),
    "Submission nonce is required before recording closeout.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 submitter closeout checks passed.");
