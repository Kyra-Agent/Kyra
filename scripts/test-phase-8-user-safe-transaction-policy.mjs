import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const root = process.cwd();
const outDir = resolve(root, ".tmp-phase-8-user-safe-policy-test");
const outputPath = resolve(outDir, "phase8UserSafeTransactionPolicy.mjs");

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

const source = readFileSync(resolve(root, "src/types/phase8UserSafeTransactionPolicy.ts"), "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2020,
    target: ts.ScriptTarget.ES2020,
  },
});

writeFileSync(outputPath, transpiled.outputText);

try {
  const {
    evaluatePhase8UserSafeTransactionPolicy,
    getPhase8UserSafeTransactionPolicyBlockMessage,
  } = await import(`file:///${outputPath.replace(/\\/g, "/")}`);

  const baseInput = {
    ownerSignedIn: true,
    privateDashboard: true,
    selectedAgent: true,
    baseAccountConnected: true,
    chainId: 8453,
    preparedActionId: "phase8_request_16",
    actionKind: "base_reviewed_transaction",
    valueWei: "0",
    data: "0x",
    includesTokenApproval: false,
    includesSwap: false,
    requestedFromTelegram: false,
    visibleInPublicProfile: false,
    cooldownSatisfied: true,
  };

  const ready = evaluatePhase8UserSafeTransactionPolicy(baseInput);
  assertEquals(ready.status, "ready_for_owner_review");
  assertEquals(ready.canEnterOwnerReview, true);
  assertEquals(ready.maxValueWei, "0");
  assert(ready.allowedActionKinds.includes("base_reviewed_transaction"));

  const noOwner = evaluatePhase8UserSafeTransactionPolicy({
    ...baseInput,
    ownerSignedIn: false,
  });
  assert(noOwner.reasons.includes("owner_session_required"));

  const publicSurface = evaluatePhase8UserSafeTransactionPolicy({
    ...baseInput,
    privateDashboard: false,
    visibleInPublicProfile: true,
  });
  assert(publicSurface.reasons.includes("private_dashboard_required"));
  assert(publicSurface.reasons.includes("public_profile_forbidden"));

  const telegramRequest = evaluatePhase8UserSafeTransactionPolicy({
    ...baseInput,
    requestedFromTelegram: true,
  });
  assert(telegramRequest.reasons.includes("telegram_forbidden"));

  const unsafeValue = evaluatePhase8UserSafeTransactionPolicy({
    ...baseInput,
    valueWei: "1",
  });
  assert(unsafeValue.reasons.includes("non_zero_value_forbidden"));

  const calldata = evaluatePhase8UserSafeTransactionPolicy({
    ...baseInput,
    data: "0x1234",
  });
  assert(calldata.reasons.includes("calldata_forbidden"));

  const swapAndApproval = evaluatePhase8UserSafeTransactionPolicy({
    ...baseInput,
    includesTokenApproval: true,
    includesSwap: true,
  });
  assert(swapAndApproval.reasons.includes("token_approval_forbidden"));
  assert(swapAndApproval.reasons.includes("swap_forbidden"));

  const wrongChain = evaluatePhase8UserSafeTransactionPolicy({
    ...baseInput,
    chainId: 1,
  });
  assert(wrongChain.reasons.includes("base_chain_required"));

  const cooldown = evaluatePhase8UserSafeTransactionPolicy({
    ...baseInput,
    cooldownSatisfied: false,
  });
  assert(cooldown.reasons.includes("cooldown_required"));

  assertEquals(
    getPhase8UserSafeTransactionPolicyBlockMessage("telegram_forbidden"),
    "Telegram cannot request, approve, or submit user transactions.",
  );
} finally {
  rmSync(outDir, { recursive: true, force: true });
}

console.log("Phase 8 user-safe transaction policy checks passed.");
