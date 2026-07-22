import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-low-value-readiness-test");
const outputPath = resolve(outDir, "phase8LowValueTransactionReadiness.mjs");

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

const source = readFileSync(
  resolve(root, "src/types/phase8LowValueTransactionReadiness.ts"),
  "utf8",
).replace(
  'import { baseChainId } from "./unsignedTransactionHandoff";',
  "const baseChainId = 8453;",
);
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    evaluatePhase8LowValueTransactionReadiness,
    getPhase8LowValueTransactionReadinessBlockMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const baseInput = {
    ownerSignedIn: true,
    privateDashboard: true,
    selectedAgent: true,
    baseAccountConnected: true,
    chainId: 8453,
    preparedActionId: "phase8_low_value_request",
    ownerApprovalRecorded: true,
    requestedValueWei: "100000000000000",
    estimatedGasFeeWei: "10000000000000",
    availableGasBalanceWei: "110000000000000",
    data: "0x",
    includesTokenApproval: false,
    includesSwap: false,
    requestedFromTelegram: false,
    visibleInPublicProfile: false,
  };

  const ready = evaluatePhase8LowValueTransactionReadiness(baseInput);
  assertEquals(ready.status, "ready_for_low_value_review");
  assertEquals(ready.canEnterLowValueReview, true);
  assertEquals(ready.maxValueWei, "100000000000000");
  assertEquals(ready.maxValueLabel, "0.0001 ETH");
  assertEquals(ready.requiredBalanceWei, "110000000000000");

  const noOwner = evaluatePhase8LowValueTransactionReadiness({
    ...baseInput,
    ownerSignedIn: false,
  });
  assert(noOwner.reasons.includes("owner_session_required"));

  const missingApproval = evaluatePhase8LowValueTransactionReadiness({
    ...baseInput,
    ownerApprovalRecorded: false,
  });
  assert(missingApproval.reasons.includes("owner_approval_required"));

  const zeroValue = evaluatePhase8LowValueTransactionReadiness({
    ...baseInput,
    requestedValueWei: "0",
  });
  assert(zeroValue.reasons.includes("value_required"));

  const overCap = evaluatePhase8LowValueTransactionReadiness({
    ...baseInput,
    requestedValueWei: "100000000000001",
  });
  assert(overCap.reasons.includes("value_cap_exceeded"));

  const missingGas = evaluatePhase8LowValueTransactionReadiness({
    ...baseInput,
    estimatedGasFeeWei: null,
  });
  assert(missingGas.reasons.includes("gas_estimate_required"));

  const underfunded = evaluatePhase8LowValueTransactionReadiness({
    ...baseInput,
    availableGasBalanceWei: "109999999999999",
  });
  assert(underfunded.reasons.includes("gas_balance_required"));

  const calldata = evaluatePhase8LowValueTransactionReadiness({
    ...baseInput,
    data: "0x1234",
  });
  assert(calldata.reasons.includes("calldata_forbidden"));

  const swapAndApproval = evaluatePhase8LowValueTransactionReadiness({
    ...baseInput,
    includesTokenApproval: true,
    includesSwap: true,
  });
  assert(swapAndApproval.reasons.includes("token_approval_forbidden"));
  assert(swapAndApproval.reasons.includes("swap_forbidden"));

  const publicTelegram = evaluatePhase8LowValueTransactionReadiness({
    ...baseInput,
    privateDashboard: false,
    requestedFromTelegram: true,
    visibleInPublicProfile: true,
  });
  assert(publicTelegram.reasons.includes("private_dashboard_required"));
  assert(publicTelegram.reasons.includes("telegram_forbidden"));
  assert(publicTelegram.reasons.includes("public_profile_forbidden"));

  assertEquals(
    getPhase8LowValueTransactionReadinessBlockMessage("value_cap_exceeded"),
    "Requested value exceeds the Phase 8 low-value cap.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 low-value transaction readiness checks passed.");
