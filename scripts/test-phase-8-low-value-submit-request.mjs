import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-low-value-submit-request-test");
const outputPath = resolve(outDir, "phase8LowValueSubmitRequest.mjs");

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
  return source.replace(
    /import\s+\{\s*productChainId,\s*isEvmAddress,\s*isHexData\s*\}\s+from\s+"\.\/unsignedTransactionHandoff";\n?/g,
    "const productChainId = 4663;\nconst isEvmAddress = (value) => typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);\nconst isHexData = (value) => typeof value === 'string' && /^0x(?:[a-fA-F0-9]{2})*$/.test(value);\n",
  );
}

mkdirSync(outDir, { recursive: true });

const source = stripImports(
  readFileSync(resolve(root, "src/types/phase8LowValueSubmitRequest.ts"), "utf8"),
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
    createPhase8LowValueSubmitRequest,
    getPhase8LowValueSubmitRequestFailureMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const baselineInput = {
    ownerUserId: "owner_18",
    workspaceId: "workspace_18",
    agentId: "agent_777",
    privateDashboard: true,
    ownerWalletConnected: true,
    chainId: 4663,
    preparedActionId: "phase8_low_value_request",
    ownerApprovalRecorded: true,
    recipient: "0x0000000000000000000000000000000000000001",
    valueWei: "100000000000000",
    data: "0x",
    includesTokenApproval: false,
    includesSwap: false,
    requestedFromTelegram: false,
    visibleInPublicProfile: false,
  };

  const ready = createPhase8LowValueSubmitRequest(baselineInput);
  assert(ready.ok, "ready low-value submit request should pass");
  assertEquals(ready.request.to, baselineInput.recipient);
  assertEquals(ready.request.value, 100000000000000n);
  assertEquals(ready.request.data, "0x");
  assertEquals(ready.request.chainId, 4663);
  assertEquals(ready.request.maxValueWei, "100000000000000");
  assertEquals(ready.request.ownerOnly, true);

  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, ownerUserId: "" }).reasons.includes("owner_scope_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, privateDashboard: false }).reasons.includes("private_dashboard_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, ownerWalletConnected: false }).reasons.includes("owner_wallet_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, chainId: 1 }).reasons.includes("product_chain_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, preparedActionId: "" }).reasons.includes("prepared_action_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, ownerApprovalRecorded: false }).reasons.includes("owner_approval_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, recipient: "bad" }).reasons.includes("recipient_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, valueWei: "0" }).reasons.includes("value_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, valueWei: "100000000000001" }).reasons.includes("value_cap_exceeded"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, data: "0x1234" }).reasons.includes("no_calldata_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, includesTokenApproval: true }).reasons.includes("token_approval_forbidden"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, includesSwap: true }).reasons.includes("swap_forbidden"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, requestedFromTelegram: true }).reasons.includes("telegram_forbidden"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baselineInput, visibleInPublicProfile: true }).reasons.includes("public_profile_forbidden"),
  );

  assertEquals(
    getPhase8LowValueSubmitRequestFailureMessage("value_cap_exceeded"),
    "Low-value submit request exceeds the controlled execution cap.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 low-value submit request checks passed.");
