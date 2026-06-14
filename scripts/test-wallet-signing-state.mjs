import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const sourcePath = resolve(root, "src/types/walletSigning.ts");
const outDir = resolve(root, ".tmp-wallet-signing-test");
const outputPath = resolve(outDir, "walletSigning.mjs");

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
    isTerminalWalletSigningState,
    isTransactionHash,
    transitionWalletSigningState,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const hash = `0x${"a".repeat(64)}`;

  assertEquals(
    transitionWalletSigningState({
      state: "not_ready",
      event: "load_preview",
    }).state,
    "preview_ready",
  );
  assertEquals(
    transitionWalletSigningState({
      state: "preview_ready",
      event: "request_wallet_prompt",
      ownerAction: true,
    }).state,
    "wallet_prompt_requested",
  );
  assertEquals(
    transitionWalletSigningState({
      state: "preview_ready",
      event: "request_wallet_prompt",
    }).ok,
    false,
    "Wallet prompt must require explicit owner action.",
  );
  assertEquals(
    transitionWalletSigningState({
      state: "wallet_prompt_requested",
      event: "wallet_prompt_opened",
    }).state,
    "wallet_prompt_opened",
  );
  assertEquals(
    transitionWalletSigningState({
      state: "wallet_prompt_opened",
      event: "submit",
      txHash: hash,
    }).state,
    "submitted",
  );
  assertEquals(
    transitionWalletSigningState({
      state: "wallet_prompt_opened",
      event: "submit",
    }).ok,
    false,
    "Submitted state must require a transaction hash.",
  );
  assertEquals(
    transitionWalletSigningState({
      state: "preview_ready",
      event: "reject",
      txHash: hash,
    }).ok,
    false,
    "Rejected state must not accept a transaction hash.",
  );
  assertEquals(
    transitionWalletSigningState({
      state: "submitted",
      event: "confirm",
      confirmationId: "base:receipt:1",
    }).state,
    "confirmed",
  );
  assertEquals(
    transitionWalletSigningState({
      state: "submitted",
      event: "confirm",
    }).ok,
    false,
    "Confirmed state must require confirmation data.",
  );
  assertEquals(
    transitionWalletSigningState({
      state: "preview_ready",
      event: "fail",
      sanitizedFailureReason: "Wallet network mismatch.",
    }).state,
    "failed",
  );
  assertEquals(
    transitionWalletSigningState({
      state: "preview_ready",
      event: "submit",
      txHash: hash,
    }).ok,
    false,
    "Submit must only happen from wallet_prompt_opened.",
  );
  assert(isTransactionHash(hash), "Valid transaction hash should pass.");
  assert(!isTransactionHash("0x1234"), "Short hash should fail.");
  assert(
    isTerminalWalletSigningState("confirmed"),
    "Confirmed should be terminal.",
  );
  assert(isTerminalWalletSigningState("failed"), "Failed should be terminal.");
  assert(
    isTerminalWalletSigningState("user_rejected"),
    "Rejected should be terminal.",
  );
  assert(
    !isTerminalWalletSigningState("submitted"),
    "Submitted should not be terminal.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Wallet signing state checks passed.");
