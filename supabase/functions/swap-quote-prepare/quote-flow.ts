import { HttpError, matchesExistingSwapQuote } from "./core.ts";
import {
  fetchReviewedUniswapQuote,
  type ReviewedSwapQuote,
} from "./uniswap-provider.ts";
import { readReceiptRpcConfig } from "../transaction-result-closeout/receipt-verifier.ts";
import {
  type ChainActionRateLimitRpcClient,
  createChainActionRateLimitChecker,
} from "../chain-action-prepare/rate-limit.ts";
import type { SwapQuoteRequest } from "../_shared/swap-quote-policy.ts";

// The owner-scoped part of a swap quote, shared by the dashboard endpoint
// (account session) and the Telegram Mini App (Telegram-signed owner).
// Callers must already have proven that ownerUserId is the signed-in owner.

const providerTimeoutMs = 8_000;
const selectColumns =
  "id,workspace_id,agent_id,request_id,chain_key,chain_id,taker_address,sell_token_address,buy_token_address,sell_token_symbol,buy_token_symbol,sell_amount_atomic,buy_amount_atomic,minimum_buy_amount_atomic,slippage_bps,policy_version,provider,status,route_summary,expires_at";

export interface OwnerFlowResult {
  status: number;
  body: Record<string, unknown>;
}

// deno-lint-ignore no-explicit-any
type ServiceClient = any;

export function quoteResponse(
  request: SwapQuoteRequest,
  record: {
    id: string;
    status: "quote_ready" | "allowance_required";
    sell_token_symbol: "ETH" | "USDG";
    buy_token_symbol: "ETH" | "USDG";
    buy_amount_atomic: string;
    minimum_buy_amount_atomic: string;
    route_summary: string;
    expires_at: string;
  },
) {
  return {
    ok: true,
    status: record.status,
    quoteId: request.requestId,
    quoteRecordId: record.id,
    chainKey: request.chainKey,
    chainId: request.chainId,
    taker: request.taker,
    sellToken: request.sellToken,
    sellTokenSymbol: record.sell_token_symbol,
    buyToken: request.buyToken,
    buyTokenSymbol: record.buy_token_symbol,
    sellAmount: request.sellAmount,
    buyAmount: record.buy_amount_atomic,
    minimumBuyAmount: record.minimum_buy_amount_atomic,
    slippageBps: request.slippageBps,
    routeSummary: record.route_summary,
    expiresAt: record.expires_at,
    allowanceRequired: record.status === "allowance_required",
    executionEnabled: false,
  };
}

async function fingerprintQuote(quote: ReviewedSwapQuote) {
  const canonical = JSON.stringify({
    provider: quote.provider,
    status: quote.status,
    sellTokenAddress: quote.sellTokenAddress.toLowerCase(),
    buyTokenAddress: quote.buyTokenAddress.toLowerCase(),
    sellAmountAtomic: quote.sellAmountAtomic,
    buyAmountAtomic: quote.buyAmountAtomic,
    minimumBuyAmountAtomic: quote.minimumBuyAmountAtomic,
    slippageBps: quote.slippageBps,
    allowanceTarget: quote.allowanceTarget?.toLowerCase() ?? null,
    transactionTo: quote.transactionTo.toLowerCase(),
    transactionData: quote.transactionData,
    transactionValueWei: quote.transactionValueWei,
    liquiditySources: quote.liquiditySources,
    issuedAt: quote.issuedAt,
    expiresAt: quote.expiresAt,
  });
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical),
  );
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function runOwnerSwapQuote(input: {
  serviceClient: ServiceClient;
  ownerUserId: string;
  body: SwapQuoteRequest;
}): Promise<OwnerFlowResult> {
  const { serviceClient, ownerUserId, body } = input;
  const { data: workspace, error: workspaceError } = await serviceClient
    .from("workspaces")
    .select("id")
    .eq("id", body.workspaceId)
    .eq("owner_user_id", ownerUserId)
    .maybeSingle();
  if (workspaceError) throw workspaceError;
  if (!workspace) {
    throw new HttpError(
      403,
      "workspace_forbidden",
      "The workspace is not owned by this account.",
    );
  }

  const { data: agent, error: agentError } = await serviceClient
    .from("agent_instances")
    .select("id,network,chain_action_status")
    .eq("id", body.agentId)
    .eq("workspace_id", body.workspaceId)
    .maybeSingle();
  if (agentError) throw agentError;
  if (
    !agent ||
    agent.network !== "robinhood_mainnet" ||
    !["ready", "active"].includes(agent.chain_action_status)
  ) {
    throw new HttpError(
      409,
      "agent_swap_locked",
      "The selected agent is not ready for protected Robinhood Chain swap review.",
    );
  }

  const { data: existing, error: existingError } = await serviceClient
    .from("swap_quote_reviews")
    .select(selectColumns)
    .eq("workspace_id", body.workspaceId)
    .eq("agent_id", body.agentId)
    .eq("request_id", body.requestId)
    .maybeSingle();
  if (existingError) throw existingError;
  if (existing) {
    return { status: 200, body: quoteResponse(body, assertReusableQuote(existing, body)) };
  }

  let rateLimit;
  try {
    rateLimit = await createChainActionRateLimitChecker(
      serviceClient as ChainActionRateLimitRpcClient,
    )({
      ownerUserId,
      workspaceId: body.workspaceId,
      agentId: body.agentId,
      chainKey: body.chainKey,
    });
  } catch {
    throw new HttpError(
      503,
      "rate_limit_unavailable",
      "Swap quote review is temporarily unavailable.",
    );
  }
  if (!rateLimit.allowed) {
    throw new HttpError(
      429,
      "swap_quote_rate_limited",
      "Too many swap quote reviews. Wait before trying again.",
    );
  }

  let rpcUrl: string;
  try {
    rpcUrl = readReceiptRpcConfig((key) => Deno.env.get(key)).rpcUrl;
  } catch {
    throw new HttpError(
      503,
      "swap_quote_not_configured",
      "Protected swap quotes are not configured.",
    );
  }

  const quote = await fetchReviewedUniswapQuote(body, {
    rpcUrl,
    timeoutMs: providerTimeoutMs,
  });
  const fingerprint = await fingerprintQuote(quote);
  const { data: inserted, error: insertError } = await serviceClient
    .from("swap_quote_reviews")
    .insert({
      workspace_id: body.workspaceId,
      agent_id: body.agentId,
      request_id: body.requestId,
      chain_key: body.chainKey,
      chain_id: body.chainId,
      taker_address: body.taker,
      sell_token_address: quote.sellTokenAddress,
      sell_token_symbol: quote.sellTokenSymbol,
      sell_token_decimals: quote.sellTokenDecimals,
      buy_token_address: quote.buyTokenAddress,
      buy_token_symbol: quote.buyTokenSymbol,
      buy_token_decimals: quote.buyTokenDecimals,
      sell_amount_atomic: quote.sellAmountAtomic,
      buy_amount_atomic: quote.buyAmountAtomic,
      minimum_buy_amount_atomic: quote.minimumBuyAmountAtomic,
      slippage_bps: quote.slippageBps,
      allowance_target: quote.allowanceTarget,
      transaction_to: quote.transactionTo,
      transaction_data: quote.transactionData,
      transaction_value_wei: quote.transactionValueWei,
      liquidity_sources: quote.liquiditySources,
      route_summary: quote.routeSummary,
      provider: quote.provider,
      provider_response_fingerprint: fingerprint,
      status: quote.status,
      policy_version: body.policyVersion,
      quote_issued_at: quote.issuedAt,
      expires_at: quote.expiresAt,
    })
    .select("id")
    .single();
  if (insertError?.code === "23505") {
    const { data: raced, error: racedError } = await serviceClient
      .from("swap_quote_reviews")
      .select(selectColumns)
      .eq("workspace_id", body.workspaceId)
      .eq("agent_id", body.agentId)
      .eq("request_id", body.requestId)
      .maybeSingle();
    if (racedError) throw racedError;
    if (!raced) {
      throw new HttpError(
        409,
        "swap_quote_conflict",
        "This quote request no longer matches its immutable review.",
      );
    }
    return { status: 200, body: quoteResponse(body, assertReusableQuote(raced, body)) };
  }
  if (insertError || !inserted?.id) {
    throw insertError ?? new Error("swap quote insert failed");
  }

  return {
    status: 201,
    body: quoteResponse(body, {
      id: inserted.id,
      status: quote.status,
      sell_token_symbol: quote.sellTokenSymbol,
      buy_token_symbol: quote.buyTokenSymbol,
      buy_amount_atomic: quote.buyAmountAtomic,
      minimum_buy_amount_atomic: quote.minimumBuyAmountAtomic,
      route_summary: quote.routeSummary,
      expires_at: quote.expiresAt,
    }),
  };
}

// deno-lint-ignore no-explicit-any
function assertReusableQuote(existing: any, body: SwapQuoteRequest) {
  if (!matchesExistingSwapQuote(existing, body)) {
    throw new HttpError(
      409,
      "swap_quote_conflict",
      "This quote request no longer matches its immutable review.",
    );
  }
  if (
    typeof existing.expires_at !== "string" ||
    Date.parse(existing.expires_at) <= Date.now()
  ) {
    throw new HttpError(
      409,
      "swap_quote_expired",
      "This swap quote expired. Request a fresh review.",
    );
  }
  return existing;
}
