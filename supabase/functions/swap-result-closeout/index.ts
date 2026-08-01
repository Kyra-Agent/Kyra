import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { kyraTokenAddress } from "../_shared/transfer-transaction-policy.ts";
import {
  assertExistingSwapResultScope,
  assertStoredSwapExecutionIntent,
  assertSwapResultCloseoutBody,
  type ExistingSwapExecutionResult,
  HttpError,
  nextSwapExecutionAction,
  reconcileSwapExecutionResultStatus,
} from "./core.ts";
import {
  readReceiptRpcConfig,
  verifySwapExecutionReceipt,
} from "./receipt-verifier.ts";

const allowedOrigins = new Set([
  "https://kyraagent.xyz",
  "https://www.kyraagent.xyz",
  "http://localhost:4173",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
  "http://127.0.0.1:5173",
]);
const maxBodyBytes = 4096;
const intentColumns =
  "id,owner_user_id,workspace_id,agent_id,quote_review_id,request_id,step,chain_key,chain_id,sender_address,transaction_to,transaction_data,transaction_value_wei,token_address,spender_address,allowance_amount_atomic,status,policy_version,expires_at";
const resultColumns =
  "id,owner_user_id,workspace_id,agent_id,intent_id,request_id,step,chain_key,chain_id,submission_key,tx_hash,status";

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
      "swap_closeout_not_configured",
      "Protected swap verification is not configured.",
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
      "Swap closeout request is too large.",
    );
  }

  const reader = request.body?.getReader();
  if (!reader) {
    throw new HttpError(
      400,
      "invalid_json",
      "Swap closeout request contains invalid JSON.",
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
          // The oversized body still fails closed.
        }
        throw new HttpError(
          413,
          "payload_too_large",
          "Swap closeout request is too large.",
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
      // The malformed body still fails closed.
    }
    throw new HttpError(
      400,
      "invalid_json",
      "Swap closeout request contains invalid JSON.",
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
      "Swap closeout request contains invalid JSON.",
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
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
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
        "Use POST for protected swap closeout.",
      );
    }
    const origin = request.headers.get("Origin");
    if (origin && !allowedOrigins.has(origin)) {
      throw new HttpError(
        403,
        "origin_forbidden",
        "This origin cannot close out swap execution.",
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

    const body = assertSwapResultCloseoutBody(await readJsonBody(request));
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
        "The selected agent is not ready for protected Robinhood Chain swap verification.",
      );
    }

    const { data: intentData, error: intentError } = await serviceClient
      .from("swap_execution_intents")
      .select(intentColumns)
      .eq("id", body.intentRecordId)
      .eq("owner_user_id", userData.user.id)
      .eq("workspace_id", body.workspaceId)
      .eq("agent_id", body.agentId)
      .eq("request_id", body.requestId)
      .maybeSingle();
    if (intentError) throw intentError;
    if (!intentData) {
      throw new HttpError(
        404,
        "swap_execution_intent_not_found",
        "The owner-scoped swap step is unavailable.",
      );
    }
    const intent = assertStoredSwapExecutionIntent(intentData, {
      ...body,
      ownerUserId: userData.user.id,
    });

    const { data: quote, error: quoteError } = await serviceClient
      .from("swap_quote_reviews")
      .select("id,sell_token_address,allowance_target")
      .eq("id", intent.quote_review_id)
      .eq("workspace_id", body.workspaceId)
      .eq("agent_id", body.agentId)
      .maybeSingle();
    if (quoteError) throw quoteError;
    if (!quote) {
      throw new HttpError(
        409,
        "swap_quote_lineage_missing",
        "The reviewed swap lineage is unavailable.",
      );
    }
    const erc20AllowanceLineage = intent.step === "swap" &&
      typeof quote.sell_token_address === "string" &&
      quote.sell_token_address.toLowerCase() ===
        kyraTokenAddress.toLowerCase() &&
      typeof quote.allowance_target === "string";

    const submissionKey = await sha256Hex(
      `${userData.user.id}:${intent.id}:${body.txHash}`,
    );
    const { data: existingData, error: existingError } = await serviceClient
      .from("swap_execution_results")
      .select(resultColumns)
      .eq("owner_user_id", userData.user.id)
      .eq("intent_id", intent.id)
      .maybeSingle();
    if (existingError) throw existingError;

    const expectedResultScope = {
      ownerUserId: userData.user.id,
      body,
      intent,
      submissionKey,
    };
    const existing = existingData as ExistingSwapExecutionResult | null;
    if (existing) {
      assertExistingSwapResultScope(existing, expectedResultScope);
    }

    const rpcConfig = readReceiptRpcConfig((key) => Deno.env.get(key));
    const verified = await verifySwapExecutionReceipt({
      rpcUrl: rpcConfig.rpcUrl,
      txHash: body.txHash,
      intent,
    });

    async function reconcileExistingResult(
      persisted: ExistingSwapExecutionResult,
    ) {
      const reconciliation = reconcileSwapExecutionResultStatus(
        persisted.status,
        verified.status,
      );
      if (!reconciliation.shouldUpdate) return reconciliation.status;

      const { error: updateError } = await serviceClient
        .from("swap_execution_results")
        .update({
          status: verified.status,
          failure_code: verified.failureCode,
          receipt_block_number: verified.blockNumber,
          receipt_checked_at: verified.checkedAt,
          updated_at: verified.checkedAt,
        })
        .eq("id", persisted.id);
      if (updateError?.code === "23514") {
        throw new HttpError(
          409,
          "swap_status_transition_forbidden",
          "The persisted swap result is already terminal.",
        );
      }
      if (updateError) throw updateError;
      return reconciliation.status;
    }

    let resultStatus = verified.status;
    if (existing) {
      resultStatus = await reconcileExistingResult(existing);
    } else {
      const { error: insertError } = await serviceClient
        .from("swap_execution_results")
        .insert({
          owner_user_id: userData.user.id,
          workspace_id: body.workspaceId,
          agent_id: body.agentId,
          intent_id: intent.id,
          request_id: body.requestId,
          step: intent.step,
          chain_key: intent.chain_key,
          chain_id: intent.chain_id,
          submission_key: submissionKey,
          tx_hash: body.txHash,
          status: verified.status,
          failure_code: verified.failureCode,
          receipt_block_number: verified.blockNumber,
          receipt_checked_at: verified.checkedAt,
          updated_at: verified.checkedAt,
        });
      if (insertError?.code === "23505") {
        const { data: racedData, error: racedError } = await serviceClient
          .from("swap_execution_results")
          .select(resultColumns)
          .eq("owner_user_id", userData.user.id)
          .eq("intent_id", intent.id)
          .maybeSingle();
        if (racedError) throw racedError;
        if (!racedData) {
          throw new HttpError(
            409,
            "swap_closeout_conflict",
            "This transaction closeout is already bound to another reviewed step.",
          );
        }
        const raced = racedData as ExistingSwapExecutionResult;
        assertExistingSwapResultScope(raced, expectedResultScope);
        resultStatus = await reconcileExistingResult(raced);
      } else if (insertError?.code === "23514") {
        throw new HttpError(
          409,
          "swap_closeout_policy_rejected",
          "The verified result did not match the protected swap policy.",
        );
      } else if (insertError) {
        throw insertError;
      }
    }

    return jsonResponse(request, {
      ok: true,
      status: resultStatus,
      step: intent.step,
      chainKey: intent.chain_key,
      txHashLabel: maskHash(body.txHash),
      nextAction: nextSwapExecutionAction({
        step: intent.step,
        status: resultStatus,
        erc20AllowanceLineage,
      }),
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
        message: "Kyra could not verify this protected swap step safely.",
      },
      500,
    );
  }
});
