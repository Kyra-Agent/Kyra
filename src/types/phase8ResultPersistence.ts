
import type { DemoExecutionResult } from "./backend";
import type {
  Phase8ControlledSubmissionResultEvent,
} from "./phase8ControlledSubmission";
import { isTransactionHash } from "./walletSigning";

export type Phase8PersistedResultStatus =
  | "submitted"
  | "confirmed"
  | "failed";

export type Phase8ResultPersistenceFailure =
  | "owner_scope_required"
  | "prepared_action_required"
  | "transaction_hash_required"
  | "owner_only_required"
  | "sanitized_event_required"
  | "unsupported_state";

export interface Phase8ResultPersistenceInput {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  preparedActionId: string;
  submissionNonce: string;
  event: Phase8ControlledSubmissionResultEvent;
}

export interface Phase8PersistedExecutionResult {
  id: string;
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  preparedActionId: string;
  submissionNonce: string;
  status: Phase8PersistedResultStatus;
  txHash: `0x${string}`;
  txHashLabel: string;
  label: string;
  summary: string;
  failureReason: string | null;
  visibility: "owner-only";
  createdAt: string;
  updatedAt: string;
}

export interface Phase8ResultPersistenceResult {
  ok: boolean;
  record: Phase8PersistedExecutionResult | null;
  reason: Phase8ResultPersistenceFailure | null;
}

export function createPhase8PersistedExecutionResult(
  input: Phase8ResultPersistenceInput,
): Phase8ResultPersistenceResult {
  if (
    !input.ownerUserId.trim() ||
    !input.workspaceId.trim() ||
    !input.agentId.trim() ||
    !input.submissionNonce.trim()
  ) {
    return reject("owner_scope_required");
  }

  if (!input.preparedActionId.trim()) {
    return reject("prepared_action_required");
  }

  if (!input.event.ownerOnly) {
    return reject("owner_only_required");
  }

  if (!input.event.sanitized) {
    return reject("sanitized_event_required");
  }

  if (
    input.event.state !== "submitted" &&
    input.event.state !== "confirmed" &&
    input.event.state !== "failed"
  ) {
    return reject("unsupported_state");
  }

  if (!isTransactionHash(input.event.txHash)) {
    return reject("transaction_hash_required");
  }

  return {
    ok: true,
    reason: null,
    record: {
      id: `phase8_result_${input.preparedActionId}_${input.submissionNonce}`,
      ownerUserId: input.ownerUserId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      preparedActionId: input.preparedActionId,
      submissionNonce: input.submissionNonce,
      status: input.event.state,
      txHash: input.event.txHash,
      txHashLabel: maskPhase8TransactionHash(input.event.txHash),
      label: getPhase8ResultLabel(input.event.state),
      summary: getPhase8ResultSummary(input.event.state),
      failureReason: input.event.state === "failed"
        ? "Controlled submit failed safely after provider response."
        : null,
      visibility: "owner-only",
      createdAt: input.event.createdAt,
      updatedAt: input.event.createdAt,
    },
  };
}

export function reconcilePhase8PersistedExecutionResult(
  record: Phase8PersistedExecutionResult,
  receiptStatus: "success" | "reverted" | null,
  updatedAt = new Date().toISOString(),
): Phase8PersistedExecutionResult {
  if (!receiptStatus) {
    return record;
  }

  const status: Phase8PersistedResultStatus = receiptStatus === "success"
    ? "confirmed"
    : "failed";

  if (record.status === status) {
    return record;
  }

  return {
    ...record,
    status,
    label: getPhase8ResultLabel(status),
    summary: getPhase8ResultSummary(status),
    failureReason: status === "failed"
      ? "Controlled transaction reverted without exposing provider internals."
      : null,
    updatedAt,
  };
}

export function mapPhase8PersistedResultToDemoExecutionResult(
  record: Phase8PersistedExecutionResult,
): DemoExecutionResult {
  return {
    id: record.id,
    preparedActionId: record.preparedActionId,
    agentId: record.agentId,
    status: record.status,
    label: record.label,
    summary: record.summary,
    txHashLabel: record.txHashLabel,
    failureReason: record.failureReason,
    visibility: "owner-only",
    updatedAt: formatPhase8ResultTime(record.updatedAt),
  };
}

export function getPhase8ResultPersistenceFailureMessage(
  reason: Phase8ResultPersistenceFailure,
) {
  switch (reason) {
    case "owner_scope_required":
      return "Owner, workspace, agent, and submission nonce scope are required before persisting the result.";
    case "prepared_action_required":
      return "Prepared action scope is required before persisting the result.";
    case "transaction_hash_required":
      return "A valid transaction hash is required before persisting the result.";
    case "owner_only_required":
      return "Execution result persistence must stay owner-only.";
    case "sanitized_event_required":
      return "Execution result persistence requires a sanitized event.";
    case "unsupported_state":
      return "Only submitted, confirmed, or failed controlled execution results can be persisted.";
  }
}

function reject(
  reason: Phase8ResultPersistenceFailure,
): Phase8ResultPersistenceResult {
  return {
    ok: false,
    record: null,
    reason,
  };
}

function getPhase8ResultLabel(status: Phase8PersistedResultStatus) {
  switch (status) {
    case "submitted":
      return "Submitted to network";
    case "confirmed":
      return "Confirmed on network";
    case "failed":
      return "Closed safely";
  }
}

function getPhase8ResultSummary(status: Phase8PersistedResultStatus) {
  switch (status) {
    case "submitted":
      return "Owner-controlled transaction submitted. Confirmation monitoring remains owner-only.";
    case "confirmed":
      return "Owner-controlled transaction confirmed and closed under owner-only audit.";
    case "failed":
      return "Owner-controlled transaction closed with sanitized failure state.";
  }
}

function maskPhase8TransactionHash(hash: `0x${string}`) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

function formatPhase8ResultTime(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}
