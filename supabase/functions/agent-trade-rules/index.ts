import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertOwnedAgent,
  assertTradeRulesRequest,
  describeRuleChange,
  HttpError,
  readTradeRuleRows,
  tradeRuleColumns,
} from "./core.ts";
import { allowedBrowserOrigins } from "../_shared/allowed-origins.ts";
import { logSafeEvent } from "../_shared/safe-log.ts";

// Lets an owner see their agent's DCA, stop-loss, and take-profit rules in
// the dashboard and pause, resume, or delete one. Rules never trade; they
// only make the agent's bot send a swap prompt the owner confirms.

const maxBodyBytes = 2048;
const maxRules = 20;

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
    throw new HttpError(503, "not_configured", "Trade rules are not available right now.");
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
    throw new HttpError(413, "payload_too_large", "The trade rule request is too large.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, "invalid_json", "The trade rule request contains invalid JSON.");
  }
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
      throw new HttpError(403, "origin_forbidden", "This origin cannot manage trade rules.");
    }
    const authorization = request.headers.get("Authorization") ?? "";
    if (!authorization.toLowerCase().startsWith("bearer ")) {
      throw new HttpError(401, "unauthorized", "A valid account session is required.");
    }

    const body = assertTradeRulesRequest(await readJsonBody(request));
    const supabaseUrl = getEnv("SUPABASE_URL");
    const userClient = createClient(supabaseUrl, getEnv("SUPABASE_ANON_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      throw new HttpError(401, "unauthorized", "A valid account session is required.");
    }
    const serviceClient = createClient(supabaseUrl, getEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const agentRow = await serviceClient.from("agent_instances")
      .select("id,workspace_id")
      .eq("id", body.agentId)
      .maybeSingle();
    if (agentRow.error) throw agentRow.error;
    const workspaceRow = agentRow.data
      ? await serviceClient.from("workspaces")
        .select("owner_user_id")
        .eq("id", agentRow.data.workspace_id)
        .maybeSingle()
      : null;
    if (workspaceRow?.error) throw workspaceRow.error;
    const agent = assertOwnedAgent(agentRow.data, workspaceRow?.data?.owner_user_id, userData.user.id);

    let message: string | null = null;
    if (body.action !== "list") {
      const change = body.action === "delete"
        ? await serviceClient.rpc("delete_agent_trade_rule", {
          p_agent_id: agent.id,
          p_rule_id: body.ruleId,
        })
        : await serviceClient.rpc("set_agent_trade_rule_enabled", {
          p_agent_id: agent.id,
          p_rule_id: body.ruleId,
          p_enabled: body.action === "resume",
        });
      if (change.error) throw change.error;
      message = describeRuleChange(body.action, change.data);

      // Best effort: the log records that a rule changed, never its content.
      await serviceClient.from("activity_logs").insert({
        workspace_id: agentRow.data!.workspace_id,
        agent_id: agent.id,
        source: "agent_instances",
        level: "info",
        message: `trade rule ${body.action}d by the owner`,
      });
    }

    const rules = await serviceClient.from("agent_trade_rules")
      .select(tradeRuleColumns)
      .eq("agent_id", agent.id)
      .order("created_at", { ascending: false })
      .limit(maxRules);
    if (rules.error) throw rules.error;

    return jsonResponse(request, {
      ok: true,
      status: body.action === "list" ? "listed" : "updated",
      ...(message ? { message } : {}),
      rules: readTradeRuleRows(rules.data),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(request, { ok: false, status: error.code, message: error.message }, error.statusCode);
    }
    logSafeEvent("agent_trade_rules_failed", "unexpected_error");
    return jsonResponse(request, {
      ok: false,
      status: "server_error",
      message: "Kyra could not update trade rules. Try again in a moment.",
    }, 500);
  }
});
