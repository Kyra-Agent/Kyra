import { isTransactionHash } from "./walletSigning";

export type Phase8SmokeCloseoutInputStatus =
  | "not_started"
  | "submitted"
  | "confirmed"
  | "failed"
  | "aborted";

export type Phase8SmokeCloseoutStatus =
  | "not_started"
  | "submitted_pending_confirmation"
  | "closed_confirmed"
  | "closed_failed"
  | "closed_aborted"
  | "blocked";

export type Phase8SmokeCloseoutReason =
  | "owner_scope_required"
  | "prepared_action_required"
  | "owner_only_required"
  | "transaction_hash_required"
  | "confirmation_required"
  | "sanitized_failure_required"
  | "public_visibility_forbidden";

export interface Phase8SmokeCloseoutInput {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  preparedActionId: string;
  status: Phase8SmokeCloseoutInputStatus;
  ownerOnly: boolean;
  txHash?: string | null;
  confirmationId?: string | null;
  sanitizedFailureReason?: string | null;
  visibleInPublicProfile: boolean;
}

export interface Phase8SmokeCloseoutResult {
  status: Phase8SmokeCloseoutStatus;
  ownerOnly: true;
  canContinueToPublicHardening: boolean;
  txHashLabel: string;
  confirmationLabel: string;
  reasons: Phase8SmokeCloseoutReason[];
  message: string;
}

const blockMessages: Record<Phase8SmokeCloseoutReason, string> = {
  owner_scope_required:
    "Controlled smoke closeout requires owner, workspace, and selected agent scope.",
  prepared_action_required:
    "Controlled smoke closeout requires a prepared action id.",
  owner_only_required:
    "Controlled smoke closeout must stay owner-only.",
  transaction_hash_required:
    "Submitted, confirmed, or failed smoke closeout requires a valid transaction hash.",
  confirmation_required:
    "Confirmed smoke closeout requires provider confirmation data.",
  sanitized_failure_required:
    "Failed smoke closeout requires a sanitized failure reason.",
  public_visibility_forbidden:
    "Controlled smoke closeout must not be visible in public profiles.",
};

export function evaluatePhase8SmokeCloseout(
  input: Phase8SmokeCloseoutInput,
): Phase8SmokeCloseoutResult {
  const reasons: Phase8SmokeCloseoutReason[] = [];

  if (!input.ownerUserId.trim() || !input.workspaceId.trim() || !input.agentId.trim()) {
    reasons.push("owner_scope_required");
  }

  if (!input.preparedActionId.trim()) {
    reasons.push("prepared_action_required");
  }

  if (!input.ownerOnly) {
    reasons.push("owner_only_required");
  }

  if (input.visibleInPublicProfile) {
    reasons.push("public_visibility_forbidden");
  }

  if (requiresTransactionHash(input.status) && !isTransactionHash(input.txHash)) {
    reasons.push("transaction_hash_required");
  }

  if (input.status === "confirmed" && !input.confirmationId?.trim()) {
    reasons.push("confirmation_required");
  }

  if (input.status === "failed" && !input.sanitizedFailureReason?.trim()) {
    reasons.push("sanitized_failure_required");
  }

  const uniqueReasons = [...new Set(reasons)];
  if (uniqueReasons.length) {
    return {
      status: "blocked",
      ownerOnly: true,
      canContinueToPublicHardening: false,
      txHashLabel: maskPhase8SmokeHash(input.txHash),
      confirmationLabel: input.confirmationId?.trim() ? "recorded" : "missing",
      reasons: uniqueReasons,
      message: blockMessages[uniqueReasons[0]],
    };
  }

  const status = mapSmokeStatus(input.status);
  return {
    status,
    ownerOnly: true,
    canContinueToPublicHardening: status === "closed_confirmed" || status === "closed_failed" || status === "closed_aborted",
    txHashLabel: maskPhase8SmokeHash(input.txHash),
    confirmationLabel: input.status === "confirmed" ? "recorded" : "not required",
    reasons: [],
    message: getPhase8SmokeCloseoutMessage(status),
  };
}

export function getPhase8SmokeCloseoutBlockMessage(
  reason: Phase8SmokeCloseoutReason,
) {
  return blockMessages[reason];
}

function requiresTransactionHash(status: Phase8SmokeCloseoutInputStatus) {
  return status === "submitted" || status === "confirmed" || status === "failed";
}

function mapSmokeStatus(status: Phase8SmokeCloseoutInputStatus): Phase8SmokeCloseoutStatus {
  switch (status) {
    case "not_started":
      return "not_started";
    case "submitted":
      return "submitted_pending_confirmation";
    case "confirmed":
      return "closed_confirmed";
    case "failed":
      return "closed_failed";
    case "aborted":
      return "closed_aborted";
  }
}

function getPhase8SmokeCloseoutMessage(status: Phase8SmokeCloseoutStatus) {
  switch (status) {
    case "not_started":
      return "Controlled smoke has not started. No transaction hash exists.";
    case "submitted_pending_confirmation":
      return "Controlled smoke submitted. Confirmation remains owner-only and pending.";
    case "closed_confirmed":
      return "Controlled smoke confirmed and closed under owner-only audit.";
    case "closed_failed":
      return "Controlled smoke failed safely and closed with sanitized evidence.";
    case "closed_aborted":
      return "Controlled smoke aborted before provider submission.";
    case "blocked":
      return "Controlled smoke closeout is blocked.";
  }
}

function maskPhase8SmokeHash(hash: string | null | undefined) {
  return isTransactionHash(hash) ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : "not recorded";
}