import { isTransactionHash } from "./walletSigning";

export type ExecutionResultStatus =
  | "pending"
  | "approved"
  | "rejected"
  | "submitted"
  | "failed"
  | "confirmed";

export type ExecutionResultEvent =
  | "approve"
  | "reject"
  | "submit"
  | "fail"
  | "confirm";

export type ExecutionFailureCode =
  | "user_rejected"
  | "network_mismatch"
  | "submission_failed"
  | "confirmation_timeout"
  | "unsupported_action"
  | "unknown";

export interface ExecutionResultRecord {
  id: string;
  preparedActionId: string;
  workspaceId: string;
  agentId: string;
  ownerUserId: string;
  status: ExecutionResultStatus;
  createdAt: string;
  updatedAt: string;
  publicSummary: string;
  submittedAt?: string | null;
  confirmedAt?: string | null;
  txHash?: `0x${string}` | null;
  confirmationId?: string | null;
  sanitizedFailureReason?: string | null;
  visibleInPublicProfile: false;
}

export interface ExecutionResultTransitionInput {
  status: ExecutionResultStatus;
  event: ExecutionResultEvent;
  ownerAction?: boolean;
  txHash?: string | null;
  confirmationId?: string | null;
  failureCode?: ExecutionFailureCode | null;
}

export interface ExecutionResultTransitionResult {
  ok: boolean;
  status: ExecutionResultStatus;
  reason: string | null;
  sanitizedFailureReason?: string | null;
}

export interface ExecutionResultValidation {
  ok: boolean;
  errors: string[];
}

const allowedTransitions: Record<ExecutionResultStatus, ExecutionResultEvent[]> =
  {
    pending: ["approve", "reject", "fail"],
    approved: ["submit", "reject", "fail"],
    rejected: [],
    submitted: ["confirm", "fail"],
    failed: [],
    confirmed: [],
  };

const executionFailureMessages: Record<ExecutionFailureCode, string> = {
  user_rejected: "User rejected the wallet request.",
  network_mismatch: "Wallet must be connected to Base.",
  submission_failed: "Transaction submission failed safely.",
  confirmation_timeout: "Transaction confirmation was not observed in time.",
  unsupported_action: "This execution action is not supported.",
  unknown: "Execution failed safely.",
};

export function transitionExecutionResult(
  input: ExecutionResultTransitionInput,
): ExecutionResultTransitionResult {
  if (!allowedTransitions[input.status].includes(input.event)) {
    return rejectTransition(
      input.status,
      "Execution result transition is not allowed.",
    );
  }

  switch (input.event) {
    case "approve":
      if (!input.ownerAction) {
        return rejectTransition(
          input.status,
          "Execution approval requires explicit owner action.",
        );
      }

      if (input.txHash) {
        return rejectTransition(
          input.status,
          "Approved actions must not include a transaction hash.",
        );
      }

      return allowTransition("approved");
    case "reject":
      if (input.txHash) {
        return rejectTransition(
          input.status,
          "Rejected actions must not include a transaction hash.",
        );
      }

      return allowTransition("rejected");
    case "submit":
      if (!isTransactionHash(input.txHash)) {
        return rejectTransition(
          input.status,
          "Submitted actions require a transaction hash.",
        );
      }

      return allowTransition("submitted");
    case "fail": {
      if (input.txHash && input.status !== "submitted") {
        return rejectTransition(
          input.status,
          "Failed actions before submission must not include a transaction hash.",
        );
      }

      const sanitizedFailureReason = sanitizeExecutionFailureReason(
        input.failureCode ?? "unknown",
      );

      return {
        ...allowTransition("failed"),
        sanitizedFailureReason,
      };
    }
    case "confirm":
      if (!isTransactionHash(input.txHash)) {
        return rejectTransition(
          input.status,
          "Confirmed actions require a submitted transaction hash.",
        );
      }

      if (!input.confirmationId?.trim()) {
        return rejectTransition(
          input.status,
          "Confirmed actions require confirmation data.",
        );
      }

      return allowTransition("confirmed");
  }
}

export function validateExecutionResultRecord(
  record: ExecutionResultRecord,
): ExecutionResultValidation {
  const errors: string[] = [];

  for (
    const [field, value] of [
      ["id", record.id],
      ["preparedActionId", record.preparedActionId],
      ["workspaceId", record.workspaceId],
      ["agentId", record.agentId],
      ["ownerUserId", record.ownerUserId],
      ["createdAt", record.createdAt],
      ["updatedAt", record.updatedAt],
      ["publicSummary", record.publicSummary],
    ] as const
  ) {
    if (!value.trim()) {
      errors.push(`${field} is required.`);
    }
  }

  if (record.visibleInPublicProfile !== false) {
    errors.push("Execution results must not be public profile data.");
  }

  if (record.publicSummary.length > 180) {
    errors.push("Execution result public summary is too long.");
  }

  if (containsSensitiveExecutionText(record.publicSummary)) {
    errors.push("Execution result summary contains sensitive-looking text.");
  }

  if (record.sanitizedFailureReason) {
    if (containsSensitiveExecutionText(record.sanitizedFailureReason)) {
      errors.push("Execution failure reason contains sensitive-looking text.");
    }
  }

  if (record.txHash && !isTransactionHash(record.txHash)) {
    errors.push("Execution transaction hash is invalid.");
  }

  if (
    (record.status === "pending" ||
      record.status === "approved" ||
      record.status === "rejected") &&
    record.txHash
  ) {
    errors.push("Transaction hash is only allowed after submission.");
  }

  if (record.status === "submitted" && !record.txHash) {
    errors.push("Submitted execution results require a transaction hash.");
  }

  if (record.status === "confirmed") {
    if (!record.txHash) {
      errors.push("Confirmed execution results require a transaction hash.");
    }

    if (!record.confirmationId?.trim()) {
      errors.push("Confirmed execution results require confirmation data.");
    }
  }

  if (record.status === "failed" && !record.sanitizedFailureReason?.trim()) {
    errors.push("Failed execution results require a sanitized reason.");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function sanitizeExecutionFailureReason(
  code: ExecutionFailureCode,
): string {
  return executionFailureMessages[code] ?? executionFailureMessages.unknown;
}

export function formatExecutionResultForActivity(
  record: ExecutionResultRecord,
) {
  const txLabel = record.txHash ? ` tx ${shortenTransactionHash(record.txHash)}` : "";
  const failureLabel = record.sanitizedFailureReason
    ? `: ${record.sanitizedFailureReason}`
    : "";

  return `${record.status.replace(/_/g, " ")}${txLabel}${failureLabel}`;
}

function allowTransition(
  status: ExecutionResultStatus,
): ExecutionResultTransitionResult {
  return {
    ok: true,
    status,
    reason: null,
  };
}

function rejectTransition(
  status: ExecutionResultStatus,
  reason: string,
): ExecutionResultTransitionResult {
  return {
    ok: false,
    status,
    reason,
  };
}

function shortenTransactionHash(hash: `0x${string}`) {
  return `${hash.slice(0, 8)}...${hash.slice(-6)}`;
}

function containsSensitiveExecutionText(value: string) {
  return /(?:sk-or-v1-|bot\d{6,}:[\w-]{20,}|seed phrase|private key|mnemonic|0x[a-fA-F0-9]{64})/u
    .test(value);
}
