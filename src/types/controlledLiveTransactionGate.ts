
import type {
  DualApprovalExecutionResult,
} from "./dualApprovalExecution";
import type {
  ResultMonitoringCloseout,
} from "./resultMonitoringCloseout";
import { baseChainId } from "./unsignedTransactionHandoff";

export type ControlledLiveTransactionStatus =
  | "blocked"
  | "ready_for_live_window_approval"
  | "live_window_approved_runtime_locked";

export type ControlledLiveTransactionBlockReason =
  | "owner_scope_required"
  | "workspace_scope_required"
  | "agent_scope_required"
  | "base_account_required"
  | "base_network_required"
  | "single_action_required"
  | "allowlisted_action_required"
  | "low_risk_action_required"
  | "dual_approval_required"
  | "result_monitoring_required"
  | "rollback_required"
  | "emergency_disable_required"
  | "post_transaction_audit_required"
  | "public_visibility_forbidden"
  | "telegram_authority_forbidden"
  | "runtime_execution_must_remain_locked";

export interface ControlledLiveTransactionGateInput {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  baseAccountConnected: boolean;
  chainId: unknown;
  preparedActionCount: number;
  actionAllowlisted: boolean;
  actionRisk: "low" | "medium" | "high" | "read-only" | "blocked";
  dualApproval: DualApprovalExecutionResult;
  resultMonitoring: ResultMonitoringCloseout;
  rollbackReady: boolean;
  emergencyDisableReady: boolean;
  postTransactionAuditReady: boolean;
  liveWindowApproved: boolean;
  visibleInPublicProfile: boolean;
  telegramCanAuthorize: boolean;
  walletPromptRuntimeEnabled: boolean;
  walletSigningRuntimeEnabled: boolean;
  transactionSubmissionRuntimeEnabled: boolean;
}

export interface ControlledLiveTransactionGateResult {
  status: ControlledLiveTransactionStatus;
  liveWindowApproved: boolean;
  ownerOnly: true;
  walletPromptAllowed: false;
  walletSigningAllowed: false;
  transactionSubmissionAllowed: false;
  reasons: ControlledLiveTransactionBlockReason[];
  message: string;
}

const blockMessages: Record<ControlledLiveTransactionBlockReason, string> = {
  owner_scope_required:
    "Controlled live transaction requires an owner session.",
  workspace_scope_required:
    "Controlled live transaction requires one workspace scope.",
  agent_scope_required:
    "Controlled live transaction requires one deployed agent scope.",
  base_account_required:
    "Connect one owner wallet before a live window can be reviewed.",
  base_network_required:
    "Controlled live transaction must target the selected runtime network.",
  single_action_required:
    "Controlled live transaction allows exactly one prepared action.",
  allowlisted_action_required:
    "The prepared action must pass the deterministic allowlist.",
  low_risk_action_required:
    "The first live transaction candidate must be low risk.",
  dual_approval_required:
    "Kyra owner approval and wallet approval boundaries must be ready.",
  result_monitoring_required:
    "Result monitoring and closeout must be ready before a live window.",
  rollback_required:
    "Rollback must be ready before any controlled live transaction.",
  emergency_disable_required:
    "Emergency disablement must be ready before any live window.",
  post_transaction_audit_required:
    "Post-transaction audit must be ready before any live window.",
  public_visibility_forbidden:
    "Controlled live transaction state must stay owner-only.",
  telegram_authority_forbidden:
    "Telegram cannot authorize or execute controlled live transactions.",
  runtime_execution_must_remain_locked:
    "Wallet prompt, signing, and submission runtime switches must remain locked in Phase 7J.",
};

export function evaluateControlledLiveTransactionGate(
  input: ControlledLiveTransactionGateInput,
): ControlledLiveTransactionGateResult {
  const reasons: ControlledLiveTransactionBlockReason[] = [];

  if (!input.ownerUserId.trim()) {
    reasons.push("owner_scope_required");
  }

  if (!input.workspaceId.trim()) {
    reasons.push("workspace_scope_required");
  }

  if (!input.agentId.trim()) {
    reasons.push("agent_scope_required");
  }

  if (!input.baseAccountConnected) {
    reasons.push("base_account_required");
  }

  if (input.chainId !== baseChainId) {
    reasons.push("base_network_required");
  }

  if (input.preparedActionCount !== 1) {
    reasons.push("single_action_required");
  }

  if (!input.actionAllowlisted) {
    reasons.push("allowlisted_action_required");
  }

  if (input.actionRisk !== "low") {
    reasons.push("low_risk_action_required");
  }

  if (
    input.dualApproval.reasons.length > 0 ||
    input.dualApproval.walletPromptAllowed ||
    input.dualApproval.transactionSubmissionAllowed
  ) {
    reasons.push("dual_approval_required");
  }

  if (
    input.resultMonitoring.reasons.length > 0 ||
    !input.resultMonitoring.ownerOnly ||
    input.resultMonitoring.txHash !== null
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

  if (input.visibleInPublicProfile) {
    reasons.push("public_visibility_forbidden");
  }

  if (input.telegramCanAuthorize) {
    reasons.push("telegram_authority_forbidden");
  }

  if (
    input.walletPromptRuntimeEnabled ||
    input.walletSigningRuntimeEnabled ||
    input.transactionSubmissionRuntimeEnabled
  ) {
    reasons.push("runtime_execution_must_remain_locked");
  }

  const uniqueReasons = [...new Set(reasons)];
  const readyStatus: ControlledLiveTransactionStatus = input.liveWindowApproved
    ? "live_window_approved_runtime_locked"
    : "ready_for_live_window_approval";

  return {
    status: uniqueReasons.length ? "blocked" : readyStatus,
    liveWindowApproved: input.liveWindowApproved,
    ownerOnly: true,
    walletPromptAllowed: false,
    walletSigningAllowed: false,
    transactionSubmissionAllowed: false,
    reasons: uniqueReasons,
    message: uniqueReasons.length
      ? blockMessages[uniqueReasons[0]]
      : input.liveWindowApproved
        ? "Live window is approved, but Phase 7J keeps wallet prompt, signing, and submission runtime locked."
        : "Controlled live transaction gate is ready for explicit live-window approval.",
  };
}

export function getControlledLiveTransactionBlockMessage(
  reason: ControlledLiveTransactionBlockReason,
) {
  return blockMessages[reason];
}
