import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertSwapQuotePrepareBody,
  HttpError,
  matchesExistingSwapQuote,
} from "./core.ts";
import {
  fetchReviewedZeroExQuote,
  readAddressAllowlist,
  readSourceAllowlist,
  type ReviewedSwapQuote,
} from "./provider.ts";
import {
  type ChainActionRateLimitRpcClient,
  createChainActionRateLimitChecker,
} from "../chain-action-prepare/rate-limit.ts";
import type { SwapQuoteRequest } from "../_shared/swap-quote-policy.ts";

const allowedOrigins = new Set([
  "https://kyraagent.xyz",
  "https://www.kyraagent.xyz",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
]);
const maxBodyBytes = 4096;

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin)
      ? origin
      : "https://kyraagent.xyz",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(request),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function getEnv(key: string) {
  const value = Deno.env.get(key)?.trim();
  if (!value) {
    throw new HttpError(
      503,
      "swap_quote_not_configured",
      "Protected swap quotes are not configured.",
    );
  }
  return value;
}

function getProviderTimeoutMs() {
  const value = Number(Deno.env.get("KYRA_ZEROX_TIMEOUT_MS") ?? "3500");
  if (!Number.isInteger(value) || value < 1000 || value > 5000) {
    throw new HttpError(
      503,
      "swap_quote_not_configured",
      "Protected swap quotes are not configured.",
    );
  }
  return value;
}

async function readJsonBody(request: Request) {
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (contentType.split(";")[0]?.trim() !== "application/json") {
    throw new HttpError(415, "unsupported_media_type", "Use application/json.");
  }
  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    throw new HttpError(
      413,
      "payload_too_large",
      "Swap quote request is too large.",
    );
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new HttpError(
      400,
      "invalid_json",
      "Swap quote request contains invalid JSON.",
    );
  }

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxBodyBytes) {
        try {
          await reader.cancel("payload_too_large");
        } catch {
          // Best-effort cancellation; the request is rejected either way.
        }
        throw new HttpError(
          413,
          "payload_too_large",
          "Swap quote request is too large.",
        );
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch (error) {
    if (error instanceof HttpError) throw error;
    try {
      await reader.cancel("invalid_json");
    } catch {
      // Best-effort cancellation; malformed input still fails closed.
    }
    throw new HttpError(
      400,
      "invalid_json",
      "Swap quote request contains invalid JSON.",
    );
  } finally {
    reader.releaseLock();
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(
      400,
      "invalid_json",
      "Swap quote request contains invalid JSON.",
    );
  }
}

function quoteResponse(
  request: SwapQuoteRequest,
  record: {
    id: string;
    status: "quote_ready" | "allowance_required";
    sell_token_symbol: "ETH" | "KYRA";
    buy_token_symbol: "ETH" | "KYRA";
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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }

  try {
    if (request.method !== "POST") {
      throw new HttpError(
        405,
        "method_not_allowed",
        "Use POST for swap quotes.",
      );
    }
    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigins.has(origin)) {
      throw new HttpError(
        403,
        "origin_forbidden",
        "This origin cannot request swap quotes.",
      );
    }
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.toLowerCase().startsWith("bearer ")) {
      throw new HttpError(
        401,
        "unauthorized",
        "A valid account session is required.",
      );
    }

    const body = assertSwapQuotePrepareBody(await readJsonBody(request));
    const supabaseUrl = getEnv("SUPABASE_URL");
    const userClient = createClient(supabaseUrl, getEnv("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth
      .getUser();
    if (userError || !userData.user) {
      throw new HttpError(
        401,
        "unauthorized",
        "A valid account session is required.",
      );
    }

    const serviceClient = createClient(
      supabaseUrl,
      getEnv("SUPABASE_SERVICE_ROLE_KEY"),
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    const { data: workspace, error: workspaceError } = await serviceClient
      .from("workspaces")
      .select("id")
      .eq("id", body.workspaceId)
      .eq("owner_user_id", userData.user.id)
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
    const selectColumns =
      "id,workspace_id,agent_id,request_id,chain_key,chain_id,taker_address,sell_token_address,buy_token_address,sell_token_symbol,buy_token_symbol,sell_amount_atomic,buy_amount_atomic,minimum_buy_amount_atomic,slippage_bps,policy_version,provider,status,route_summary,expires_at";
    const { data: existing, error: existingError } = await serviceClient
      .from("swap_quote_reviews")
      .select(selectColumns)
      .eq("workspace_id", body.workspaceId)
      .eq("agent_id", body.agentId)
      .eq("request_id", body.requestId)
      .maybeSingle();
    if (existingError) throw existingError;
    if (existing) {
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
      return jsonResponse(request, quoteResponse(body, existing));
    }

    let rateLimit;
    try {
      rateLimit = await createChainActionRateLimitChecker(
        serviceClient as unknown as ChainActionRateLimitRpcClient,
      )({
        ownerUserId: userData.user.id,
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

    let providerConfig;
    try {
      providerConfig = {
        apiKey: getEnv("KYRA_ZEROX_API_KEY"),
        allowedTransactionTargets: readAddressAllowlist(
          getEnv("KYRA_ZEROX_SWAP_ALLOWED_TARGETS"),
        ),
        allowedAllowanceTargets: readAddressAllowlist(
          getEnv("KYRA_ZEROX_ALLOWANCE_ALLOWED_TARGETS"),
        ),
        allowedLiquiditySources: readSourceAllowlist(
          getEnv("KYRA_ZEROX_ALLOWED_SOURCES"),
        ),
        timeoutMs: getProviderTimeoutMs(),
      };
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(
        503,
        "swap_quote_not_configured",
        "Protected swap quotes are not configured.",
      );
    }

    const quote = await fetchReviewedZeroExQuote(body, providerConfig);
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
        sell_token_decimals: 18,
        buy_token_address: quote.buyTokenAddress,
        buy_token_symbol: quote.buyTokenSymbol,
        buy_token_decimals: 18,
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
      if (!raced || !matchesExistingSwapQuote(raced, body)) {
        throw new HttpError(
          409,
          "swap_quote_conflict",
          "This quote request no longer matches its immutable review.",
        );
      }
      if (
        typeof raced.expires_at !== "string" ||
        Date.parse(raced.expires_at) <= Date.now()
      ) {
        throw new HttpError(
          409,
          "swap_quote_expired",
          "This swap quote expired. Request a fresh review.",
        );
      }
      return jsonResponse(request, quoteResponse(body, raced));
    }
    if (insertError || !inserted?.id) {
      throw insertError ?? new Error("swap quote insert failed");
    }

    return jsonResponse(
      request,
      quoteResponse(body, {
        id: inserted.id,
        status: quote.status,
        sell_token_symbol: quote.sellTokenSymbol,
        buy_token_symbol: quote.buyTokenSymbol,
        buy_amount_atomic: quote.buyAmountAtomic,
        minimum_buy_amount_atomic: quote.minimumBuyAmountAtomic,
        route_summary: quote.routeSummary,
        expires_at: quote.expiresAt,
      }),
      201,
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        request,
        { ok: false, status: error.code, message: error.message },
        error.statusCode,
      );
    }
    return jsonResponse(
      request,
      {
        ok: false,
        status: "server_error",
        message: "Kyra could not prepare this swap quote safely.",
      },
      500,
    );
  }
});
