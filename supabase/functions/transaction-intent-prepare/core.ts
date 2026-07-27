export interface TransactionIntentPrepareBody {
  workspaceId: string;
  agentId: string;
  requestId: string;
  chainKey: "robinhood_mainnet";
  chainId: 4663;
  recipient: string;
  valueWei: "0";
  data: "0x";
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
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/u;
const addressPattern = /^0x[0-9a-f]{40}$/iu;

export function assertTransactionIntentPrepareBody(
  value: unknown,
): TransactionIntentPrepareBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_body",
      "A valid transaction intent is required.",
    );
  }

  const body = value as Record<string, unknown>;
  if (
    Object.keys(body).sort().join(",") !==
      "agentId,chainId,chainKey,data,recipient,requestId,valueWei,workspaceId" ||
    typeof body.workspaceId !== "string" ||
    !uuidPattern.test(body.workspaceId) ||
    typeof body.agentId !== "string" ||
    !uuidPattern.test(body.agentId) ||
    typeof body.requestId !== "string" ||
    !requestIdPattern.test(body.requestId) ||
    body.chainKey !== "robinhood_mainnet" ||
    body.chainId !== 4663 ||
    typeof body.recipient !== "string" ||
    !addressPattern.test(body.recipient) ||
    body.valueWei !== "0" ||
    body.data !== "0x"
  ) {
    throw new HttpError(
      400,
      "invalid_transaction_intent",
      "Transaction intent must be a zero-value Robinhood Chain owner self-check.",
    );
  }

  return {
    workspaceId: body.workspaceId.toLowerCase(),
    agentId: body.agentId.toLowerCase(),
    requestId: body.requestId,
    chainKey: "robinhood_mainnet",
    chainId: 4663,
    recipient: body.recipient.toLowerCase(),
    valueWei: "0",
    data: "0x",
  };
}

export function matchesExistingIntent(
  existing: Record<string, unknown>,
  body: TransactionIntentPrepareBody,
) {
  return existing.workspace_id === body.workspaceId &&
    existing.agent_id === body.agentId &&
    existing.request_id === body.requestId &&
    existing.action_kind === "robinhood_reviewed_transaction" &&
    existing.chain_key === body.chainKey &&
    existing.chain_id === body.chainId &&
    existing.status === "approved" &&
    existing.risk === "review" &&
    existing.provider === "owner_dashboard" &&
    typeof existing.recipient === "string" &&
    existing.recipient.toLowerCase() === body.recipient &&
    existing.value_wei === body.valueWei &&
    existing.calldata === body.data;
}
