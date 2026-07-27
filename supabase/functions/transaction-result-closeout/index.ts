import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  assertExistingScope,
  assertStoredTransactionIntent,
  assertTransactionResultCloseoutBody,
  canTransitionExecutionResult,
  type ExistingExecutionResult,
  HttpError,
  isStaleSubmittedResult,
} from "./core.ts";
import {
  readReceiptRpcConfig,
  verifyTransactionReceipt,
} from "./receipt-verifier.ts";

const allowedOrigins = new Set([
  "https://kyraagent.xyz",
  "https://www.kyraagent.xyz",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
]);

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
    throw new HttpError(
      415,
      "unsupported_media_type",
      "Use application/json for result closeout.",
    );
  }

  const contentLength = Number(request.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(contentLength) && contentLength > 8192) {
    throw new HttpError(
      413,
      "payload_too_large",
      "Result closeout payload is too large.",
    );
  }

  const text = await request.text();
  if (text.length > 8192) {
    throw new HttpError(
      413,
      "payload_too_large",
      "Result closeout payload is too large.",
    );
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(
      400,
      "invalid_json",
      "Result closeout contains invalid JSON.",
    );
  }
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function maskHash(hash: string) {
  return hash.slice(0, 10) + "..." + hash.slice(-8);
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
        "Use POST for result closeout.",
      );
    }

    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigins.has(origin)) {
      throw new HttpError(
        403,
        "origin_forbidden",
        "This origin cannot write execution results.",
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

    const body = assertTransactionResultCloseoutBody(
      await readJsonBody(request),
    );
    const supabaseUrl = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const userClient = createClient(supabaseUrl, anonKey, {
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

    const serviceClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
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
      .select("id")
      .eq("id", body.agentId)
      .eq("workspace_id", body.workspaceId)
      .maybeSingle();
    if (agentError) throw agentError;
    if (!agent) {
      throw new HttpError(
        403,
        "agent_forbidden",
        "The agent is outside the owner workspace.",
      );
    }

    const { data: intentData, error: intentError } = await serviceClient
      .from("prepared_actions")
      .select(
        "id,workspace_id,agent_id,request_id,action_kind,chain_key,chain_id,status,recipient,value_wei,calldata,expires_at",
      )
      .eq("workspace_id", body.workspaceId)
      .eq("agent_id", body.agentId)
      .eq("request_id", body.preparedActionId)
      .maybeSingle();
    if (intentError) throw intentError;
    const intent = assertStoredTransactionIntent(
      intentData,
      {
        workspaceId: body.workspaceId,
        agentId: body.agentId,
        preparedActionId: body.preparedActionId,
      },
      new Date(),
      true,
    );
    const submissionKey = await sha256Hex(
      `${userData.user.id}:${intent.id}:${body.txHash}`,
    );
    const { data: existingData, error: existingError } = await serviceClient
      .from("execution_results")
      .select(
        "id,owner_user_id,workspace_id,agent_id,prepared_action_id,prepared_action_record_id,submission_key,tx_hash,status",
      )
      .eq("owner_user_id", userData.user.id)
      .eq("submission_key", submissionKey)
      .maybeSingle();
    if (existingError) throw existingError;

    if (!existingData) {
      assertStoredTransactionIntent(intent, {
        workspaceId: body.workspaceId,
        agentId: body.agentId,
        preparedActionId: body.preparedActionId,
      });
    }

    const rpcConfig = readReceiptRpcConfig((key) => Deno.env.get(key));
    const verified = await verifyTransactionReceipt({
      rpcUrl: rpcConfig.rpcUrl,
      txHash: body.txHash,
      intent,
    });

    const now = verified.checkedAt;
    let resultStatus = verified.status;

    if (existingData) {
      const existing = existingData as ExistingExecutionResult;
      assertExistingScope(existing, {
        ownerUserId: userData.user.id,
        workspaceId: body.workspaceId,
        agentId: body.agentId,
        preparedActionRecordId: intent.id,
        preparedActionId: body.preparedActionId,
        submissionKey,
        txHash: body.txHash,
      });
      if (isStaleSubmittedResult(existing.status, verified.status)) {
        resultStatus = existing.status;
      } else if (
        !canTransitionExecutionResult(existing.status, verified.status)
      ) {
        throw new HttpError(
          409,
          "status_transition_forbidden",
          "The persisted execution result is already terminal.",
        );
      } else {
        const { error: updateError } = await serviceClient
          .from("execution_results")
          .update({
            status: verified.status,
            failure_code: verified.failureCode,
            receipt_block_number: verified.blockNumber,
            receipt_checked_at: verified.checkedAt,
            confirmed_at: verified.status === "confirmed" ? now : null,
            updated_at: now,
          })
          .eq("id", existing.id);
        if (updateError) throw updateError;
      }
    } else {
      const { error: insertError } = await serviceClient
        .from("execution_results")
        .insert({
          owner_user_id: userData.user.id,
          workspace_id: body.workspaceId,
          agent_id: body.agentId,
          prepared_action_id: body.preparedActionId,
          prepared_action_record_id: intent.id,
          submission_key: submissionKey,
          chain_key: "robinhood_mainnet",
          chain_id: 4663,
          tx_hash: body.txHash,
          status: verified.status,
          failure_code: verified.failureCode,
          receipt_block_number: verified.blockNumber,
          receipt_checked_at: verified.checkedAt,
          visibility: "owner-only",
          submitted_at: now,
          confirmed_at: verified.status === "confirmed" ? now : null,
          updated_at: now,
        });
      if (insertError) throw insertError;
    }

    return jsonResponse(request, {
      ok: true,
      status: resultStatus,
      chain: "robinhood_mainnet",
      txHashLabel: maskHash(body.txHash),
      visibility: "owner-only",
    });
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
        message: "Kyra could not persist this execution result safely.",
      },
      500,
    );
  }
});
