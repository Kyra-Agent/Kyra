import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertTransactionIntentPrepareBody,
  HttpError,
  matchesExistingIntent,
  type TransactionIntentPrepareBody,
} from "./core.ts";
import { getTransferDailyLimit } from "../_shared/transfer-transaction-policy.ts";
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
const intentLifetimeMs = 10 * 60 * 1000;

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
  const value = Deno.env.get(key);
  if (!value) {
    throw new HttpError(
      500,
      "missing_env",
      "Required backend configuration is unavailable.",
    );
  }
  return value;
}

async function readJsonBody(request: Request) {
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "Use application/json.");
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
    throw new HttpError(
      413,
      "payload_too_large",
      "Transaction intent is too large.",
    );
  }

  const text = await request.text();
  if (text.length > maxBodyBytes) {
    throw new HttpError(
      413,
      "payload_too_large",
      "Transaction intent is too large.",
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(
      400,
      "invalid_json",
      "Transaction intent contains invalid JSON.",
    );
  }
}

function preparedResponse(
  body: TransactionIntentPrepareBody,
  preparedActionRecordId: string,
  expiresAt: string,
) {
  const base = {
    ok: true,
    status: "prepared",
    preparedActionId: body.requestId,
    preparedActionRecordId,
    expiresAt,
    chainKey: body.chainKey,
    chainId: body.chainId,
    recipient: body.recipient,
    valueWei: body.valueWei,
    data: body.data,
    policyVersion: body.policyVersion,
  };
  return body.policyVersion === 2 ? base : {
    ...base,
    sender: body.sender,
    assetKind: body.assetKind,
    tokenAddress: body.tokenAddress,
    tokenSymbol: body.tokenSymbol,
    tokenDecimals: body.tokenDecimals,
    amountAtomic: body.amountAtomic,
  };
}

async function enforceDailyTransferReservation(
  serviceClient: ReturnType<typeof createClient<any>>,
  body: TransactionIntentPrepareBody,
) {
  if (body.policyVersion !== 3) return;

  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { data, error } = await serviceClient
    .from("prepared_actions")
    .select("amount_atomic")
    .eq("workspace_id", body.workspaceId)
    .eq("policy_version", 3)
    .eq("asset_kind", body.assetKind)
    .gte("created_at", dayStart.toISOString());
  if (error) throw error;

  const records = (data ?? []) as Array<{ amount_atomic: string | null }>;
  const reserved = records.reduce((total, record) => {
    const value = typeof record.amount_atomic === "string" &&
        /^[1-9][0-9]*$/u.test(record.amount_atomic)
      ? BigInt(record.amount_atomic)
      : 0n;
    return total + value;
  }, 0n);
  if (
    reserved + BigInt(body.amountAtomic) > getTransferDailyLimit(body.assetKind)
  ) {
    throw new HttpError(
      429,
      "daily_transfer_limit_exceeded",
      `The daily ${body.tokenSymbol} transfer review limit has been reached.`,
    );
  }
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
        "Use POST for transaction intent.",
      );
    }

    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigins.has(origin)) {
      throw new HttpError(
        403,
        "origin_forbidden",
        "This origin cannot prepare transactions.",
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

    const body = assertTransactionIntentPrepareBody(
      await readJsonBody(request),
    );
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
        "agent_transaction_locked",
        "The selected agent is not ready for Robinhood Chain transaction review.",
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
        chainKey: body.chainKey,
      });
    } catch {
      throw new HttpError(
        503,
        "rate_limit_unavailable",
        "Transaction preparation is temporarily unavailable.",
      );
    }
    if (!rateLimit.allowed) {
      throw new HttpError(
        429,
        "transaction_intent_rate_limited",
        "Too many transaction reviews. Wait before trying again.",
      );
    }

    const { data: existing, error: existingError } = await serviceClient
      .from("prepared_actions")
      .select(
        "id,workspace_id,agent_id,request_id,action_kind,chain_key,chain_id,status,risk,provider,sender_address,recipient,asset_kind,token_address,token_symbol,token_decimals,amount_atomic,value_wei,calldata,policy_version,expires_at",
      )
      .eq("workspace_id", body.workspaceId)
      .eq("agent_id", body.agentId)
      .eq("request_id", body.requestId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing) {
      if (!matchesExistingIntent(existing, body)) {
        throw new HttpError(
          409,
          "transaction_intent_conflict",
          "The reviewed transaction no longer matches its immutable intent.",
        );
      }
      if (
        typeof existing.expires_at !== "string" ||
        Date.parse(existing.expires_at) <= Date.now()
      ) {
        throw new HttpError(
          409,
          "transaction_intent_expired",
          "The reviewed transaction intent expired. Review it again.",
        );
      }
      return jsonResponse(
        request,
        preparedResponse(body, existing.id, existing.expires_at),
      );
    }

    await enforceDailyTransferReservation(serviceClient, body);

    const now = new Date();
    const expiresAt = new Date(now.getTime() + intentLifetimeMs).toISOString();
    const { data: inserted, error: insertError } = await serviceClient
      .from("prepared_actions")
      .insert({
        workspace_id: body.workspaceId,
        agent_id: body.agentId,
        request_id: body.requestId,
        action_kind: "robinhood_reviewed_transaction",
        chain_key: body.chainKey,
        chain_id: body.chainId,
        status: "approved",
        risk: "review",
        route_summary: body.policyVersion === 2
          ? "Owner wallet self-transfer transaction proof."
          : `${body.tokenSymbol} transfer to ${body.recipient.slice(0, 8)}...${
            body.recipient.slice(-6)
          }.`,
        value_summary: body.policyVersion === 2
          ? "0.0001 ETH, no calldata, self-address recipient."
          : `${body.amountAtomic} atomic ${body.tokenSymbol}; policy-capped owner transfer.`,
        approval_requirement:
          "Authenticated account review and explicit wallet confirmation required.",
        safety_note: body.policyVersion === 2
          ? "Owner-only fixed-value self-transfer. Telegram and public execution are blocked."
          : "Private-dashboard transfer with immutable sender, recipient, asset, amount, and expiry. Telegram and public execution are blocked.",
        provider: "owner_dashboard",
        sender_address: body.sender,
        recipient: body.recipient,
        asset_kind: body.assetKind,
        token_address: body.tokenAddress,
        token_symbol: body.tokenSymbol,
        token_decimals: body.tokenDecimals,
        amount_atomic: body.amountAtomic,
        value_wei: body.valueWei,
        calldata: body.data,
        policy_version: body.policyVersion,
        expires_at: expiresAt,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select("id")
      .single();
    if (insertError?.message?.includes("daily_transfer_limit_exceeded")) {
      throw new HttpError(
        429,
        "daily_transfer_limit_exceeded",
        `The daily ${body.tokenSymbol} transfer review limit has been reached.`,
      );
    }
    if (insertError || !inserted?.id) {
      throw insertError ?? new Error("insert failed");
    }

    return jsonResponse(
      request,
      preparedResponse(body, inserted.id, expiresAt),
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

    return jsonResponse(request, {
      ok: false,
      status: "server_error",
      message: "Kyra could not prepare this transaction safely.",
    }, 500);
  }
});
