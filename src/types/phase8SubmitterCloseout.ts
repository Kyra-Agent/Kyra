import type {
  Phase8ControlledSubmissionResultEvent,
} from "./phase8ControlledSubmission";
import { isTransactionHash } from "./walletSigning";

export type Phase8SubmitterCloseoutFailure =
  | "owner_scope_required"
  | "prepared_action_required"
  | "submission_nonce_required"
  | "transaction_hash_required";

export interface Phase8SubmitterCloseoutInput {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  preparedActionId: string;
  submissionNonce: string;
  txHash: string;
  createdAt: string;
}

export interface Phase8SubmitterCloseoutResult {
  ok: boolean;
  event: Phase8ControlledSubmissionResultEvent | null;
  reason: Phase8SubmitterCloseoutFailure | null;
}

export function createPhase8SubmittedCloseoutEvent(
  input: Phase8SubmitterCloseoutInput,
): Phase8SubmitterCloseoutResult {
  if (
    !input.ownerUserId.trim() ||
    !input.workspaceId.trim() ||
    !input.agentId.trim()
  ) {
    return reject("owner_scope_required");
  }

  if (!input.preparedActionId.trim()) {
    return reject("prepared_action_required");
  }

  if (!input.submissionNonce.trim()) {
    return reject("submission_nonce_required");
  }

  if (!isTransactionHash(input.txHash)) {
    return reject("transaction_hash_required");
  }

  return {
    ok: true,
    reason: null,
    event: {
      state: "submitted",
      ownerOnly: true,
      sanitized: true,
      txHash: input.txHash,
      message: "Submitted with sanitized hash reference.",
      createdAt: input.createdAt,
    },
  };
}

export function getPhase8SubmitterCloseoutFailureMessage(
  reason: Phase8SubmitterCloseoutFailure,
) {
  switch (reason) {
    case "owner_scope_required":
      return "Owner, workspace, and agent scope are required before recording closeout.";
    case "prepared_action_required":
      return "Prepared action scope is required before recording closeout.";
    case "submission_nonce_required":
      return "Submission nonce is required before recording closeout.";
    case "transaction_hash_required":
      return "A valid transaction hash is required before recording closeout.";
  }
}

function reject(
  reason: Phase8SubmitterCloseoutFailure,
): Phase8SubmitterCloseoutResult {
  return {
    ok: false,
    event: null,
    reason,
  };
}
