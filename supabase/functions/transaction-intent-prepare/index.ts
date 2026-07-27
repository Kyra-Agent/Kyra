import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertTransactionIntentPrepareBody,
  HttpError,
  matchesExistingIntent,
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
        "id,workspace_id,agent_id,request_id,action_kind,chain_key,chain_id,status,risk,provider,recipient,value_wei,calldata,expires_at",
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
      return jsonResponse(request, {
        ok: true,
        status: "prepared",
        preparedActionId: existing.id,
        expiresAt: existing.expires_at,
      });
    }

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
        route_summary: "Owner wallet self-check controlled transaction.",
        value_summary:
          "Zero ETH, no token spend, no calldata, self-address recipient.",
        approval_requirement:
          "Authenticated owner review and wallet confirmation required.",
        safety_note:
          "Owner-only zero-value self-check. Telegram and public execution are blocked.",
        provider: "owner_dashboard",
        recipient: body.recipient,
        value_wei: body.valueWei,
        calldata: body.data,
        expires_at: expiresAt,
        created_at: now.toISOString(),
        updated_at: now.toISOString(),
      })
      .select("id")
      .single();
    if (insertError || !inserted?.id) {
      throw insertError ?? new Error("insert failed");
    }

    return jsonResponse(request, {
      ok: true,
      status: "prepared",
      preparedActionId: inserted.id,
      expiresAt,
    }, 201);
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
