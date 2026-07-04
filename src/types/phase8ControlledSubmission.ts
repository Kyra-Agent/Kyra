import type { Phase8WalletPromptOpeningResult } from "./phase8WalletPromptOpening";
import type { FrozenPreparedAction } from "./dualApprovalExecution";

export type Phase8ControlledSubmissionStatus =
  | "blocked"
  | "ready_to_submit"
  | "submitted_pending_confirmation"
  | "closed_confirmed"
  | "closed_failed";

export type Phase8ControlledSubmissionBlockReason =
  | "wallet_prompt_approval_required"
  | "private_dashboard_source_required"
  | "owner_click_required"
  | "owner_match_required"
  | "workspace_match_required"
  | "selected_agent_match_required"
  | "frozen_action_required"
  | "frozen_action_binding_required"
  | "zero_value_action_required"
  | "no_calldata_required"
  | "base_chain_required"
  | "submission_nonce_required"
  | "submission_nonce_unused_required"
  | "base_account_approval_required"
  | "tx_hash_required"
  | "sanitized_tx_hash_required"
  | "owner_only_result_required"
  | "result_status_required"
  | "rollback_required"
  | "emergency_disable_required"
  | "post_transaction_audit_required"
  | "sanitized_audit_required"
  | "telegram_authority_forbidden"
  | "public_visibility_forbidden";

export type Phase8ControlledSubmissionSource =
  | "private_dashboard"
  | "telegram"
  | "public_profile"
  | "automation";

export type Phase8ControlledSubmissionState =
  | "not_submitted"
  | "ready"
  | "submitted"
  | "confirmed"
  | "failed";

export interface Phase8ControlledSubmissionIntent {
  source: Phase8ControlledSubmissionSource;
  ownerClickedSubmit: boolean;
  ownerUserId: string | null;
  workspaceId: string | null;
  agentId: string | null;
  frozenActionFreezeKey: string | null;
  submissionNonce: string | null;
  submissionNonceUsed: boolean;
  requestedAt: string | null;
}

export interface Phase8ControlledSubmissionResultEvent {
  state: Phase8ControlledSubmissionState;
  ownerOnly: boolean;
  sanitized: boolean;
  txHash: string | null;
  message: string;
  createdAt: string;
}

export interface Phase8ControlledSubmissionInput {
  walletPromptOpening: Phase8WalletPromptOpeningResult;
  ownerUserId: string;
  workspaceId: string;
  selectedAgentId: string;
  frozenAction: FrozenPreparedAction | null;
  chain: "Base" | "Base Sepolia" | "Other";
  baseAccountApprovalRecorded: boolean;
  submissionIntent: Phase8ControlledSubmissionIntent;
  submissionState: Phase8ControlledSubmissionState;
  resultEvents: Phase8ControlledSubmissionResultEvent[];
  rollbackReady: boolean;
  emergencyDisableReady: boolean;
  postTransactionAuditReady: boolean;
  visibleInPublicProfile: boolean;
}

export interface Phase8ControlledSubmissionResult {
  status: Phase8ControlledSubmissionStatus;
  ownerOnly: true;
  baseAccountPrimaryLane: true;
  officialMcpRequired: false;
  transactionSubmissionAllowed: boolean;
  resultCloseoutRecorded: boolean;
  reasons: Phase8ControlledSubmissionBlockReason[];
  message: string;
}

const txHashPattern = /^0x[a-fA-F0-9]{64}$/u;

const blockMessages: Record<Phase8ControlledSubmissionBlockReason, string> = {
  wallet_prompt_approval_required:
    "A Batch 3 owner-approved wallet prompt is required before submission.",
  private_dashboard_source_required:
    "Controlled submission must originate from the private owner dashboard.",
  owner_click_required:
    "Controlled submission requires an explicit owner submit click.",
  owner_match_required:
    "Submission owner must match the active owner session.",
  workspace_match_required:
    "Submission workspace must match the selected workspace.",
  selected_agent_match_required:
    "Submission agent must match the selected deployed agent.",
  frozen_action_required:
    "Submission requires a frozen reviewed prepared action.",
  frozen_action_binding_required:
    "Submission nonce must bind to the frozen prepared action.",
  zero_value_action_required:
    "Phase 8 Batch 4 only allows the zero-value first transaction.",
  no_calldata_required:
    "Phase 8 Batch 4 only allows a no-calldata first transaction.",
  base_chain_required: "Phase 8 Batch 4 only allows Base mainnet.",
  submission_nonce_required: "A one-time submission nonce is required.",
  submission_nonce_unused_required: "A submission nonce can only be used once.",
  base_account_approval_required:
    "Base Account approval must be recorded before submission.",
  tx_hash_required:
    "Submitted, confirmed, or failed closeout requires an owner-only transaction hash reference.",
  sanitized_tx_hash_required:
    "Transaction result events must be sanitized and contain only a hash reference.",
  owner_only_result_required:
    "Submission closeout requires owner-only result evidence.",
  result_status_required:
    "Submission state must be ready, submitted, confirmed, or failed.",
  rollback_required: "Rollback readiness is required before controlled submission.",
  emergency_disable_required:
    "Emergency disablement readiness is required before controlled submission.",
  post_transaction_audit_required:
    "Post-transaction audit readiness is required before controlled submission.",
  sanitized_audit_required:
    "Post-transaction audit events must be sanitized.",
  telegram_authority_forbidden:
    "Telegram cannot authorize or submit Phase 8 transactions.",
  public_visibility_forbidden:
    "Public profiles cannot submit or expose Phase 8 transaction state.",
};

function needsTxHash(state: Phase8ControlledSubmissionState) {
  return state === "submitted" || state === "confirmed" || state === "failed";
}

function hasValidTxHash(event: Phase8ControlledSubmissionResultEvent | undefined) {
  return Boolean(event?.txHash && txHashPattern.test(event.txHash));
}

function resultEventForState(
  events: Phase8ControlledSubmissionResultEvent[],
  state: Phase8ControlledSubmissionState,
) {
  return events.find((event) => event.state === state);
}

export function evaluatePhase8ControlledSubmission(
  input: Phase8ControlledSubmissionInput,
): Phase8ControlledSubmissionResult {
  const reasons: Phase8ControlledSubmissionBlockReason[] = [];

  if (
    input.walletPromptOpening.status !== "prompt_approved" ||
    !input.walletPromptOpening.walletApprovalRecorded ||
    input.walletPromptOpening.transactionSubmissionAllowed ||
    input.walletPromptOpening.reasons.length > 0
  ) {
    reasons.push("wallet_prompt_approval_required");
  }

  if (input.submissionIntent.source !== "private_dashboard") {
    reasons.push(
      input.submissionIntent.source === "telegram"
        ? "telegram_authority_forbidden"
        : input.submissionIntent.source === "public_profile"
        ? "public_visibility_forbidden"
        : "private_dashboard_source_required",
    );
  }

  if (!input.submissionIntent.ownerClickedSubmit) {
    reasons.push("owner_click_required");
  }

  if (input.submissionIntent.ownerUserId !== input.ownerUserId) {
    reasons.push("owner_match_required");
  }

  if (input.submissionIntent.workspaceId !== input.workspaceId) {
    reasons.push("workspace_match_required");
  }

  if (input.submissionIntent.agentId !== input.selectedAgentId) {
    reasons.push("selected_agent_match_required");
  }

  if (!input.frozenAction) {
    reasons.push("frozen_action_required");
  }

  if (
    input.frozenAction &&
    input.submissionIntent.frozenActionFreezeKey !== input.frozenAction.freezeKey
  ) {
    reasons.push("frozen_action_binding_required");
  }

  if (input.frozenAction && input.frozenAction.valueWei !== "0") {
    reasons.push("zero_value_action_required");
  }

  if (input.frozenAction && input.frozenAction.data !== "0x") {
    reasons.push("no_calldata_required");
  }

  if (input.chain !== "Base") {
    reasons.push("base_chain_required");
  }

  if (!input.submissionIntent.submissionNonce) {
    reasons.push("submission_nonce_required");
  }

  if (input.submissionIntent.submissionNonceUsed) {
    reasons.push("submission_nonce_unused_required");
  }

  if (!input.baseAccountApprovalRecorded) {
    reasons.push("base_account_approval_required");
  }

  if (input.submissionState === "not_submitted") {
    reasons.push("result_status_required");
  }

  const matchingResult = resultEventForState(input.resultEvents, input.submissionState);

  if (needsTxHash(input.submissionState) && !hasValidTxHash(matchingResult)) {
    reasons.push("tx_hash_required");
  }

  if (input.resultEvents.some((event) => !event.ownerOnly)) {
    reasons.push("owner_only_result_required");
  }

  if (input.resultEvents.some((event) => !event.sanitized || !hasValidTxHash(event))) {
    reasons.push("sanitized_tx_hash_required");
  }

  if (needsTxHash(input.submissionState) && (!matchingResult || !matchingResult.ownerOnly)) {
    reasons.push("owner_only_result_required");
  }

  if (needsTxHash(input.submissionState) && (!matchingResult || !matchingResult.sanitized)) {
    reasons.push("sanitized_audit_required");
  }

  if (!input.rollbackReady) {
    reasons.push("rollback_required");
  }

  if (!input.emergencyDisableReady) {
    reasons.push("emergency_disable_required");
  }

  if (!input.postTransactionAuditReady) {
    reasons.push("post_transaction_audit_required");
  }

  if (input.visibleInPublicProfile) {
    reasons.push("public_visibility_forbidden");
  }

  const uniqueReasons = [...new Set(reasons)];

  if (uniqueReasons.length > 0) {
    return {
      status: "blocked",
      ownerOnly: true,
      baseAccountPrimaryLane: true,
      officialMcpRequired: false,
      transactionSubmissionAllowed: false,
      resultCloseoutRecorded: false,
      reasons: uniqueReasons,
      message: blockMessages[uniqueReasons[0]],
    };
  }

  if (input.submissionState === "confirmed") {
    return {
      status: "closed_confirmed",
      ownerOnly: true,
      baseAccountPrimaryLane: true,
      officialMcpRequired: false,
      transactionSubmissionAllowed: false,
      resultCloseoutRecorded: true,
      reasons: [],
      message:
        "Controlled Base transaction confirmed and closed under owner-only audit.",
    };
  }

  if (input.submissionState === "failed") {
    return {
      status: "closed_failed",
      ownerOnly: true,
      baseAccountPrimaryLane: true,
      officialMcpRequired: false,
      transactionSubmissionAllowed: false,
      resultCloseoutRecorded: true,
      reasons: [],
      message:
        "Controlled Base transaction failed safely and closed under owner-only audit.",
    };
  }

  if (input.submissionState === "submitted") {
    return {
      status: "submitted_pending_confirmation",
      ownerOnly: true,
      baseAccountPrimaryLane: true,
      officialMcpRequired: false,
      transactionSubmissionAllowed: false,
      resultCloseoutRecorded: true,
      reasons: [],
      message:
        "Controlled Base transaction submitted. Owner-only confirmation monitoring is active.",
    };
  }

  return {
    status: "ready_to_submit",
    ownerOnly: true,
    baseAccountPrimaryLane: true,
    officialMcpRequired: false,
    transactionSubmissionAllowed: true,
    resultCloseoutRecorded: false,
    reasons: [],
    message:
      "Phase 8 Batch 4 is ready for one explicit owner-controlled Base submission.",
  };
}

export function getPhase8ControlledSubmissionBlockMessage(
  reason: Phase8ControlledSubmissionBlockReason,
) {
  return blockMessages[reason];
}
