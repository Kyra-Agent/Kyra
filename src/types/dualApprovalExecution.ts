
import type {
  PreparedActionCanonicalInput,
  PreparedActionChain,
  PreparedActionKind,
} from "./preparedAction";
import type {
  PreparedActionPolicyResult,
} from "./preparedActionPolicy";

export type DualApprovalDecision = "pending" | "approved" | "rejected";

export type DualApprovalStatus =
  | "policy_not_ready"
  | "owner_review_required"
  | "owner_rejected"
  | "owner_approved_frozen"
  | "base_account_prompt_locked";

export type DualApprovalBlockReason =
  | "policy_not_ready"
  | "owner_approval_required"
  | "owner_rejected"
  | "approval_identity_required"
  | "reviewed_action_changed"
  | "base_account_connection_required"
  | "valid_handoff_required"
  | "wallet_execution_disabled"
  | "wallet_signing_disabled"
  | "official_mcp_disabled";

export interface DualApprovalOwnerDecision {
  decision: DualApprovalDecision;
  approvalId?: string | null;
  ownerUserId?: string | null;
  approvedAt?: string | null;
}

export interface FrozenPreparedAction {
  readonly requestId: string;
  readonly ownerUserId: string;
  readonly workspaceId: string;
  readonly agentId: string;
  readonly approvalId: string;
  readonly approvedAt: string;
  readonly actionKind: PreparedActionKind;
  readonly chain: PreparedActionChain;
  readonly recipient: `0x${string}`;
  readonly valueWei: string;
  readonly data: `0x${string}`;
  readonly routeSummary: string;
  readonly valueSummary: string;
  readonly freezeKey: string;
  readonly frozen: true;
}

export interface FreezePreparedActionInput {
  requestId: string;
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  approvalId: string;
  approvedAt: string;
  canonical: PreparedActionCanonicalInput;
}

export interface DualApprovalExecutionInput {
  policyReview: PreparedActionPolicyResult;
  ownerDecision: DualApprovalOwnerDecision;
  frozenAction: FrozenPreparedAction | null;
  baseAccountConnected: boolean;
  handoffValid: boolean;
  walletExecutionEnabled: boolean;
  walletSigningEnabled: boolean;
  officialMcpEnabled: boolean;
}

export interface DualApprovalExecutionResult {
  status: DualApprovalStatus;
  frozenAction: FrozenPreparedAction | null;
  walletPromptAllowed: boolean;
  transactionSubmissionAllowed: boolean;
  reasons: DualApprovalBlockReason[];
  message: string;
}

const blockMessages: Record<DualApprovalBlockReason, string> = {
  policy_not_ready:
    "Prepared action must pass policy review before owner approval.",
  owner_approval_required:
    "Kyra owner approval is required before wallet approval.",
  owner_rejected:
    "Owner rejected the prepared action. No wallet prompt can open.",
  approval_identity_required:
    "Owner approval requires approval id, owner id, and approval timestamp.",
  reviewed_action_changed:
    "Reviewed prepared action changed after approval and must be rejected.",
  base_account_connection_required:
    "Connect the owner wallet before wallet approval can be considered.",
  valid_handoff_required:
    "A valid unsigned handoff is required before wallet approval.",
  wallet_execution_disabled:
    "Wallet execution remains disabled by the Phase 7H runtime gate.",
  wallet_signing_disabled:
    "Wallet signing remains disabled until the later execution gate.",
  official_mcp_disabled:
    "Official hosted Base MCP authority remains disabled while Phase 7C is no-go.",
};

export function freezeReviewedPreparedAction(
  input: FreezePreparedActionInput,
): FrozenPreparedAction | null {
  if (input.canonical.actionKind !== "base_reviewed_transaction") {
    return null;
  }

  if (
    !input.requestId.trim() ||
    !input.ownerUserId.trim() ||
    !input.workspaceId.trim() ||
    !input.agentId.trim() ||
    !input.approvalId.trim() ||
    !input.approvedAt.trim()
  ) {
    return null;
  }

  return {
    requestId: input.requestId,
    ownerUserId: input.ownerUserId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    approvalId: input.approvalId,
    approvedAt: input.approvedAt,
    actionKind: input.canonical.actionKind,
    chain: input.canonical.chain,
    recipient: input.canonical.recipient,
    valueWei: input.canonical.valueWei,
    data: input.canonical.data,
    routeSummary: input.canonical.routeSummary,
    valueSummary: input.canonical.valueSummary,
    freezeKey: createPreparedActionFreezeKey(input.canonical),
    frozen: true,
  };
}

export function hasReviewedPreparedActionChanged(
  frozen: FrozenPreparedAction,
  canonical: PreparedActionCanonicalInput | null,
) {
  if (!canonical || canonical.actionKind !== "base_reviewed_transaction") {
    return true;
  }

  return frozen.freezeKey !== createPreparedActionFreezeKey(canonical);
}

export function evaluateDualApprovalExecution(
  input: DualApprovalExecutionInput,
): DualApprovalExecutionResult {
  const canonical = input.policyReview.allowlist.canonical;

  if (
    input.policyReview.status !== "owner_review_required" ||
    !input.policyReview.allowedForStorage ||
    !canonical ||
    canonical.actionKind !== "base_reviewed_transaction"
  ) {
    return blocked("policy_not_ready", "policy_not_ready", input.frozenAction);
  }

  if (input.ownerDecision.decision === "rejected") {
    return blocked("owner_rejected", "owner_rejected", input.frozenAction);
  }

  if (input.ownerDecision.decision !== "approved") {
    return blocked(
      "owner_review_required",
      "owner_approval_required",
      input.frozenAction,
    );
  }

  if (
    !input.ownerDecision.approvalId?.trim() ||
    !input.ownerDecision.ownerUserId?.trim() ||
    !input.ownerDecision.approvedAt?.trim()
  ) {
    return blocked(
      "owner_review_required",
      "approval_identity_required",
      input.frozenAction,
    );
  }

  if (!input.frozenAction) {
    return blocked(
      "owner_review_required",
      "reviewed_action_changed",
      input.frozenAction,
    );
  }

  if (hasReviewedPreparedActionChanged(input.frozenAction, canonical)) {
    return blocked(
      "owner_review_required",
      "reviewed_action_changed",
      input.frozenAction,
    );
  }

  const reasons: DualApprovalBlockReason[] = [];

  if (!input.baseAccountConnected) {
    reasons.push("base_account_connection_required");
  }

  if (!input.handoffValid) {
    reasons.push("valid_handoff_required");
  }

  if (!input.walletExecutionEnabled) {
    reasons.push("wallet_execution_disabled");
  }

  if (!input.walletSigningEnabled) {
    reasons.push("wallet_signing_disabled");
  }

  if (!input.officialMcpEnabled) {
    reasons.push("official_mcp_disabled");
  }

  if (reasons.length > 0) {
    return {
      status: input.baseAccountConnected && input.handoffValid
        ? "base_account_prompt_locked"
        : "owner_approved_frozen",
      frozenAction: input.frozenAction,
      walletPromptAllowed: false,
      transactionSubmissionAllowed: false,
      reasons,
      message: blockMessages[reasons[0]],
    };
  }

  return {
    status: "base_account_prompt_locked",
    frozenAction: input.frozenAction,
    walletPromptAllowed: false,
    transactionSubmissionAllowed: false,
    reasons: ["wallet_signing_disabled"],
    message: blockMessages.wallet_signing_disabled,
  };
}

export function getDualApprovalBlockMessage(reason: DualApprovalBlockReason) {
  return blockMessages[reason];
}

function createPreparedActionFreezeKey(input: PreparedActionCanonicalInput) {
  return [
    input.actionKind,
    input.chain,
    input.recipient ?? "none",
    input.valueWei,
    input.data,
    input.routeSummary,
    input.valueSummary,
  ].join("|");
}

function blocked(
  status: DualApprovalStatus,
  reason: DualApprovalBlockReason,
  frozenAction: FrozenPreparedAction | null,
): DualApprovalExecutionResult {
  return {
    status,
    frozenAction,
    walletPromptAllowed: false,
    transactionSubmissionAllowed: false,
    reasons: [reason],
    message: blockMessages[reason],
  };
}
