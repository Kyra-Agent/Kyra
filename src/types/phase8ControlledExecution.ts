
import type {
  ExecutionLaunchReadinessResult,
} from "./executionLaunchReadiness";
import type { FrozenPreparedAction } from "./dualApprovalExecution";
import type {
  ResultMonitoringCloseout,
} from "./resultMonitoringCloseout";

export type Phase8ControlledExecutionStatus =
  | "blocked"
  | "ready_for_owner_wallet_prompt"
  | "wallet_prompt_opened"
  | "submitted_pending_confirmation"
  | "closed_confirmed"
  | "closed_failed";

export type Phase8ControlledExecutionBlockReason =
  | "owner_session_required"
  | "selected_agent_required"
  | "owner_wallet_required"
  | "launch_packet_required"
  | "runtime_enablement_required"
  | "owner_click_required"
  | "frozen_action_required"
  | "zero_value_action_required"
  | "no_calldata_required"
  | "owner_wallet_prompt_required"
  | "result_monitoring_required"
  | "rollback_required"
  | "emergency_disable_required"
  | "post_transaction_audit_required"
  | "telegram_authority_forbidden"
  | "public_visibility_forbidden";

export interface Phase8ControlledExecutionInput {
  ownerSignedIn: boolean;
  selectedAgent: boolean;
  ownerWalletConnected: boolean;
  executionLaunch: ExecutionLaunchReadinessResult;
  runtimeEnablement: "disabled" | "enabled";
  ownerClickedExecute: boolean;
  frozenAction: FrozenPreparedAction | null;
  ownerWalletPromptState:
    | "not_requested"
    | "opened"
    | "approved"
    | "rejected"
    | "failed";
  resultMonitoring: ResultMonitoringCloseout;
  rollbackReady: boolean;
  emergencyDisableReady: boolean;
  postTransactionAuditReady: boolean;
  telegramCanAuthorize: boolean;
  visibleInPublicProfile: boolean;
}

export interface Phase8ControlledExecutionResult {
  status: Phase8ControlledExecutionStatus;
  ownerOnly: true;
  ownerWalletPrimaryLane: true;
  hostedChainProviderRequired: false;
  walletPromptAllowed: boolean;
  transactionSubmissionAllowed: boolean;
  reasons: Phase8ControlledExecutionBlockReason[];
  message: string;
}

const blockMessages: Record<Phase8ControlledExecutionBlockReason, string> = {
  owner_session_required:
    "Sign in before controlled execution can be attempted.",
  selected_agent_required:
    "Select one deployed agent before controlled execution.",
  owner_wallet_required:
    "Connect the owner's wallet before controlled execution.",
  launch_packet_required:
    "Controlled execution requires an owner-approved launch packet.",
  runtime_enablement_required:
    "Controlled execution must be explicitly enabled for the live window.",
  owner_click_required:
    "Controlled execution requires an explicit owner click in the private dashboard.",
  frozen_action_required:
    "A frozen reviewed prepared action is required before wallet prompt.",
  zero_value_action_required:
    "The first controlled live action must be zero-value.",
  no_calldata_required:
    "The first controlled live action must not include calldata.",
  owner_wallet_prompt_required:
    "The wallet prompt must be opened and approved by the owner.",
  result_monitoring_required:
    "Owner-only result monitoring must be ready before submission.",
  rollback_required:
    "Rollback must be ready before controlled execution.",
  emergency_disable_required:
    "Emergency disablement must be ready before controlled execution.",
  post_transaction_audit_required:
    "Post-transaction audit must be ready before controlled execution.",
  telegram_authority_forbidden:
    "Telegram cannot authorize or execute controlled transactions.",
  public_visibility_forbidden:
    "Controlled execution state must stay out of public profiles.",
};

export function evaluatePhase8ControlledExecution(
  input: Phase8ControlledExecutionInput,
): Phase8ControlledExecutionResult {
  const reasons: Phase8ControlledExecutionBlockReason[] = [];

  if (!input.ownerSignedIn) {
    reasons.push("owner_session_required");
  }

  if (!input.selectedAgent) {
    reasons.push("selected_agent_required");
  }

  if (!input.ownerWalletConnected) {
    reasons.push("owner_wallet_required");
  }

  if (
    input.executionLaunch.status !== "owner_approved_runtime_still_disabled" ||
    input.executionLaunch.reasons.length > 0 ||
    input.executionLaunch.walletPromptAllowed ||
    input.executionLaunch.transactionSubmissionAllowed
  ) {
    reasons.push("launch_packet_required");
  }

  if (input.runtimeEnablement !== "enabled") {
    reasons.push("runtime_enablement_required");
  }

  if (!input.ownerClickedExecute) {
    reasons.push("owner_click_required");
  }

  if (!input.frozenAction) {
    reasons.push("frozen_action_required");
  }

  if (input.frozenAction && input.frozenAction.valueWei !== "0") {
    reasons.push("zero_value_action_required");
  }

  if (input.frozenAction && input.frozenAction.data !== "0x") {
    reasons.push("no_calldata_required");
  }

  if (
    input.resultMonitoring.reasons.length > 0 ||
    !input.resultMonitoring.ownerOnly
  ) {
    reasons.push("result_monitoring_required");
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

  if (input.telegramCanAuthorize) {
    reasons.push("telegram_authority_forbidden");
  }

  if (input.visibleInPublicProfile) {
    reasons.push("public_visibility_forbidden");
  }

  const uniqueReasons = [...new Set(reasons)];

  if (uniqueReasons.length > 0) {
    return {
      status: "blocked",
      ownerOnly: true,
      ownerWalletPrimaryLane: true,
      hostedChainProviderRequired: false,
      walletPromptAllowed: false,
      transactionSubmissionAllowed: false,
      reasons: uniqueReasons,
      message: blockMessages[uniqueReasons[0]],
    };
  }

  if (input.ownerWalletPromptState === "approved") {
    return {
      status: input.resultMonitoring.status === "closed_confirmed"
        ? "closed_confirmed"
        : input.resultMonitoring.status === "closed_failed"
        ? "closed_failed"
        : "submitted_pending_confirmation",
      ownerOnly: true,
      ownerWalletPrimaryLane: true,
      hostedChainProviderRequired: false,
      walletPromptAllowed: true,
      transactionSubmissionAllowed: true,
      reasons: [],
      message:
        "Wallet approval was recorded. Owner-only result monitoring controls the closeout.",
    };
  }

  if (input.ownerWalletPromptState === "opened") {
    return {
      status: "wallet_prompt_opened",
      ownerOnly: true,
      ownerWalletPrimaryLane: true,
      hostedChainProviderRequired: false,
      walletPromptAllowed: true,
      transactionSubmissionAllowed: false,
      reasons: [],
      message:
        "The wallet prompt is open. Submission requires explicit wallet approval.",
    };
  }

  if (
    input.ownerWalletPromptState === "rejected" ||
    input.ownerWalletPromptState === "failed"
  ) {
    return {
      status: "closed_failed",
      ownerOnly: true,
      ownerWalletPrimaryLane: true,
      hostedChainProviderRequired: false,
      walletPromptAllowed: false,
      transactionSubmissionAllowed: false,
      reasons: [],
      message:
        "Controlled execution closed safely without an approved submission.",
    };
  }

  return {
    status: "ready_for_owner_wallet_prompt",
    ownerOnly: true,
    ownerWalletPrimaryLane: true,
    hostedChainProviderRequired: false,
    walletPromptAllowed: true,
    transactionSubmissionAllowed: false,
    reasons: [],
    message:
      "Controlled execution is ready for an explicit owner wallet prompt in the private dashboard.",
  };
}

export function getPhase8ControlledExecutionBlockMessage(
  reason: Phase8ControlledExecutionBlockReason,
) {
  return blockMessages[reason];
}
