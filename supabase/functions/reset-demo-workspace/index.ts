import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

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

function sanitizeErrorMessage(message: string) {
  return message
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "sb_secret_[hidden]")
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "sb_publishable_[hidden]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "jwt_[hidden]")
    .slice(0, 240);
}

function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error) {
    const payload = error as Record<string, unknown>;
    const parts = [payload.message, payload.details, payload.hint, payload.code]
      .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
      .map((part) => part.trim());

    if (parts.length) {
      return parts.join(" ");
    }
  }

  return "Reset demo workspace function failed.";
}

async function getAdminUser(supabaseUrl: string, anonKey: string, authorization: string) {
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
  const { data, error } = await userClient.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(401, "unauthorized", "A valid Supabase session is required.");
  }

  if (data.user.app_metadata?.role !== "admin") {
    throw new HttpError(403, "forbidden", "Admin role is required for demo workspace reset.");
  }

  return data.user;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (request.method !== "POST") {
      throw new HttpError(405, "method_not_allowed", "Use POST for reset-demo-workspace.");
    }

    const authorization = request.headers.get("Authorization") ?? "";

    if (!authorization.toLowerCase().startsWith("bearer ")) {
      throw new HttpError(401, "unauthorized", "A valid Supabase session is required.");
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const user = await getAdminUser(supabaseUrl, anonKey, authorization);
    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    const { data, error } = await serviceClient
      .from("workspaces")
      .delete()
      .eq("owner_user_id", user.id)
      .eq("mode", "demo")
      .select("id");

    if (error) {
      throw error;
    }

    const recordsRemoved = Boolean(data?.length);

    return jsonResponse({
      ok: true,
      status: recordsRemoved ? "reset" : "empty",
      message: recordsRemoved
        ? "Demo workspace reset. Agent quota is clear."
        : "No demo workspace exists for this session.",
      reset: {
        recordsRemoved,
        scope: "signed_in_demo_workspace",
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
        message: sanitizeErrorMessage(getUnknownErrorMessage(error)),
      },
      500,
    );
  }
});
