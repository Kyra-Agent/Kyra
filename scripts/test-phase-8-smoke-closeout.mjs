import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-smoke-closeout-test");
const outputPath = resolve(outDir, "phase8SmokeCloseout.mjs");

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
const source = stripImports(readFileSync(resolve(root, "src/types/phase8SmokeCloseout.ts"), "utf8"));
const transpiled = ts.transpileModule(`${productChainsSource}\n${walletSigningSource}\n${source}`, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    evaluatePhase8SmokeCloseout,
    getPhase8SmokeCloseoutBlockMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const txHash = "0xdddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd";
  const baselineInput = {
    ownerUserId: "owner_15",
    workspaceId: "workspace_15",
    agentId: "agent_777",
    preparedActionId: "phase8_request",
    status: "submitted",
    ownerOnly: true,
    txHash,
    confirmationId: null,
    sanitizedFailureReason: null,
    visibleInPublicProfile: false,
  };

  const submitted = evaluatePhase8SmokeCloseout(baselineInput);
  assertEquals(submitted.status, "submitted_pending_confirmation");
  assertEquals(submitted.canContinueToPublicHardening, false);
  assertEquals(submitted.txHashLabel, "0xdddddddd...dddddddd");

  const confirmed = evaluatePhase8SmokeCloseout({
    ...baselineInput,
    status: "confirmed",
    confirmationId: "base:block:123",
  });
  assertEquals(confirmed.status, "closed_confirmed");
  assertEquals(confirmed.canContinueToPublicHardening, true);
  assertEquals(confirmed.confirmationLabel, "recorded");

  const failed = evaluatePhase8SmokeCloseout({
    ...baselineInput,
    status: "failed",
    sanitizedFailureReason: "Execution failed safely.",
  });
  assertEquals(failed.status, "closed_failed");
  assertEquals(failed.canContinueToPublicHardening, true);

  const aborted = evaluatePhase8SmokeCloseout({
    ...baselineInput,
    status: "aborted",
    txHash: null,
  });
  assertEquals(aborted.status, "closed_aborted");
  assertEquals(aborted.canContinueToPublicHardening, true);

  const noScope = evaluatePhase8SmokeCloseout({ ...baselineInput, ownerUserId: "" });
  assert(noScope.reasons.includes("owner_scope_required"));

  const publicResult = evaluatePhase8SmokeCloseout({
    ...baselineInput,
    visibleInPublicProfile: true,
  });
  assert(publicResult.reasons.includes("public_visibility_forbidden"));

  const missingHash = evaluatePhase8SmokeCloseout({ ...baselineInput, txHash: null });
  assert(missingHash.reasons.includes("transaction_hash_required"));

  const missingConfirmation = evaluatePhase8SmokeCloseout({
    ...baselineInput,
    status: "confirmed",
    confirmationId: "",
  });
  assert(missingConfirmation.reasons.includes("confirmation_required"));

  const unsafeFailure = evaluatePhase8SmokeCloseout({
    ...baselineInput,
    status: "failed",
    sanitizedFailureReason: "",
  });
  assert(unsafeFailure.reasons.includes("sanitized_failure_required"));

  assertEquals(
    getPhase8SmokeCloseoutBlockMessage("owner_only_required"),
    "Controlled smoke closeout must stay owner-only.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 smoke closeout checks passed.");
