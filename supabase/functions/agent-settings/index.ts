import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  fromAgentSettingsRow,
  toAgentSettingsRow,
  validateAgentSettings,
} from "../_shared/agent-settings.ts";
import {
  assertAgentSettingsBody,
  assertOwnedAgent,
  HttpError,
  readTemplateActions,
} from "./core.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function getEnv(key: string) {
  const value = Deno.env.get(key);

  if (!value) {
    throw new HttpError(500, "missing_env", `Missing required Edge Function secret: ${key}.`);
  }

  return value;
}

async function readJsonBody(request: Request) {
  const contentType = request.headers.get("Content-Type")?.toLowerCase() ?? "";

  if (!contentType.startsWith("application/json")) {
    throw new HttpError(415, "unsupported_media_type", "Use application/json for agent-settings.");
  }

  const length = Number(request.headers.get("Content-Length") ?? "0");

  if (length > 32_000) {
    throw new HttpError(413, "payload_too_large", "Settings are too large.");
  }

  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Agent settings request contains invalid JSON.");
  }
}

async function getUser(supabaseUrl: string, anonKey: string, authorization: string) {
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { Authorization: authorization },
    },
  });
  const { data, error } = await userClient.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, "unauthorized", "A valid account session is required.");
  }

  return data.user;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (request.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Use POST for agent-settings.");
    }

    const authorization = request.headers.get("Authorization") ?? "";

    if (!authorization.toLowerCase().startsWith("bearer ")) {
      throw new HttpError(401, "unauthorized", "A valid account session is required.");
    }

    const body = assertAgentSettingsBody(await readJsonBody(request));
    const supabaseUrl = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const user = await getUser(supabaseUrl, anonKey, authorization);
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: agentRow, error: agentError } = await serviceClient
      .from("agent_instances")
      .select("id,workspace_id,template_id")
      .eq("id", body.agentId)
      .maybeSingle();

    if (agentError) {
      throw agentError;
    }

    let ownerId: unknown = null;

    if (agentRow) {
      const { data: workspaceRow, error: workspaceError } = await serviceClient
        .from("workspaces")
        .select("owner_user_id")
        .eq("id", (agentRow as Record<string, unknown>).workspace_id)
        .maybeSingle();

      if (workspaceError) {
        throw workspaceError;
      }

      ownerId = (workspaceRow as Record<string, unknown> | null)?.owner_user_id;
    }

    const agent = assertOwnedAgent(agentRow, ownerId, user.id);
    const { data: templateRow, error: templateError } = await serviceClient
      .from("agent_templates")
      .select("actions")
      .eq("id", agent.template_id)
      .maybeSingle();

    if (templateError || !templateRow) {
      throw templateError ?? new Error("Template lookup failed.");
    }

    const validation = validateAgentSettings(
      body.settings,
      readTemplateActions((templateRow as Record<string, unknown>).actions),
    );

    if (!validation.ok) {
      throw new HttpError(400, "invalid_settings", validation.message, {
        field: validation.field,
      });
    }

    const { data: saved, error: saveError } = await serviceClient
      .from("agent_settings")
      .upsert({
        agent_id: agent.id,
        workspace_id: agent.workspace_id,
        ...toAgentSettingsRow(validation.settings),
        updated_at: new Date().toISOString(),
      }, { onConflict: "agent_id" })
      .select(
        "persona,instructions,knowledge,enabled_actions,enabled_modules,risk_profile,max_review_usd",
      )
      .single();

    if (saveError || !saved) {
      throw saveError ?? new Error("Settings save failed.");
    }

    // Best effort: the log records that settings changed, never their content.
    await serviceClient.from("activity_logs").insert({
      workspace_id: agent.workspace_id,
      agent_id: agent.id,
      source: "agent_instances",
      level: "info",
      message: "agent settings updated by the owner",
    });

    return jsonResponse({
      ok: true,
      status: "saved",
      message: "Settings saved. Your agent uses them from the next message.",
      settings: fromAgentSettingsRow(saved),
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        {
          ok: false,
          status: error.code,
          message: error.message,
          ...error.details,
        },
        error.statusCode,
      );
    }

    return jsonResponse(
      {
        ok: false,
        status: "server_error",
        message: "Kyra could not save these settings. Try again in a moment.",
      },
      500,
    );
  }
});
