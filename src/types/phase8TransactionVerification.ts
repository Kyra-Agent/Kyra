import { isTransactionHash } from "./walletSigning";

export type Phase8TransactionVerificationReceiptStatus =
  | "success"
  | "reverted"
  | null;

export type Phase8TransactionVerificationStatus =
  | "not_started"
  | "pending_receipt"
  | "confirmed"
  | "failed"
  | "blocked";

export type Phase8TransactionVerificationReason =
  | "owner_scope_required"
  | "prepared_action_required"
  | "transaction_hash_required"
  | "receipt_pending"
  | "receipt_reverted"
  | "receipt_unavailable"
  | "public_visibility_forbidden";

export interface Phase8TransactionVerificationInput {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  preparedActionId: string;
  txHash: string | null | undefined;
  receiptStatus: Phase8TransactionVerificationReceiptStatus;
  receiptLoading: boolean;
  receiptError: boolean;
  visibleInPublicProfile: boolean;
}

export interface Phase8TransactionVerificationResult {
  status: Phase8TransactionVerificationStatus;
  ownerOnly: true;
  txHash: `0x${string}` | null;
  txHashLabel: string;
  confirmationId: string | null;
  sanitizedFailureReason: string | null;
  canPromoteToConfirmed: boolean;
  reasons: Phase8TransactionVerificationReason[];
  message: string;
}

const blockMessages: Record<Phase8TransactionVerificationReason, string> = {
  owner_scope_required:
    "Transaction verification requires owner, workspace, and selected agent scope.",
  prepared_action_required:
    "Transaction verification requires a prepared action id.",
  transaction_hash_required:
    "Transaction verification requires a valid transaction hash.",
  receipt_pending:
    "Transaction receipt is still pending on the selected network.",
  receipt_reverted:
    "Transaction receipt shows a reverted transaction.",
  receipt_unavailable:
    "Transaction receipt could not be read safely.",
  public_visibility_forbidden:
    "Transaction verification must stay out of public profiles.",
};

export function evaluatePhase8TransactionVerification(
  input: Phase8TransactionVerificationInput,
): Phase8TransactionVerificationResult {
  const reasons: Phase8TransactionVerificationReason[] = [];

  if (!input.ownerUserId.trim() || !input.workspaceId.trim() || !input.agentId.trim()) {
    reasons.push("owner_scope_required");
  }

  if (!input.preparedActionId.trim()) {
    reasons.push("prepared_action_required");
  }

  if (input.visibleInPublicProfile) {
    reasons.push("public_visibility_forbidden");
  }

  const txHash = isTransactionHash(input.txHash) ? input.txHash : null;
  if (input.txHash && !txHash) {
    reasons.push("transaction_hash_required");
  }

  if (!input.txHash) {
    return buildResult({
      status: reasons.length ? "blocked" : "not_started",
      txHash,
      reasons,
    });
  }

  if (!txHash) {
    return buildResult({ status: "blocked", txHash, reasons });
  }

  if (input.receiptError) {
    reasons.push("receipt_unavailable");
  } else if (input.receiptLoading || input.receiptStatus === null) {
    reasons.push("receipt_pending");
  } else if (input.receiptStatus === "reverted") {
    reasons.push("receipt_reverted");
  }

  const uniqueReasons = [...new Set(reasons)];
  if (uniqueReasons.length) {
    return buildResult({
      status: uniqueReasons.includes("receipt_pending") ? "pending_receipt" : "failed",
      txHash,
      reasons: uniqueReasons,
    });
  }

  return buildResult({ status: "confirmed", txHash, reasons: [] });
}

export function getPhase8TransactionVerificationBlockMessage(
  reason: Phase8TransactionVerificationReason,
) {
  return blockMessages[reason];
}

function buildResult(input: {
  status: Phase8TransactionVerificationStatus;
  txHash: `0x${string}` | null;
  reasons: Phase8TransactionVerificationReason[];
}): Phase8TransactionVerificationResult {
  const failureReason = input.reasons.includes("receipt_reverted")
    ? blockMessages.receipt_reverted
    : input.reasons.includes("receipt_unavailable")
    ? blockMessages.receipt_unavailable
    : null;

  return {
    status: input.status,
    ownerOnly: true,
    txHash: input.txHash,
    txHashLabel: maskHash(input.txHash),
    confirmationId: input.status === "confirmed" && input.txHash
      ? `receipt-${input.txHash.slice(2, 10)}`
      : null,
    sanitizedFailureReason: failureReason,
    canPromoteToConfirmed: input.status === "confirmed",
    reasons: input.reasons,
    message: input.reasons.length
      ? blockMessages[input.reasons[0]]
      : getMessage(input.status),
  };
}

function getMessage(status: Phase8TransactionVerificationStatus) {
  switch (status) {
    case "not_started":
      return "No submitted transaction hash is available for verification.";
    case "pending_receipt":
      return "Submitted transaction is waiting for a network receipt.";
    case "confirmed":
      return "Transaction receipt verified successfully under owner-only monitoring.";
    case "failed":
      return "Transaction verification closed with sanitized failure evidence.";
    case "blocked":
      return "Transaction verification is blocked.";
  }
}

function maskHash(hash: `0x${string}` | null) {
  return hash ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : "not recorded";
}
