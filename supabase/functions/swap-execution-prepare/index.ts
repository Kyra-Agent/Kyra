import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { assertSwapExecutionPrepareBody, HttpError } from "./core.ts";
import { runOwnerSwapExecutionPrepare } from "./execution-flow.ts";
import { allowedBrowserOrigins } from "../_shared/allowed-origins.ts";

const allowedOrigins = allowedBrowserOrigins;
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
    const result = await runOwnerSwapExecutionPrepare({
      serviceClient,
      ownerUserId: userData.user.id,
      body,
    });
    return jsonResponse(request, result.body, result.status);
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
