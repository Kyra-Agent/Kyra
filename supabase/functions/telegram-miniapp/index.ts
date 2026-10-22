import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertMiniAppRequest,
  HttpError,
  isRecord,
  type MiniAppRequest,
  verifyTelegramInitData,
} from "./core.ts";
import { allowedBrowserOrigins } from "../_shared/allowed-origins.ts";
import { assertSwapQuotePrepareBody } from "../swap-quote-prepare/core.ts";
import { runOwnerSwapQuote } from "../swap-quote-prepare/quote-flow.ts";
import { assertSwapExecutionPrepareBody } from "../swap-execution-prepare/core.ts";
import { runOwnerSwapExecutionPrepare } from "../swap-execution-prepare/execution-flow.ts";
import { assertSwapResultCloseoutBody } from "../swap-result-closeout/core.ts";
import { runOwnerSwapCloseout } from "../swap-result-closeout/closeout-flow.ts";
import { deliverTelegramReadOnlyResponse } from "../telegram-webhook/response-delivery.ts";
import { logSafeEvent } from "../_shared/safe-log.ts";

// Backend for the Kyra Telegram Mini App. The owner opens it from a button
// their agent's bot sent; Telegram signs the session with that bot's token.
// Every action re-checks that signature and that the Telegram user is the
// agent's linked owner, then runs the same owner-scoped swap flows as the
// dashboard. Kyra never signs: the Mini App hands each step to the owner's
// wallet.

const maxBodyBytes = 8192;
const explorerUrl = "https://robinhoodchain.blockscout.com";

function corsHeaders(request: Request) {
  const origin = request.headers.get("Origin") ?? "";
  return {
    "Access-Control-Allow-Origin": allowedBrowserOrigins.has(origin) ? origin : "https://kyraagent.xyz",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function jsonResponse(request: Request, body: Record<string, unknown>, status = 200) {
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
    throw new HttpError(503, "miniapp_not_configured", "The Kyra Mini App is not configured.");
  }
  return value;
}

async function readJsonBody(request: Request) {
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";
  if (contentType.split(";")[0]?.trim() !== "application/json") {
    throw new HttpError(415, "unsupported_media_type", "Use application/json.");
  }
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBodyBytes) {
    throw new HttpError(413, "payload_too_large", "The Kyra Mini App request is too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "The Kyra Mini App request contains invalid JSON.");
  }
}

// deno-lint-ignore no-explicit-any
type ServiceClient = any;

interface OwnerScope {
  ownerUserId: string;
  workspaceId: string;
  agentName: string;
  sessionId: string;
  botToken: string;
  telegramUserId: string;
}

// Proves the request comes from the agent's linked owner, inside a Mini App
// opened from that agent's bot.
async function resolveOwnerScope(
  serviceClient: ServiceClient,
  request: MiniAppRequest,
): Promise<OwnerScope> {
  const session = await serviceClient.from("telegram_sessions")
    .select("id")
    .eq("agent_id", request.agentId)
    .eq("webhook_status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (session.error) throw session.error;
  if (!session.data?.id) {
    throw new HttpError(404, "miniapp_agent_unavailable", "This agent has no connected Telegram bot.");
  }

  const token = await serviceClient.rpc("resolve_telegram_delivery_token", {
    p_telegram_session_id: session.data.id,
  });
  if (token.error || typeof token.data !== "string" || !token.data) {
    throw new HttpError(503, "miniapp_not_configured", "The Kyra Mini App is not configured.");
  }

  const { telegramUserId } = await verifyTelegramInitData(request.initData, token.data);

  // Mini App buttons only appear in the owner's private chat with the bot,
  // where the chat id is the user's own id.
  const owner = await serviceClient.from("telegram_chat_authorizations")
    .select("id")
    .eq("agent_id", request.agentId)
    .eq("role", "owner")
    .eq("telegram_user_id", telegramUserId)
    .eq("telegram_chat_id", telegramUserId)
    .is("revoked_at", null)
    .limit(1)
    .maybeSingle();
  if (owner.error) throw owner.error;
  if (!owner.data?.id) {
    throw new HttpError(403, "miniapp_not_owner", "Only the agent's owner can swap from this bot.");
  }

  const agent = await serviceClient.from("agent_instances")
    .select("id,workspace_id,display_name")
    .eq("id", request.agentId)
    .maybeSingle();
  if (agent.error) throw agent.error;
  const workspace = agent.data
    ? await serviceClient.from("workspaces").select("owner_user_id").eq("id", agent.data.workspace_id).maybeSingle()
    : null;
  if (workspace?.error) throw workspace.error;
  if (!agent.data || typeof workspace?.data?.owner_user_id !== "string") {
    throw new HttpError(404, "miniapp_agent_unavailable", "This agent is no longer available.");
  }

  return {
    ownerUserId: workspace.data.owner_user_id,
    workspaceId: String(agent.data.workspace_id),
    agentName: String(agent.data.display_name ?? "Kyra agent"),
    sessionId: String(session.data.id),
    botToken: token.data,
    telegramUserId,
  };
}

function assertSwapExecutionEnabled() {
  if (Deno.env.get("KYRA_PROTECTED_SWAP_EXECUTION_ENABLED") !== "true") {
    throw new HttpError(503, "swap_execution_disabled", "Swaps are not enabled right now.");
  }
}

async function runAction(
  serviceClient: ServiceClient,
  request: MiniAppRequest,
  scope: OwnerScope,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const payload = request.payload;

  if (request.action === "context") {
    let rule: Record<string, unknown> | null = null;
    if (typeof payload.ruleId === "string") {
      const found = await serviceClient.from("agent_trade_rules")
        .select("id,kind,sell_token_symbol,buy_token_symbol,sell_amount_atomic")
        .eq("id", payload.ruleId)
        .eq("agent_id", request.agentId)
        .maybeSingle();
      if (found.error) throw found.error;
      rule = found.data ?? null;
    }
    return {
      status: 200,
      body: {
        ok: true,
        agentName: scope.agentName,
        rule: rule
          ? {
            kind: rule.kind,
            sell: rule.sell_token_symbol,
            buy: rule.buy_token_symbol,
            amountAtomic: rule.sell_amount_atomic,
          }
          : null,
      },
    };
  }

  if (request.action === "quote") {
    const body = assertSwapQuotePrepareBody({
      workspaceId: scope.workspaceId,
      agentId: request.agentId,
      requestId: payload.requestId,
      chainKey: "robinhood_mainnet",
      chainId: 4663,
      taker: payload.taker,
      sellToken: payload.sellToken,
      buyToken: payload.buyToken,
      sellAmount: payload.sellAmount,
      slippageBps: payload.slippageBps,
      policyVersion: 2,
    });
    return await runOwnerSwapQuote({ serviceClient, ownerUserId: scope.ownerUserId, body });
  }

  assertSwapExecutionEnabled();

  if (request.action === "prepare") {
    const body = assertSwapExecutionPrepareBody({
      workspaceId: scope.workspaceId,
      agentId: request.agentId,
      quoteRecordId: payload.quoteRecordId,
      requestId: payload.requestId,
      step: payload.step,
    });
    return await runOwnerSwapExecutionPrepare({ serviceClient, ownerUserId: scope.ownerUserId, body });
  }

  const body = assertSwapResultCloseoutBody({
    workspaceId: scope.workspaceId,
    agentId: request.agentId,
    intentRecordId: payload.intentRecordId,
    requestId: payload.requestId,
    txHash: payload.txHash,
  });
  const before = await serviceClient.from("swap_execution_results")
    .select("status")
    .eq("intent_id", body.intentRecordId)
    .maybeSingle();
  if (before.error) throw before.error;
  const result = await runOwnerSwapCloseout({ serviceClient, ownerUserId: scope.ownerUserId, body });

  // Tell the owner in chat once, the first time a swap is confirmed.
  if (
    result.body.status === "confirmed" && result.body.step === "swap" &&
    before.data?.status !== "confirmed"
  ) {
    try {
      await deliverTelegramReadOnlyResponse({
        botToken: scope.botToken,
        telegramChatId: scope.telegramUserId,
        response: {
          command: "swap",
          text: `Swap complete on Uniswap. Receipt verified on Robinhood Chain.\n${explorerUrl}/tx/${body.txHash}`,
        },
      });
    } catch {
      logSafeEvent("telegram_miniapp_notify_failed", "swap_confirmed");
    }
  }
  return result;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }

  try {
    if (request.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Use POST.");
    }
    const origin = request.headers.get("Origin");
    if (origin && !allowedBrowserOrigins.has(origin)) {
      throw new HttpError(403, "origin_forbidden", "This origin cannot use the Kyra Mini App.");
    }

    const miniAppRequest = assertMiniAppRequest(await readJsonBody(request));
    const serviceClient = createClient(getEnv("SUPABASE_URL"), getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const scope = await resolveOwnerScope(serviceClient, miniAppRequest);
    const result = await runAction(serviceClient, miniAppRequest, scope);
    return jsonResponse(request, result.body, result.status);
  } catch (error) {
    if (error instanceof HttpError || (isRecord(error) && typeof error.statusCode === "number" && typeof error.code === "string")) {
      const known = error as unknown as HttpError;
      return jsonResponse(request, { ok: false, status: known.code, message: known.message }, known.statusCode);
    }
    logSafeEvent("telegram_miniapp_failed", "unexpected_error");
    return jsonResponse(request, {
      ok: false,
      status: "server_error",
      message: "Kyra could not complete this step safely.",
    }, 500);
  }
});
