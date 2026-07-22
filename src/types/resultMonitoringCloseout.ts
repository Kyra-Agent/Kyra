
import {
  isTransactionHash,
} from "./walletSigning";
import type { ExecutionFailureCode } from "./executionResult";

export type ResultMonitorProviderStatus =
  | "not_started"
  | "owner_rejected"
  | "wallet_cancelled"
  | "provider_submitted"
  | "provider_failed"
  | "confirmed"
  | "expired"
  | "emergency_disabled";

export type ResultMonitorCloseoutStatus =
  | "not_started"
  | "closed_rejected"
  | "closed_cancelled"
  | "submitted_pending_confirmation"
  | "closed_confirmed"
  | "closed_failed"
  | "closed_expired"
  | "closed_disabled";

export type ResultMonitorBlockReason =
  | "owner_scope_required"
  | "prepared_action_required"
  | "provider_submission_required_for_tx_hash"
  | "transaction_hash_required_after_submission"
  | "confirmation_required"
  | "sanitized_failure_required"
  | "public_visibility_forbidden"
  | "disconnect_requires_closed_state";

export interface ResultMonitoringInput {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  preparedActionId: string;
  providerStatus: ResultMonitorProviderStatus;
  txHash?: string | null;
  confirmationId?: string | null;
  failureCode?: ExecutionFailureCode | null;
  disconnectRequested: boolean;
  emergencyDisabled: boolean;
  visibleInPublicProfile: boolean;
}

export interface ResultMonitoringCloseout {
  status: ResultMonitorCloseoutStatus;
  ownerOnly: true;
  txHash: `0x${string}` | null;
  confirmationId: string | null;
  sanitizedFailureReason: string | null;
  disconnectAllowed: boolean;
  emergencyDisabled: boolean;
  reasons: ResultMonitorBlockReason[];
  message: string;
}

const failureMessages: Record<ExecutionFailureCode, string> = {
  user_rejected: "User rejected the wallet request.",
  network_mismatch: "Wallet must be connected to the selected network.",
  submission_failed: "Transaction submission failed safely.",
  confirmation_timeout: "Transaction confirmation was not observed in time.",
  unsupported_action: "This execution action is not supported.",
  unknown: "Execution failed safely.",
};

const blockMessages: Record<ResultMonitorBlockReason, string> = {
  owner_scope_required:
    "Result monitoring requires owner, workspace, and agent scope.",
  prepared_action_required:
    "Result monitoring requires a prepared action id.",
  provider_submission_required_for_tx_hash:
    "Transaction hash is forbidden until provider submission is observed.",
  transaction_hash_required_after_submission:
    "Submitted or confirmed results require a valid transaction hash.",
  confirmation_required:
    "Confirmed results require provider confirmation data.",
  sanitized_failure_required:
    "Failed results require a sanitized failure reason.",
  public_visibility_forbidden:
    "Execution results must stay owner-only and out of public profiles.",
  disconnect_requires_closed_state:
    "Disconnect is allowed only after a closed, expired, or disabled result state.",
};

export function evaluateResultMonitoringCloseout(
  input: ResultMonitoringInput,
): ResultMonitoringCloseout {
  const reasons: ResultMonitorBlockReason[] = [];

  if (!input.ownerUserId.trim() || !input.workspaceId.trim() || !input.agentId.trim()) {
    reasons.push("owner_scope_required");
  }

  if (!input.preparedActionId.trim()) {
    reasons.push("prepared_action_required");
  }

  if (input.visibleInPublicProfile) {
    reasons.push("public_visibility_forbidden");
  }

  if (
    input.txHash &&
    input.providerStatus !== "provider_submitted" &&
    input.providerStatus !== "confirmed"
  ) {
    reasons.push("provider_submission_required_for_tx_hash");
  }

  if (
    (input.providerStatus === "provider_submitted" ||
      input.providerStatus === "confirmed") &&
    !isTransactionHash(input.txHash)
  ) {
    reasons.push("transaction_hash_required_after_submission");
  }

  if (input.providerStatus === "confirmed" && !input.confirmationId?.trim()) {
    reasons.push("confirmation_required");
  }

  if (
    input.providerStatus === "provider_failed" &&
    !sanitizeResultMonitoringFailure(input.failureCode ?? null)
  ) {
    reasons.push("sanitized_failure_required");
  }

  const status = mapProviderStatus(input);
  const closed = isClosedResultStatus(status);

  if (input.disconnectRequested && !closed) {
    reasons.push("disconnect_requires_closed_state");
  }

  const uniqueReasons = [...new Set(reasons)];
  const sanitizedFailureReason = input.providerStatus === "provider_failed"
    ? sanitizeResultMonitoringFailure(input.failureCode ?? "unknown")
    : null;

  return {
    status: uniqueReasons.length ? "closed_failed" : status,
    ownerOnly: true,
    txHash: isTransactionHash(input.txHash) &&
        (input.providerStatus === "provider_submitted" ||
          input.providerStatus === "confirmed")
      ? input.txHash
      : null,
    confirmationId: input.providerStatus === "confirmed"
      ? input.confirmationId?.trim() ?? null
      : null,
    sanitizedFailureReason,
    disconnectAllowed: input.disconnectRequested ? closed && uniqueReasons.length === 0 : closed,
    emergencyDisabled: input.emergencyDisabled ||
      input.providerStatus === "emergency_disabled",
    reasons: uniqueReasons,
    message: uniqueReasons.length
      ? blockMessages[uniqueReasons[0]]
      : getCloseoutMessage(status),
  };
}

export function sanitizeResultMonitoringFailure(
  code: ExecutionFailureCode | null,
): string | null {
  if (!code) {
    return null;
  }

  return failureMessages[code] ?? failureMessages.unknown;
}

export function getResultMonitoringBlockMessage(
  reason: ResultMonitorBlockReason,
) {
  return blockMessages[reason];
}

function mapProviderStatus(
  input: ResultMonitoringInput,
): ResultMonitorCloseoutStatus {
  if (input.emergencyDisabled || input.providerStatus === "emergency_disabled") {
    return "closed_disabled";
  }

  switch (input.providerStatus) {
    case "not_started":
      return "not_started";
    case "owner_rejected":
      return "closed_rejected";
    case "wallet_cancelled":
      return "closed_cancelled";
    case "provider_submitted":
      return "submitted_pending_confirmation";
    case "provider_failed":
      return "closed_failed";
    case "confirmed":
      return "closed_confirmed";
    case "expired":
      return "closed_expired";
  }
}

function isClosedResultStatus(status: ResultMonitorCloseoutStatus) {
  return status === "closed_rejected" ||
    status === "closed_cancelled" ||
    status === "closed_confirmed" ||
    status === "closed_failed" ||
    status === "closed_expired" ||
    status === "closed_disabled";
}

function getCloseoutMessage(status: ResultMonitorCloseoutStatus) {
  switch (status) {
    case "not_started":
      return "No provider submission has been observed.";
    case "submitted_pending_confirmation":
      return "Provider submission observed. Confirmation is still pending.";
    case "closed_confirmed":
      return "Provider confirmation recorded in owner-only result state.";
    case "closed_rejected":
      return "Owner rejection closed the result without submission.";
    case "closed_cancelled":
      return "Wallet cancellation closed the result without submission.";
    case "closed_failed":
      return "Execution result closed with sanitized failure state.";
    case "closed_expired":
      return "Execution result expired without submission.";
    case "closed_disabled":
      return "Execution result closed by emergency disablement.";
  }
}
