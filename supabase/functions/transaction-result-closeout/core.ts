export type ExecutionResultStatus = "submitted" | "confirmed" | "failed";
export type ExecutionResultFailureCode =
  | "submission_failed"
  | "transaction_reverted"
  | "receipt_unavailable";

export interface TransactionResultCloseoutBody {
  workspaceId: string;
  agentId: string;
  preparedActionId: string;
  submissionNonce: string;
  txHash: string;
  status: ExecutionResultStatus;
  failureCode: ExecutionResultFailureCode | null;
}

export interface ExistingExecutionResult {
  id: string;
  owner_user_id: string;
  workspace_id: string;
  agent_id: string;
  prepared_action_id: string;
  submission_key: string;
  tx_hash: string;
  status: ExecutionResultStatus;
}

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const transactionHashPattern = /^0x[0-9a-f]{64}$/iu;
const preparedActionPattern = /^[a-z0-9._:-]{1,160}$/iu;
const submissionNoncePattern = /^[a-z0-9._:-]{12,200}$/iu;
const failureCodes = new Set<ExecutionResultFailureCode>([
  "submission_failed",
  "transaction_reverted",
  "receipt_unavailable",
]);

export function assertTransactionResultCloseoutBody(
  value: unknown,
): TransactionResultCloseoutBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_body", "A valid closeout body is required.");
  }

  const body = value as Record<string, unknown>;
  const workspaceId = readUuid(body.workspaceId, "workspace_id_required");
  const agentId = readUuid(body.agentId, "agent_id_required");
  const preparedActionId = readPattern(
    body.preparedActionId,
    preparedActionPattern,
    "prepared_action_required",
  );
  const submissionNonce = readPattern(
    body.submissionNonce,
    submissionNoncePattern,
    "submission_nonce_required",
  );
  const txHash = typeof body.txHash === "string" && transactionHashPattern.test(body.txHash)
    ? body.txHash.toLowerCase()
    : null;
  const status = body.status === "submitted" ||
      body.status === "confirmed" ||
      body.status === "failed"
    ? body.status
    : null;
  const failureCode = body.failureCode === null || body.failureCode === undefined
    ? null
    : typeof body.failureCode === "string" &&
        failureCodes.has(body.failureCode as ExecutionResultFailureCode)
    ? body.failureCode as ExecutionResultFailureCode
    : undefined;

  if (!txHash) {
    throw new HttpError(400, "transaction_hash_required", "A valid transaction hash is required.");
  }

  if (!status) {
    throw new HttpError(400, "status_required", "A supported closeout status is required.");
  }

  if (failureCode === undefined || (status === "failed" && !failureCode) ||
    (status !== "failed" && failureCode)) {
    throw new HttpError(
      400,
      "failure_code_invalid",
      "Failure code must be sanitized and present only for failed results.",
    );
  }

  return {
    workspaceId,
    agentId,
    preparedActionId,
    submissionNonce,
    txHash,
    status,
    failureCode,
  };
}

export function assertExistingScope(
  existing: ExistingExecutionResult,
  expected: {
    ownerUserId: string;
    workspaceId: string;
    agentId: string;
    preparedActionId: string;
    submissionKey: string;
    txHash: string;
  },
) {
  const matches =
    existing.owner_user_id === expected.ownerUserId &&
    existing.workspace_id === expected.workspaceId &&
    existing.agent_id === expected.agentId &&
    existing.prepared_action_id === expected.preparedActionId &&
    existing.submission_key === expected.submissionKey &&
    existing.tx_hash.toLowerCase() === expected.txHash.toLowerCase();

  if (!matches) {
    throw new HttpError(
      409,
      "closeout_scope_conflict",
      "The closeout reference does not match the existing owner-scoped result.",
    );
  }
}

export function canTransitionExecutionResult(
  current: ExecutionResultStatus,
  next: ExecutionResultStatus,
) {
  if (current === next) return true;
  return current === "submitted" && (next === "confirmed" || next === "failed");
}

export function isStaleSubmittedResult(
  current: ExecutionResultStatus,
  next: ExecutionResultStatus,
) {
  return next === "submitted" &&
    (current === "confirmed" || current === "failed");
}

function readUuid(value: unknown, code: string) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new HttpError(400, code, "A valid owner-scoped identifier is required.");
  }
  return value.toLowerCase();
}

function readPattern(value: unknown, pattern: RegExp, code: string) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new HttpError(400, code, "A valid sanitized closeout reference is required.");
  }
  return value;
}
