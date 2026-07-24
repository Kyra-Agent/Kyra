import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-owner-submit-request-test");
const outputPath = resolve(outDir, "phase8OwnerSubmitRequest.mjs");

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
    .replace(/import\s+type\s+\{[\s\S]*?\}\s+from\s+"\.\/[^\"]+";\n?/g, "")
    .replace(/import\s+\{\s*productChainId,\s*isEvmAddress,\s*isHexData\s*\}\s+from\s+"\.\/unsignedTransactionHandoff";\n?/g, "const productChainId = 4663;\nconst isEvmAddress = (value) => typeof value === 'string' && /^0x[a-fA-F0-9]{40}$/.test(value);\nconst isHexData = (value) => typeof value === 'string' && /^0x(?:[a-fA-F0-9]{2})*$/.test(value);\n");
}

mkdirSync(outDir, { recursive: true });

const source = [
  'const currentProductChain = Object.freeze({ id: 4663, name: "Robinhood Chain" });',
  stripImports(
    readFileSync(resolve(root, "src/types/phase8OwnerSubmitRequest.ts"), "utf8"),
  ),
].join("\n");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const { createPhase8OwnerSubmitRequest } = await import(
    `file:///${outputPath.replace(/\\/g, "/")}`
  );

  const frozenAction = {
    requestId: "phase8_request",
    ownerUserId: "owner_1",
    workspaceId: "workspace_1",
    agentId: "agent_777",
    approvalId: "approval_1",
    approvedAt: "2026-07-04T00:00:00.000Z",
    actionKind: "robinhood_reviewed_transaction",
    chain: "Robinhood Chain",
    recipient: "0x0000000000000000000000000000000000000000",
    valueWei: "0",
    data: "0x",
    routeSummary: "Controlled zero-value Robinhood Chain execution check.",
    valueSummary: "Zero-value first transaction.",
    freezeKey: "phase8-freeze",
    frozen: true,
  };

  const ready = createPhase8OwnerSubmitRequest(frozenAction);
  assert(ready.ok, "ready request should pass");
  assertEquals(ready.request.to, frozenAction.recipient);
  assertEquals(ready.request.value, 0n);
  assertEquals(ready.request.data, "0x");
  assertEquals(ready.request.chainId, 4663);

  assertEquals(createPhase8OwnerSubmitRequest(null).reason, "frozen_action_required");
  assertEquals(
    createPhase8OwnerSubmitRequest({ ...frozenAction, chain: "Other" }).reason,
    "product_chain_required",
  );
  assertEquals(
    createPhase8OwnerSubmitRequest({ ...frozenAction, valueWei: "1" }).reason,
    "zero_value_required",
  );
  assertEquals(
    createPhase8OwnerSubmitRequest({ ...frozenAction, data: "0x1234" }).reason,
    "no_calldata_required",
  );
  assertEquals(
    createPhase8OwnerSubmitRequest({ ...frozenAction, recipient: "bad" }).reason,
    "recipient_required",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 owner submit request checks passed.");
