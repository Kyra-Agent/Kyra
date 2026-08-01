import {
  createSwapQuoteRequest,
  type SwapQuoteRequest,
} from "../_shared/swap-quote-policy.ts";

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const requestKeys =
  "agentId,buyToken,chainId,chainKey,policyVersion,requestId,sellAmount,sellToken,slippageBps,taker,workspaceId";

export function assertSwapQuotePrepareBody(value: unknown): SwapQuoteRequest {
  if (!isRecord(value)) throw invalidQuoteRequest();
  if (Object.keys(value).sort().join(",") !== requestKeys) {
    throw invalidQuoteRequest();
  }

  const reviewed = createSwapQuoteRequest({
    workspaceId: value.workspaceId,
    agentId: value.agentId,
    requestId: value.requestId,
    chainKey: value.chainKey,
    chainId: value.chainId,
    taker: value.taker,
    sellToken: value.sellToken,
    buyToken: value.buyToken,
    sellAmount: value.sellAmount,
    slippageBps: value.slippageBps,
    policyVersion: value.policyVersion,
  });
  if (!reviewed.ok) throw invalidQuoteRequest(reviewed.error);
  return reviewed.request;
}

export function matchesExistingSwapQuote(
  existing: Record<string, unknown>,
  request: SwapQuoteRequest,
) {
  return existing.workspace_id === request.workspaceId &&
    existing.agent_id === request.agentId &&
    existing.request_id === request.requestId &&
    existing.chain_key === request.chainKey &&
    existing.chain_id === request.chainId &&
    normalizeAddress(existing.taker_address) === request.taker.toLowerCase() &&
    normalizeAddress(existing.sell_token_address) ===
      request.sellToken.toLowerCase() &&
    normalizeAddress(existing.buy_token_address) ===
      request.buyToken.toLowerCase() &&
    existing.sell_amount_atomic === request.sellAmount &&
    existing.slippage_bps === request.slippageBps &&
    existing.policy_version === request.policyVersion &&
    existing.provider === "0x_swap_api_v2" &&
    (existing.status === "quote_ready" ||
      existing.status === "allowance_required");
}

function invalidQuoteRequest(detail?: string) {
  return new HttpError(
    400,
    "invalid_swap_quote_request",
    detail
      ? `Swap quote request failed Kyra policy: ${detail}.`
      : "Swap quote request must match the protected Robinhood Chain policy.",
  );
}

function normalizeAddress(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
