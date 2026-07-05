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
    /import\s+\{\s*baseChainId,\s*isEvmAddress,\s*isHexData\s*\}\s+from\s+"\.\/unsignedTransactionHandoff";\n?/g,
    "const baseChainId = 8453;\nconst isEvmAddress = (value) => typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);\nconst isHexData = (value) => typeof value === 'string' && /^0x(?:[a-fA-F0-9]{2})*$/.test(value);\n",
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

  const baseInput = {
    ownerUserId: "owner_18",
    workspaceId: "workspace_18",
    agentId: "agent_777",
    privateDashboard: true,
    baseAccountConnected: true,
    chainId: 8453,
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

  const ready = createPhase8LowValueSubmitRequest(baseInput);
  assert(ready.ok, "ready low-value submit request should pass");
  assertEquals(ready.request.to, baseInput.recipient);
  assertEquals(ready.request.value, 100000000000000n);
  assertEquals(ready.request.data, "0x");
  assertEquals(ready.request.chainId, 8453);
  assertEquals(ready.request.maxValueWei, "100000000000000");
  assertEquals(ready.request.ownerOnly, true);

  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, ownerUserId: "" }).reasons.includes("owner_scope_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, privateDashboard: false }).reasons.includes("private_dashboard_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, baseAccountConnected: false }).reasons.includes("base_account_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, chainId: 1 }).reasons.includes("base_chain_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, preparedActionId: "" }).reasons.includes("prepared_action_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, ownerApprovalRecorded: false }).reasons.includes("owner_approval_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, recipient: "bad" }).reasons.includes("recipient_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, valueWei: "0" }).reasons.includes("value_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, valueWei: "100000000000001" }).reasons.includes("value_cap_exceeded"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, data: "0x1234" }).reasons.includes("no_calldata_required"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, includesTokenApproval: true }).reasons.includes("token_approval_forbidden"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, includesSwap: true }).reasons.includes("swap_forbidden"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, requestedFromTelegram: true }).reasons.includes("telegram_forbidden"),
  );
  assert(
    createPhase8LowValueSubmitRequest({ ...baseInput, visibleInPublicProfile: true }).reasons.includes("public_profile_forbidden"),
  );

  assertEquals(
    getPhase8LowValueSubmitRequestFailureMessage("value_cap_exceeded"),
    "Low-value submit request exceeds the Phase 8 cap.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 low-value submit request checks passed.");
