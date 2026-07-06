const baseChainId = 8453;

export type Phase9ExecutionEligibilityStatus =
  | "blocked"
  | "ready_but_runtime_disabled"
  | "eligible";

export type Phase9ExecutionEligibilityReason =
  | "phase8_closeout_required"
  | "runtime_disabled"
  | "owner_signin_required"
  | "selected_agent_required"
  | "deployed_agent_required"
  | "base_account_required"
  | "base_chain_required"
  | "allowlisted_action_required"
  | "value_required"
  | "value_cap_exceeded"
  | "kyra_approval_required"
  | "base_account_approval_required"
  | "receipt_verification_required"
  | "owner_closeout_required"
  | "telegram_execution_forbidden"
  | "public_profile_execution_forbidden"
  | "automation_execution_forbidden"
  | "swap_forbidden"
  | "token_approval_forbidden"
  | "arbitrary_calldata_forbidden"
  | "private_key_forbidden"
  | "seed_phrase_forbidden";

export interface Phase9ExecutionEligibilityInput {
  phase8CanContinueToPhase9: boolean;
  phase9RuntimeEnabled: boolean;
  ownerSignedIn: boolean;
  selectedAgent: boolean;
  deployedAgent: boolean;
  baseAccountConnected: boolean;
  chainId: number | null | undefined;
  actionKind: string | null | undefined;
  valueWei: string | null | undefined;
  maxValueWei: string;
  kyraApprovalRecorded: boolean;
  baseAccountApprovalRecorded: boolean;
  receiptVerificationReady: boolean;
  ownerCloseoutReady: boolean;
  requestedFromTelegram: boolean;
  visibleInPublicProfile: boolean;
  requestedFromAutomation: boolean;
  includesSwap: boolean;
  includesTokenApproval: boolean;
  calldata: string | null | undefined;
  privateKeyRequested: boolean;
  seedPhraseRequested: boolean;
}

export interface Phase9ExecutionEligibilityControl {
  label: string;
  status: "pass" | "pending" | "blocked";
  detail: string;
}

export interface Phase9ExecutionEligibilityResult {
  status: Phase9ExecutionEligibilityStatus;
  ownerOnly: true;
  publicExecutionAllowed: boolean;
  canProceedToAbuseHardening: boolean;
  reasons: Phase9ExecutionEligibilityReason[];
  controls: Phase9ExecutionEligibilityControl[];
  message: string;
}

const allowedActionKinds = new Set(["eth_transfer", "base_eth_transfer"]);

export function evaluatePhase9ExecutionEligibility(
  input: Phase9ExecutionEligibilityInput,
): Phase9ExecutionEligibilityResult {
  const reasons: Phase9ExecutionEligibilityReason[] = [];
  const valueWei = parseWei(input.valueWei);
  const maxValueWei = parseWei(input.maxValueWei);

  if (!input.phase8CanContinueToPhase9) reasons.push("phase8_closeout_required");
  if (!input.phase9RuntimeEnabled) reasons.push("runtime_disabled");
  if (!input.ownerSignedIn) reasons.push("owner_signin_required");
  if (!input.selectedAgent) reasons.push("selected_agent_required");
  if (!input.deployedAgent) reasons.push("deployed_agent_required");
  if (!input.baseAccountConnected) reasons.push("base_account_required");
  if (input.chainId !== baseChainId) reasons.push("base_chain_required");
  if (!input.actionKind || !allowedActionKinds.has(input.actionKind)) {
    reasons.push("allowlisted_action_required");
  }
  if (valueWei === null || valueWei <= 0n) reasons.push("value_required");
  if (valueWei !== null && maxValueWei !== null && valueWei > maxValueWei) {
    reasons.push("value_cap_exceeded");
  }
  if (!input.kyraApprovalRecorded) reasons.push("kyra_approval_required");
  if (!input.baseAccountApprovalRecorded) reasons.push("base_account_approval_required");
  if (!input.receiptVerificationReady) reasons.push("receipt_verification_required");
  if (!input.ownerCloseoutReady) reasons.push("owner_closeout_required");
  if (input.requestedFromTelegram) reasons.push("telegram_execution_forbidden");
  if (input.visibleInPublicProfile) reasons.push("public_profile_execution_forbidden");
  if (input.requestedFromAutomation) reasons.push("automation_execution_forbidden");
  if (input.includesSwap) reasons.push("swap_forbidden");
  if (input.includesTokenApproval) reasons.push("token_approval_forbidden");
  if ((input.calldata ?? "0x") !== "0x") reasons.push("arbitrary_calldata_forbidden");
  if (input.privateKeyRequested) reasons.push("private_key_forbidden");
  if (input.seedPhraseRequested) reasons.push("seed_phrase_forbidden");

  const uniqueReasons = [...new Set(reasons)];
  const blockingWithoutRuntime = uniqueReasons.filter((reason) => reason !== "runtime_disabled");
  const publicExecutionAllowed = uniqueReasons.length === 0;

  return {
    status: resolveStatus(uniqueReasons, blockingWithoutRuntime),
    ownerOnly: true,
    publicExecutionAllowed,
    canProceedToAbuseHardening: blockingWithoutRuntime.length === 0,
    reasons: uniqueReasons,
    controls: buildControls(input, uniqueReasons, valueWei, maxValueWei),
    message: getMessage(uniqueReasons, blockingWithoutRuntime),
  };
}

function resolveStatus(
  reasons: Phase9ExecutionEligibilityReason[],
  blockingWithoutRuntime: Phase9ExecutionEligibilityReason[],
): Phase9ExecutionEligibilityStatus {
  if (reasons.length === 0) return "eligible";
  return blockingWithoutRuntime.length === 0 ? "ready_but_runtime_disabled" : "blocked";
}

function buildControls(
  input: Phase9ExecutionEligibilityInput,
  reasons: Phase9ExecutionEligibilityReason[],
  valueWei: bigint | null,
  maxValueWei: bigint | null,
): Phase9ExecutionEligibilityControl[] {
  return [
    {
      label: "Foundation closeout",
      status: input.phase8CanContinueToPhase9 ? "pass" : "blocked",
      detail: "The owner-controlled transaction foundation must be closed before public execution can widen.",
    },
    {
      label: "Owner and agent",
      status: reasons.some((reason) => ["owner_signin_required", "selected_agent_required", "deployed_agent_required"].includes(reason)) ? "blocked" : "pass",
      detail: "Signed-in owner, selected deployed agent, and workspace scope are required.",
    },
    {
      label: "Wallet boundary",
      status: reasons.some((reason) => ["base_account_required", "base_chain_required", "base_account_approval_required"].includes(reason)) ? "blocked" : "pass",
      detail: "The user's own Base Account on Base must approve the transaction.",
    },
    {
      label: "Action shape",
      status: valueWei !== null && maxValueWei !== null && valueWei > 0n && valueWei <= maxValueWei && allowedActionKinds.has(input.actionKind ?? "") && (input.calldata ?? "0x") === "0x" ? "pass" : "blocked",
      detail: "Only capped Base ETH transfer actions with no calldata are eligible.",
    },
    {
      label: "Approval and receipt",
      status: reasons.some((reason) => ["kyra_approval_required", "receipt_verification_required", "owner_closeout_required"].includes(reason)) ? "blocked" : "pass",
      detail: "Kyra approval, receipt verification, and owner-only closeout are required.",
    },
    {
      label: "Surface boundary",
      status: reasons.some((reason) => ["telegram_execution_forbidden", "public_profile_execution_forbidden", "automation_execution_forbidden"].includes(reason)) ? "blocked" : "pass",
      detail: "Telegram, public profiles, and automation cannot execute.",
    },
    {
      label: "Secret safety",
      status: reasons.some((reason) => ["private_key_forbidden", "seed_phrase_forbidden"].includes(reason)) ? "blocked" : "pass",
      detail: "Private keys and seed phrases are never accepted or requested.",
    },
    {
      label: "Runtime",
      status: input.phase9RuntimeEnabled ? "pass" : "pending",
      detail: "Public execution runtime remains disabled until explicit release approval.",
    },
  ];
}

function getMessage(
  reasons: Phase9ExecutionEligibilityReason[],
  blockingWithoutRuntime: Phase9ExecutionEligibilityReason[],
) {
  if (reasons.length === 0) {
    return "Public execution eligibility is open for the approved release lane.";
  }

  if (blockingWithoutRuntime.length === 0) {
    return "Execution eligibility is structurally ready, but public execution runtime remains disabled.";
  }

  return "Execution eligibility is waiting on required safety checks.";
}

function parseWei(value: string | null | undefined) {
  if (!value || !/^\d+$/u.test(value)) return null;

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}
