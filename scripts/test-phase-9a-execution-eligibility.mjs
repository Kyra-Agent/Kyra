import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";

const source = readFileSync(
  resolve(process.cwd(), "src/types/phase9ExecutionEligibility.ts"),
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
const moduleUrl = `data:text/javascript;base64,${
  Buffer.from(transpiled.outputText).toString("base64")
}`;
const { evaluatePhase9ExecutionEligibility } = await import(moduleUrl);
const baseChainId = 8453;

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const baseInput = {
  phase8CanContinueToPhase9: true,
  phase9RuntimeEnabled: false,
  ownerSignedIn: true,
  selectedAgent: true,
  deployedAgent: true,
  baseAccountConnected: true,
  chainId: baseChainId,
  actionKind: "eth_transfer",
  valueWei: "100000000000000",
  maxValueWei: "100000000000000",
  kyraApprovalRecorded: true,
  baseAccountApprovalRecorded: true,
  receiptVerificationReady: true,
  ownerCloseoutReady: true,
  requestedFromTelegram: false,
  visibleInPublicProfile: false,
  requestedFromAutomation: false,
  includesSwap: false,
  includesTokenApproval: false,
  calldata: "0x",
  privateKeyRequested: false,
  seedPhraseRequested: false,
};

const readyButDisabled = evaluatePhase9ExecutionEligibility(baseInput);
assert(readyButDisabled.status === "ready_but_runtime_disabled", "runtime-disabled ready path should be explicit");
assert(!readyButDisabled.publicExecutionAllowed, "disabled runtime must not allow public execution");
assert(readyButDisabled.canProceedToAbuseHardening, "structural readiness should allow Batch 9B hardening work");
assert(readyButDisabled.reasons.includes("runtime_disabled"), "runtime disabled reason required");
assert(readyButDisabled.ownerOnly === true, "eligibility evidence stays owner-only");
assert(readyButDisabled.controls.length >= 8, "eligibility should expose control evidence");

const eligible = evaluatePhase9ExecutionEligibility({
  ...baseInput,
  phase9RuntimeEnabled: true,
});
assert(eligible.status === "eligible", "fully approved runtime should be eligible");
assert(eligible.publicExecutionAllowed, "fully approved runtime can allow public execution");
assert(eligible.reasons.length === 0, "eligible path must have no reasons");

const missingOwner = evaluatePhase9ExecutionEligibility({
  ...baseInput,
  ownerSignedIn: false,
  phase9RuntimeEnabled: true,
});
assert(missingOwner.status === "blocked", "missing owner blocks eligibility");
assert(missingOwner.reasons.includes("owner_signin_required"), "owner sign-in reason required");

const publicSurface = evaluatePhase9ExecutionEligibility({
  ...baseInput,
  phase9RuntimeEnabled: true,
  requestedFromTelegram: true,
  visibleInPublicProfile: true,
  requestedFromAutomation: true,
});
assert(publicSurface.status === "blocked", "public surfaces must block execution");
assert(publicSurface.reasons.includes("telegram_execution_forbidden"), "Telegram block required");
assert(publicSurface.reasons.includes("public_profile_execution_forbidden"), "public profile block required");
assert(publicSurface.reasons.includes("automation_execution_forbidden"), "automation block required");

const unsafeShape = evaluatePhase9ExecutionEligibility({
  ...baseInput,
  phase9RuntimeEnabled: true,
  includesSwap: true,
  includesTokenApproval: true,
  calldata: "0x1234",
  valueWei: "100000000000001",
});
assert(unsafeShape.reasons.includes("swap_forbidden"), "swap must be forbidden");
assert(unsafeShape.reasons.includes("token_approval_forbidden"), "token approval must be forbidden");
assert(unsafeShape.reasons.includes("arbitrary_calldata_forbidden"), "calldata must be forbidden");
assert(unsafeShape.reasons.includes("value_cap_exceeded"), "cap must be enforced");

const secretRequest = evaluatePhase9ExecutionEligibility({
  ...baseInput,
  phase9RuntimeEnabled: true,
  privateKeyRequested: true,
  seedPhraseRequested: true,
});
assert(secretRequest.reasons.includes("private_key_forbidden"), "private keys must be forbidden");
assert(secretRequest.reasons.includes("seed_phrase_forbidden"), "seed phrases must be forbidden");

const wrongChain = evaluatePhase9ExecutionEligibility({
  ...baseInput,
  phase9RuntimeEnabled: true,
  chainId: 1,
});
assert(wrongChain.reasons.includes("base_chain_required"), "only Base chain is eligible");

console.log("Phase 9A execution eligibility checks passed.");
