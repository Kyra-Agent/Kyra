import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourcePath = resolve(root, "src/types/unsignedTransactionHandoff.ts");
const outDir = resolve(root, ".tmp-unsigned-transaction-handoff-test");
const outputPath = resolve(outDir, "unsignedTransactionHandoff.mjs");

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

const source = readFileSync(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    baseChainId,
    isEvmAddress,
    isHexData,
    isSafeValueWei,
    validateUnsignedTransactionHandoff,
    walletUnsignedTransactionHandoffVersion,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const nowMs = Date.parse("2026-06-15T10:00:00.000Z");
  const handoff = {
    version: walletUnsignedTransactionHandoffVersion,
    preparedActionId: "pa_001",
    ownerUserId: "user_001",
    workspaceId: "ws_001",
    agentId: "agent_001",
    actionKind: "base_reviewed_transaction",
    chainId: baseChainId,
    chainName: "Base",
    to: `0x${"1".repeat(40)}`,
    valueWei: "0",
    data: "0x",
    gasPayer: "connected_wallet",
    routeSummary: "Base reviewed transaction",
    valueSummary: "No token spend",
    risk: "low",
    createdAt: "2026-06-15T09:59:00.000Z",
    expiresAt: "2026-06-15T10:09:00.000Z",
  };

  assert(
    validateUnsignedTransactionHandoff(handoff, nowMs).ok,
    "Valid unsigned transaction handoff should pass.",
  );
  assert(isEvmAddress(handoff.to), "Valid EVM address should pass.");
  assert(!isEvmAddress("0x1234"), "Short EVM address should fail.");
  assert(isHexData("0x1234abcd"), "Even-length hex calldata should pass.");
  assert(!isHexData("0x123"), "Odd-length calldata should fail.");
  assert(isSafeValueWei("0"), "Zero wei should pass.");
  assert(isSafeValueWei("1000000000000000000"), "Positive wei should pass.");
  assert(!isSafeValueWei("-1"), "Negative wei should fail.");

  assertEquals(
    validateUnsignedTransactionHandoff(
      { ...handoff, actionKind: "base_mcp_status_check" },
      nowMs,
    ).ok,
    false,
    "Read-only status checks must not become signable handoffs.",
  );
  assertEquals(
    validateUnsignedTransactionHandoff({ ...handoff, chainId: 1 }, nowMs).ok,
    false,
    "Wrong chain must fail.",
  );
  assertEquals(
    validateUnsignedTransactionHandoff(
      { ...handoff, gasPayer: "backend" },
      nowMs,
    ).ok,
    false,
    "Backend gas payer must fail.",
  );
  assertEquals(
    validateUnsignedTransactionHandoff(
      { ...handoff, expiresAt: "2026-06-15T09:59:59.000Z" },
      nowMs,
    ).ok,
    false,
    "Expired handoff must fail.",
  );
  assertEquals(
    validateUnsignedTransactionHandoff(
      { ...handoff, expiresAt: "2026-06-15T10:30:00.000Z" },
      nowMs,
    ).ok,
    false,
    "Long expiry window must fail.",
  );
  assertEquals(
    validateUnsignedTransactionHandoff({ ...handoff, to: "0x1234" }, nowMs).ok,
    false,
    "Invalid target must fail.",
  );
  assertEquals(
    validateUnsignedTransactionHandoff({ ...handoff, data: "0x123" }, nowMs)
      .ok,
    false,
    "Invalid calldata must fail.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Unsigned transaction handoff checks passed.");
