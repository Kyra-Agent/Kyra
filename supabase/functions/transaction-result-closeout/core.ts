import {
  isAllowedOwnerTransactionValueWei,
  ownerTransactionCalldata,
  ownerTransactionPolicyVersion,
  ownerTransactionValueWei,
} from "../_shared/owner-transaction-policy.ts";

export type ExecutionResultStatus = "submitted" | "confirmed" | "failed";
export type ExecutionResultFailureCode =
  | "submission_failed"
  | "transaction_reverted"
  | "receipt_unavailable";

export interface TransactionResultCloseoutBody {
  workspaceId: string;
  agentId: string;
  preparedActionId: string;
  txHash: string;
}

export interface ExistingExecutionResult {
  id: string;
  owner_user_id: string;
  workspace_id: string;
  agent_id: string;
  prepared_action_id: string;
  prepared_action_record_id: string;
  submission_key: string;
  tx_hash: string;
  status: ExecutionResultStatus;
}

export interface StoredTransactionIntent {
  id: string;
  workspace_id: string;
  agent_id: string;
  request_id: string;
  action_kind: "robinhood_reviewed_transaction";
  chain_key: "robinhood_mainnet";
  chain_id: 4663;
  status: "approved";
  recipient: string;
  value_wei: typeof ownerTransactionValueWei;
  calldata: typeof ownerTransactionCalldata;
  policy_version: typeof ownerTransactionPolicyVersion;
  expires_at: string;
}

export interface VerifiedTransactionResult {
  status: ExecutionResultStatus;
  failureCode: ExecutionResultFailureCode | null;
  blockNumber: number | null;
  checkedAt: string;
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
const addressPattern = /^0x[0-9a-f]{40}$/iu;

export function assertTransactionResultCloseoutBody(
  value: unknown,
): TransactionResultCloseoutBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_body",
      "A valid closeout body is required.",
    );
  }

  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).sort().join(",") !==
      "agentId,preparedActionId,txHash,workspaceId"
  ) {
    throw new HttpError(
      400,
      "invalid_body",
      "Only owner scope and the transaction hash may be submitted for closeout.",
    );
  }
  const workspaceId = readUuid(body.workspaceId, "workspace_id_required");
  const agentId = readUuid(body.agentId, "agent_id_required");
  const preparedActionId = readPattern(
    body.preparedActionId,
    preparedActionPattern,
    "prepared_action_required",
  );
  const txHash =
    typeof body.txHash === "string" && transactionHashPattern.test(body.txHash)
      ? body.txHash.toLowerCase()
      : null;

  if (!txHash) {
    throw new HttpError(
      400,
      "transaction_hash_required",
      "A valid transaction hash is required.",
    );
  }

  return {
    workspaceId,
    agentId,
    preparedActionId,
    txHash,
  };
}

export function assertStoredTransactionIntent(
  value: unknown,
  expected: {
    workspaceId: string;
    agentId: string;
    preparedActionId: string;
  },
  now = new Date(),
  allowExpired = false,
): StoredTransactionIntent {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(
      404,
      "transaction_intent_not_found",
      "The prepared transaction was not found.",
    );
  }

  const intent = value as StoredTransactionIntent;
  const expiresAt = Date.parse(intent.expires_at);
  const matches = intent.workspace_id === expected.workspaceId &&
    intent.agent_id === expected.agentId &&
    intent.request_id === expected.preparedActionId &&
    intent.action_kind === "robinhood_reviewed_transaction" &&
    intent.chain_key === "robinhood_mainnet" &&
    intent.chain_id === 4663 &&
    intent.status === "approved" &&
    typeof intent.recipient === "string" &&
    addressPattern.test(intent.recipient) &&
    isAllowedOwnerTransactionValueWei(intent.value_wei) &&
    intent.calldata === ownerTransactionCalldata &&
    intent.policy_version === ownerTransactionPolicyVersion &&
    Number.isFinite(expiresAt) &&
    (allowExpired || expiresAt > now.getTime());

  if (!matches) {
    throw new HttpError(
      409,
      "transaction_intent_invalid",
      "The prepared transaction is expired or does not match the owner-scoped action.",
    );
  }

  return intent;
}

export function deriveVerifiedResult(
  receipt: { status?: unknown; blockNumber?: unknown } | null,
  checkedAt = new Date().toISOString(),
): VerifiedTransactionResult {
  if (!receipt) {
    return {
      status: "submitted",
      failureCode: null,
      blockNumber: null,
      checkedAt,
    };
  }

  const status = parseRpcQuantity(receipt.status, "receipt_status_invalid");
  const blockNumber = parseRpcQuantity(
    receipt.blockNumber,
    "receipt_block_invalid",
  );

  if (status === 1) {
    return { status: "confirmed", failureCode: null, blockNumber, checkedAt };
  }
  if (status === 0) {
    return {
      status: "failed",
      failureCode: "transaction_reverted",
      blockNumber,
      checkedAt,
    };
  }

  throw new HttpError(
    502,
    "receipt_status_invalid",
    "The provider returned an invalid receipt status.",
  );
}

export function assertExistingScope(
  existing: ExistingExecutionResult,
  expected: {
    ownerUserId: string;
    workspaceId: string;
    agentId: string;
    preparedActionRecordId: string;
    preparedActionId: string;
    submissionKey: string;
    txHash: string;
  },
) {
  const matches = existing.owner_user_id === expected.ownerUserId &&
    existing.workspace_id === expected.workspaceId &&
    existing.agent_id === expected.agentId &&
    existing.prepared_action_id === expected.preparedActionId &&
    existing.prepared_action_record_id === expected.preparedActionRecordId &&
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
    throw new HttpError(
      400,
      code,
      "A valid owner-scoped identifier is required.",
    );
  }
  return value.toLowerCase();
}

function readPattern(value: unknown, pattern: RegExp, code: string) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new HttpError(
      400,
      code,
      "A valid sanitized closeout reference is required.",
    );
  }
  return value;
}

function parseRpcQuantity(value: unknown, code: string) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/iu.test(value)) {
    throw new HttpError(
      502,
      code,
      "The provider returned an invalid transaction receipt.",
    );
  }
  const parsed = Number.parseInt(value.slice(2), 16);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new HttpError(
      502,
      code,
      "The provider returned an invalid transaction receipt.",
    );
  }
  return parsed;
}
