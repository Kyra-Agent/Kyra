import {
  readAddress,
  swapExecutionPolicyVersion,
  type SwapExecutionStep,
  swapExecutionSteps,
} from "../_shared/swap-execution-policy.ts";
import {
  robinhoodMainnetChainId,
  robinhoodMainnetChainKey,
} from "../_shared/transfer-transaction-policy.ts";

export type SwapExecutionResultStatus = "submitted" | "confirmed" | "failed";
export type SwapExecutionFailureCode = "transaction_reverted";
export type SwapExecutionNextAction =
  | "wait_for_receipt"
  | "request_fresh_quote"
  | "retry_allowance"
  | "retry_swap"
  | "revoke_allowance"
  | "retry_revoke"
  | "complete";

export interface SwapResultCloseoutBody {
  workspaceId: string;
  agentId: string;
  intentRecordId: string;
  requestId: string;
  txHash: string;
}

export interface StoredSwapExecutionIntent {
  id: string;
  owner_user_id: string;
  workspace_id: string;
  agent_id: string;
  quote_review_id: string;
  request_id: string;
  step: SwapExecutionStep;
  chain_key: typeof robinhoodMainnetChainKey;
  chain_id: typeof robinhoodMainnetChainId;
  sender_address: string;
  transaction_to: string;
  transaction_data: string;
  transaction_value_wei: string;
  token_address: string | null;
  spender_address: string | null;
  allowance_amount_atomic: string | null;
  status: "approved";
  policy_version: typeof swapExecutionPolicyVersion;
  expires_at: string;
}

export interface ExistingSwapExecutionResult {
  id: string;
  owner_user_id: string;
  workspace_id: string;
  agent_id: string;
  intent_id: string;
  request_id: string;
  step: SwapExecutionStep;
  chain_key: typeof robinhoodMainnetChainKey;
  chain_id: typeof robinhoodMainnetChainId;
  submission_key: string;
  tx_hash: string;
  status: SwapExecutionResultStatus;
}

export interface VerifiedSwapExecutionResult {
  status: SwapExecutionResultStatus;
  failureCode: SwapExecutionFailureCode | null;
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
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/u;
const transactionHashPattern = /^0x[0-9a-f]{64}$/iu;
const calldataPattern = /^0x(?:[0-9a-f]{2})+$/iu;
const decimalPattern = /^(?:0|[1-9][0-9]*)$/u;

export function assertSwapResultCloseoutBody(
  value: unknown,
): SwapResultCloseoutBody {
  if (!isRecord(value)) throw invalidBody();
  if (
    Object.keys(value).sort().join(",") !==
      "agentId,intentRecordId,requestId,txHash,workspaceId"
  ) {
    throw invalidBody();
  }
  if (
    typeof value.workspaceId !== "string" ||
    !uuidPattern.test(value.workspaceId) ||
    typeof value.agentId !== "string" ||
    !uuidPattern.test(value.agentId) ||
    typeof value.intentRecordId !== "string" ||
    !uuidPattern.test(value.intentRecordId) ||
    typeof value.requestId !== "string" ||
    !requestIdPattern.test(value.requestId) ||
    typeof value.txHash !== "string" ||
    !transactionHashPattern.test(value.txHash)
  ) {
    throw invalidBody();
  }
  return {
    workspaceId: value.workspaceId.toLowerCase(),
    agentId: value.agentId.toLowerCase(),
    intentRecordId: value.intentRecordId.toLowerCase(),
    requestId: value.requestId,
    txHash: value.txHash.toLowerCase(),
  };
}

export function assertStoredSwapExecutionIntent(
  value: unknown,
  expected: SwapResultCloseoutBody & { ownerUserId: string },
): StoredSwapExecutionIntent {
  if (!isRecord(value)) throw invalidIntent();
  const intent = value as unknown as StoredSwapExecutionIntent;
  const sender = readAddress(intent.sender_address);
  const target = readAddress(intent.transaction_to);
  const token = intent.token_address === null
    ? null
    : readAddress(intent.token_address);
  const spender = intent.spender_address === null
    ? null
    : readAddress(intent.spender_address);
  if (
    intent.id !== expected.intentRecordId ||
    intent.owner_user_id !== expected.ownerUserId ||
    intent.workspace_id !== expected.workspaceId ||
    intent.agent_id !== expected.agentId ||
    intent.request_id !== expected.requestId ||
    !swapExecutionSteps.includes(intent.step) ||
    intent.chain_key !== robinhoodMainnetChainKey ||
    intent.chain_id !== robinhoodMainnetChainId ||
    intent.status !== "approved" ||
    intent.policy_version !== swapExecutionPolicyVersion ||
    !sender ||
    !target ||
    !calldataPattern.test(intent.transaction_data) ||
    !decimalPattern.test(intent.transaction_value_wei) ||
    !Number.isFinite(Date.parse(intent.expires_at))
  ) {
    throw invalidIntent();
  }

  if (
    intent.step === "swap"
      ? token !== null || spender !== null ||
        intent.allowance_amount_atomic !== null
      : !token || !spender ||
        typeof intent.allowance_amount_atomic !== "string" ||
        !decimalPattern.test(intent.allowance_amount_atomic) ||
        intent.transaction_value_wei !== "0"
  ) {
    throw invalidIntent();
  }
  if (
    intent.step === "allowance_revoke" &&
    intent.allowance_amount_atomic !== "0"
  ) {
    throw invalidIntent();
  }
  if (
    intent.step === "allowance_set" &&
    intent.allowance_amount_atomic === "0"
  ) {
    throw invalidIntent();
  }
  return intent;
}

export function deriveVerifiedSwapExecutionResult(
  receipt: { status?: unknown; blockNumber?: unknown } | null,
  checkedAt = new Date().toISOString(),
): VerifiedSwapExecutionResult {
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
    "The provider returned an invalid transaction receipt.",
  );
}

export function assertExistingSwapResultScope(
  existing: ExistingSwapExecutionResult,
  expected: {
    ownerUserId: string;
    body: SwapResultCloseoutBody;
    intent: StoredSwapExecutionIntent;
    submissionKey: string;
  },
) {
  if (
    existing.owner_user_id !== expected.ownerUserId ||
    existing.workspace_id !== expected.body.workspaceId ||
    existing.agent_id !== expected.body.agentId ||
    existing.intent_id !== expected.intent.id ||
    existing.request_id !== expected.body.requestId ||
    existing.step !== expected.intent.step ||
    existing.chain_key !== robinhoodMainnetChainKey ||
    existing.chain_id !== robinhoodMainnetChainId ||
    existing.submission_key !== expected.submissionKey ||
    existing.tx_hash.toLowerCase() !== expected.body.txHash
  ) {
    throw new HttpError(
      409,
      "swap_closeout_scope_conflict",
      "The closeout reference does not match the owner-scoped swap step.",
    );
  }
}

export function canTransitionSwapExecutionResult(
  current: SwapExecutionResultStatus,
  next: SwapExecutionResultStatus,
) {
  return current === next ||
    (current === "submitted" && (next === "confirmed" || next === "failed"));
}

export function isStaleSubmittedSwapResult(
  current: SwapExecutionResultStatus,
  next: SwapExecutionResultStatus,
) {
  return next === "submitted" && current !== "submitted";
}

export function reconcileSwapExecutionResultStatus(
  current: SwapExecutionResultStatus,
  verified: SwapExecutionResultStatus,
) {
  if (isStaleSubmittedSwapResult(current, verified)) {
    return { status: current, shouldUpdate: false } as const;
  }
  if (!canTransitionSwapExecutionResult(current, verified)) {
    throw new HttpError(
      409,
      "swap_status_transition_forbidden",
      "The persisted swap result is already terminal.",
    );
  }
  return { status: verified, shouldUpdate: current !== verified } as const;
}

export function nextSwapExecutionAction(input: {
  step: SwapExecutionStep;
  status: SwapExecutionResultStatus;
  erc20AllowanceLineage: boolean;
}): SwapExecutionNextAction {
  if (input.status === "submitted") return "wait_for_receipt";
  if (input.step === "allowance_set") {
    return input.status === "confirmed"
      ? "request_fresh_quote"
      : "retry_allowance";
  }
  if (input.step === "allowance_revoke") {
    return input.status === "confirmed" ? "complete" : "retry_revoke";
  }
  if (input.erc20AllowanceLineage) return "revoke_allowance";
  return input.status === "confirmed" ? "complete" : "retry_swap";
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

function invalidBody() {
  return new HttpError(
    400,
    "invalid_swap_closeout_request",
    "Only owner scope, intent reference, and transaction hash may be closed out.",
  );
}

function invalidIntent() {
  return new HttpError(
    409,
    "swap_execution_intent_invalid",
    "The prepared swap step does not match the owner-scoped execution policy.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
