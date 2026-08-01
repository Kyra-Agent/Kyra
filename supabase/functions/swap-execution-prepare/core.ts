import {
  createExactAllowanceTransaction,
  readAddress,
  swapExecutionIntentLifetimeMs,
  swapExecutionPolicyVersion,
  type SwapExecutionStep,
  swapExecutionSteps,
  type SwapExecutionTransaction,
} from "../_shared/swap-execution-policy.ts";
import {
  kyraTokenAddress,
  robinhoodMainnetChainId,
  robinhoodMainnetChainKey,
} from "../_shared/transfer-transaction-policy.ts";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface SwapExecutionPrepareBody {
  workspaceId: string;
  agentId: string;
  quoteRecordId: string;
  requestId: string;
  step: SwapExecutionStep;
}

export interface StoredSwapQuote {
  id: string;
  workspace_id: string;
  agent_id: string;
  request_id: string;
  chain_key: typeof robinhoodMainnetChainKey;
  chain_id: typeof robinhoodMainnetChainId;
  taker_address: string;
  sell_token_address: string;
  sell_token_symbol: "ETH" | "KYRA";
  buy_token_address: string;
  sell_amount_atomic: string;
  allowance_target: string | null;
  transaction_to: string;
  transaction_data: string;
  transaction_value_wei: string;
  status: "quote_ready" | "allowance_required";
  policy_version: 1;
  quote_issued_at: string;
  expires_at: string;
}

export interface PreparedSwapExecutionIntent {
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

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/u;
const calldataPattern = /^0x(?:[0-9a-f]{2})+$/iu;

export function assertSwapExecutionPrepareBody(
  value: unknown,
): SwapExecutionPrepareBody {
  if (!isRecord(value)) throw invalidBody();
  if (
    Object.keys(value).sort().join(",") !==
      "agentId,quoteRecordId,requestId,step,workspaceId"
  ) {
    throw invalidBody();
  }
  if (
    typeof value.workspaceId !== "string" ||
    !uuidPattern.test(value.workspaceId) ||
    typeof value.agentId !== "string" ||
    !uuidPattern.test(value.agentId) ||
    typeof value.quoteRecordId !== "string" ||
    !uuidPattern.test(value.quoteRecordId) ||
    typeof value.requestId !== "string" ||
    !requestIdPattern.test(value.requestId) ||
    typeof value.step !== "string" ||
    !swapExecutionSteps.includes(value.step as SwapExecutionStep)
  ) {
    throw invalidBody();
  }
  return {
    workspaceId: value.workspaceId.toLowerCase(),
    agentId: value.agentId.toLowerCase(),
    quoteRecordId: value.quoteRecordId.toLowerCase(),
    requestId: value.requestId,
    step: value.step as SwapExecutionStep,
  };
}

export function prepareSwapExecutionIntent(input: {
  body: SwapExecutionPrepareBody;
  ownerUserId: string;
  quote: StoredSwapQuote;
  now?: Date;
}): PreparedSwapExecutionIntent {
  const now = input.now ?? new Date();
  const quote = assertStoredSwapQuote(input.quote, input.body);
  const sender = readAddress(quote.taker_address);
  if (!sender) throw invalidQuote();

  const transaction = transactionForStep(input.body.step, quote);
  const expiresAt = input.body.step === "allowance_revoke"
    ? new Date(
      Date.parse(quote.quote_issued_at) + swapExecutionIntentLifetimeMs,
    )
    : new Date(quote.expires_at);
  if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= now) {
    throw new HttpError(
      409,
      "swap_execution_expired",
      "The reviewed swap step has expired. Request a fresh quote.",
    );
  }

  return {
    owner_user_id: input.ownerUserId,
    workspace_id: input.body.workspaceId,
    agent_id: input.body.agentId,
    quote_review_id: input.body.quoteRecordId,
    request_id: input.body.requestId,
    step: input.body.step,
    chain_key: transaction.chainKey,
    chain_id: transaction.chainId,
    sender_address: sender,
    transaction_to: transaction.to,
    transaction_data: transaction.data.toLowerCase(),
    transaction_value_wei: transaction.valueWei,
    token_address: transaction.tokenAddress,
    spender_address: transaction.spenderAddress,
    allowance_amount_atomic: transaction.allowanceAmountAtomic,
    status: "approved",
    policy_version: swapExecutionPolicyVersion,
    expires_at: expiresAt.toISOString(),
  };
}

export function matchesExistingSwapExecutionIntent(
  existing: Record<string, unknown>,
  expected: PreparedSwapExecutionIntent,
) {
  const keys: Array<keyof PreparedSwapExecutionIntent> = [
    "owner_user_id",
    "workspace_id",
    "agent_id",
    "quote_review_id",
    "request_id",
    "step",
    "chain_key",
    "chain_id",
    "sender_address",
    "transaction_to",
    "transaction_data",
    "transaction_value_wei",
    "token_address",
    "spender_address",
    "allowance_amount_atomic",
    "status",
    "policy_version",
    "expires_at",
  ];
  return keys.every((key) =>
    normalizeField(key, existing[key]) === normalizeField(key, expected[key])
  );
}

function transactionForStep(
  step: SwapExecutionStep,
  quote: StoredSwapQuote,
): SwapExecutionTransaction {
  if (step === "swap") {
    if (quote.status !== "quote_ready") {
      throw new HttpError(
        409,
        "fresh_quote_required",
        "Confirm the exact allowance, then request a fresh swap quote.",
      );
    }
    const target = readAddress(quote.transaction_to);
    if (
      !target ||
      !calldataPattern.test(quote.transaction_data) ||
      !/^(?:0|[1-9][0-9]*)$/u.test(quote.transaction_value_wei)
    ) {
      throw invalidQuote();
    }
    return {
      chainKey: robinhoodMainnetChainKey,
      chainId: robinhoodMainnetChainId,
      to: target,
      data: quote.transaction_data.toLowerCase() as `0x${string}`,
      valueWei: quote.transaction_value_wei,
      tokenAddress: null,
      spenderAddress: null,
      allowanceAmountAtomic: null,
    };
  }

  if (
    quote.sell_token_address.toLowerCase() !== kyraTokenAddress.toLowerCase() ||
    !quote.allowance_target
  ) {
    throw new HttpError(
      409,
      "allowance_step_not_applicable",
      "This quote does not require a KYRA token allowance.",
    );
  }
  if (step === "allowance_set" && quote.status !== "allowance_required") {
    throw new HttpError(
      409,
      "allowance_not_required",
      "This quote is not waiting for token allowance.",
    );
  }

  const transaction = createExactAllowanceTransaction({
    tokenAddress: quote.sell_token_address,
    spenderAddress: quote.allowance_target,
    amountAtomic: step === "allowance_revoke" ? "0" : quote.sell_amount_atomic,
  });
  if (!transaction) throw invalidQuote();
  return transaction;
}

function assertStoredSwapQuote(
  value: StoredSwapQuote,
  body: SwapExecutionPrepareBody,
) {
  const issuedAt = Date.parse(value.quote_issued_at);
  const expiresAt = Date.parse(value.expires_at);
  if (
    value.id !== body.quoteRecordId ||
    value.workspace_id !== body.workspaceId ||
    value.agent_id !== body.agentId ||
    value.chain_key !== robinhoodMainnetChainKey ||
    value.chain_id !== robinhoodMainnetChainId ||
    value.policy_version !== swapExecutionPolicyVersion ||
    !Number.isFinite(issuedAt) ||
    !Number.isFinite(expiresAt) ||
    expiresAt !== issuedAt + 75_000
  ) {
    throw invalidQuote();
  }
  return value;
}

function normalizeField(
  key: keyof PreparedSwapExecutionIntent,
  value: unknown,
) {
  if (
    typeof value === "string" &&
    [
      "sender_address",
      "transaction_to",
      "transaction_data",
      "token_address",
      "spender_address",
    ].includes(key)
  ) {
    return value.toLowerCase();
  }
  return value;
}

function invalidBody() {
  return new HttpError(
    400,
    "invalid_swap_execution_request",
    "Only an owner-scoped reviewed swap step may be prepared.",
  );
}

function invalidQuote() {
  return new HttpError(
    409,
    "swap_quote_invalid",
    "The stored quote does not match the protected Robinhood Chain policy.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
