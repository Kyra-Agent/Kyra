import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertSwapExecutionPrepareBody,
  HttpError,
  matchesExistingSwapExecutionIntent,
  type PreparedSwapExecutionIntent,
  prepareSwapExecutionIntent,
  type StoredSwapQuote,
  type SwapExecutionPrepareBody,
} from "./core.ts";
import {
  type ChainActionRateLimitRpcClient,
  createChainActionRateLimitChecker,
} from "../chain-action-prepare/rate-limit.ts";

const allowedOrigins = new Set([
  "https://kyraagent.xyz",
  "https://www.kyraagent.xyz",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
]);
const maxBodyBytes = 4096;
const quoteColumns =
  "id,workspace_id,agent_id,request_id,chain_key,chain_id,taker_address,sell_token_address,sell_token_symbol,buy_token_address,sell_amount_atomic,allowance_target,transaction_to,transaction_data,transaction_value_wei,status,policy_version,quote_issued_at,expires_at";
const intentColumns =
  "id,owner_user_id,workspace_id,agent_id,quote_review_id,request_id,step,chain_key,chain_id,sender_address,transaction_to,transaction_data,transaction_value_wei,token_address,spender_address,allowance_amount_atomic,status,policy_version,expires_at";

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
      "swap_execution_not_configured",
      "Protected swap execution is not configured.",
    );
  }
  return value;
}

function assertFeatureEnabled() {
  if (Deno.env.get("KYRA_PROTECTED_SWAP_EXECUTION_ENABLED") !== "true") {
    throw new HttpError(
      503,
      "swap_execution_disabled",
      "Protected swap execution is not enabled.",
    );
  }
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
      "Swap execution request is too large.",
    );
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new HttpError(
      400,
      "invalid_json",
      "Swap execution request contains invalid JSON.",
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
          // Best effort only; the oversized request is rejected either way.
        }
        throw new HttpError(
          413,
          "payload_too_large",
          "Swap execution request is too large.",
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
      // Best effort only; malformed input still fails closed.
    }
    throw new HttpError(
      400,
      "invalid_json",
      "Swap execution request contains invalid JSON.",
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
      "Swap execution request contains invalid JSON.",
    );
  }
}

function preparedResponse(
  body: SwapExecutionPrepareBody,
  intent: PreparedSwapExecutionIntent,
  recordId: string,
) {
  return {
    ok: true,
    status: "prepared",
    intentId: body.requestId,
    intentRecordId: recordId,
    quoteRecordId: body.quoteRecordId,
    step: intent.step,
    chainKey: intent.chain_key,
    chainId: intent.chain_id,
    sender: intent.sender_address,
    transaction: {
      to: intent.transaction_to,
      data: intent.transaction_data,
      valueWei: intent.transaction_value_wei,
    },
    allowance: intent.step === "swap" ? null : {
      token: intent.token_address,
      spender: intent.spender_address,
      amountAtomic: intent.allowance_amount_atomic,
    },
    expiresAt: intent.expires_at,
    policyVersion: intent.policy_version,
    executionScope: "private_account_wallet",
  };
}

async function findExistingIntent(
  serviceClient: ReturnType<typeof createClient<any>>,
  body: SwapExecutionPrepareBody,
  ownerUserId: string,
) {
  const { data, error } = await serviceClient
    .from("swap_execution_intents")
    .select(intentColumns)
    .eq("owner_user_id", ownerUserId)
    .eq("workspace_id", body.workspaceId)
    .eq("agent_id", body.agentId)
    .eq("request_id", body.requestId)
    .maybeSingle();
  if (error) throw error;
  return data as (Record<string, unknown> & { id: string }) | null;
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
        "Use POST for protected swap execution.",
      );
    }
    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigins.has(origin)) {
      throw new HttpError(
        403,
        "origin_forbidden",
        "This origin cannot prepare swap execution.",
      );
    }
    assertFeatureEnabled();

    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.toLowerCase().startsWith("bearer ")) {
      throw new HttpError(
        401,
        "unauthorized",
        "A valid account session is required.",
      );
    }

    const body = assertSwapExecutionPrepareBody(await readJsonBody(request));
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
        "The selected agent is not ready for protected Robinhood Chain swap execution.",
      );
    }

    const { data: quote, error: quoteError } = await serviceClient
      .from("swap_quote_reviews")
      .select(quoteColumns)
      .eq("id", body.quoteRecordId)
      .eq("workspace_id", body.workspaceId)
      .eq("agent_id", body.agentId)
      .maybeSingle();
    if (quoteError) throw quoteError;
    if (!quote) {
      throw new HttpError(
        404,
        "swap_quote_not_found",
        "The reviewed swap quote is unavailable.",
      );
    }

    const expected = prepareSwapExecutionIntent({
      body,
      ownerUserId: userData.user.id,
      quote: quote as StoredSwapQuote,
    });
    const existing = await findExistingIntent(
      serviceClient,
      body,
      userData.user.id,
    );
    if (existing) {
      if (!matchesExistingSwapExecutionIntent(existing, expected)) {
        throw new HttpError(
          409,
          "swap_execution_conflict",
          "This execution request no longer matches its immutable review.",
        );
      }
      if (Date.parse(expected.expires_at) <= Date.now()) {
        throw new HttpError(
          409,
          "swap_execution_expired",
          "The reviewed swap step expired. Prepare it again.",
        );
      }
      return jsonResponse(
        request,
        preparedResponse(body, expected, existing.id),
      );
    }

    let rateLimit;
    try {
      rateLimit = await createChainActionRateLimitChecker(
        serviceClient as unknown as ChainActionRateLimitRpcClient,
      )({
        ownerUserId: userData.user.id,
        workspaceId: body.workspaceId,
        agentId: body.agentId,
        chainKey: expected.chain_key,
      });
    } catch {
      throw new HttpError(
        503,
        "rate_limit_unavailable",
        "Swap execution preparation is temporarily unavailable.",
      );
    }
    if (!rateLimit.allowed) {
      throw new HttpError(
        429,
        "swap_execution_rate_limited",
        "Too many swap execution reviews. Wait before trying again.",
      );
    }

    const { data: inserted, error: insertError } = await serviceClient
      .from("swap_execution_intents")
      .insert(expected)
      .select("id")
      .single();
    if (insertError?.code === "23505") {
      const raced = await findExistingIntent(
        serviceClient,
        body,
        userData.user.id,
      );
      if (!raced || !matchesExistingSwapExecutionIntent(raced, expected)) {
        throw new HttpError(
          409,
          "swap_execution_conflict",
          "This execution request no longer matches its immutable review.",
        );
      }
      return jsonResponse(
        request,
        preparedResponse(body, expected, raced.id),
      );
    }
    if (insertError?.code === "23514") {
      throw new HttpError(
        409,
        "swap_execution_policy_rejected",
        "The protected swap step did not satisfy the execution policy.",
      );
    }
    if (insertError || !inserted?.id) {
      throw insertError ?? new Error("swap execution intent insert failed");
    }

    return jsonResponse(
      request,
      preparedResponse(body, expected, inserted.id),
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
        message: "Kyra could not prepare this protected swap step safely.",
      },
      500,
    );
  }
});
