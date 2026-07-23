import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertRemoveAgentBody,
  assertRemoveOwnedAgentRpcRow,
  getRemoveAgentFailure,
  HttpError,
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
    throw new HttpError(415, "unsupported_media_type", "Use application/json for remove-agent.");
  }

  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "invalid_json", "Remove agent request contains invalid JSON.");
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
      throw new HttpError(405, "method_not_allowed", "Use POST for remove-agent.");
    }

    const authorization = request.headers.get("Authorization") ?? "";

    if (!authorization.toLowerCase().startsWith("bearer ")) {
      throw new HttpError(401, "unauthorized", "A valid account session is required.");
    }

    const body = assertRemoveAgentBody(await readJsonBody(request));
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
    const { data, error } = await serviceClient.rpc("remove_owned_demo_agent", {
      p_owner_user_id: user.id,
      p_agent_id: body.agentId,
    });

    if (error) {
      throw error;
    }

    const result = assertRemoveOwnedAgentRpcRow(data);

    if (!result.ok) {
      throw getRemoveAgentFailure(result.status);
    }

    return jsonResponse({
      ok: true,
      status: "removed",
      message: `${result.display_name ?? "Agent"} was removed. One agent slot is now available.`,
      removed: {
        displayName: result.display_name,
      },
      quota: {
        used: result.remaining_count ?? 0,
        limit: 3,
        remaining: Math.max(0, 3 - (result.remaining_count ?? 0)),
      },
    });
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        {
          ok: false,
          status: error.code,
          message: error.message,
        },
        error.statusCode,
      );
    }

    return jsonResponse(
      {
        ok: false,
        status: "server_error",
        message: "Kyra could not safely remove this agent.",
      },
      500,
    );
  }
});
