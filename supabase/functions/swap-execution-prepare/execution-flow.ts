import {
  HttpError,
  matchesExistingSwapExecutionIntent,
  type PreparedSwapExecutionIntent,
  prepareSwapExecutionIntent,
  type StoredSwapQuote,
  type SwapExecutionPrepareBody,
} from "./core.ts";
import {
  type ChainActionRateLimitRpcClient,
  createChainActionRateLimitChecker,
} from "../chain-action-prepare/rate-limit.ts";

// The owner-scoped part of preparing a swap step, shared by the dashboard
// endpoint (account session) and the Telegram Mini App (Telegram-signed
// owner). Callers must already have proven that ownerUserId is the owner.

const quoteColumns =
  "id,workspace_id,agent_id,request_id,chain_key,chain_id,taker_address,sell_token_address,sell_token_symbol,buy_token_address,sell_amount_atomic,allowance_target,transaction_to,transaction_data,transaction_value_wei,status,policy_version,quote_issued_at,expires_at";
const intentColumns =
  "id,owner_user_id,workspace_id,agent_id,quote_review_id,request_id,step,chain_key,chain_id,sender_address,transaction_to,transaction_data,transaction_value_wei,token_address,spender_address,allowance_amount_atomic,status,policy_version,expires_at";

// deno-lint-ignore no-explicit-any
type ServiceClient = any;

export interface OwnerFlowResult {
  status: number;
  body: Record<string, unknown>;
}

function preparedResponse(
  body: SwapExecutionPrepareBody,
  intent: PreparedSwapExecutionIntent,
  recordId: string,
) {
  return {
    ok: true,
    status: "prepared",
    intentId: body.requestId,
    intentRecordId: recordId,
    quoteRecordId: body.quoteRecordId,
    step: intent.step,
    chainKey: intent.chain_key,
    chainId: intent.chain_id,
    sender: intent.sender_address,
    transaction: {
      to: intent.transaction_to,
      data: intent.transaction_data,
      valueWei: intent.transaction_value_wei,
    },
    allowance: intent.step === "swap" ? null : {
      token: intent.token_address,
      spender: intent.spender_address,
      amountAtomic: intent.allowance_amount_atomic,
    },
    expiresAt: intent.expires_at,
    policyVersion: intent.policy_version,
    executionScope: "private_account_wallet",
  };
}

async function findExistingIntent(
  serviceClient: ServiceClient,
  body: SwapExecutionPrepareBody,
  ownerUserId: string,
) {
  const { data, error } = await serviceClient
    .from("swap_execution_intents")
    .select(intentColumns)
    .eq("owner_user_id", ownerUserId)
    .eq("workspace_id", body.workspaceId)
    .eq("agent_id", body.agentId)
    .eq("request_id", body.requestId)
    .maybeSingle();
  if (error) throw error;
  return data as (Record<string, unknown> & { id: string }) | null;
}

export async function runOwnerSwapExecutionPrepare(input: {
  serviceClient: ServiceClient;
  ownerUserId: string;
  body: SwapExecutionPrepareBody;
}): Promise<OwnerFlowResult> {
  const { serviceClient, ownerUserId, body } = input;
  const { data: workspace, error: workspaceError } = await serviceClient
    .from("workspaces")
    .select("id")
    .eq("id", body.workspaceId)
    .eq("owner_user_id", ownerUserId)
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
      "The selected agent is not ready for protected Robinhood Chain swap execution.",
    );
  }

  const { data: quote, error: quoteError } = await serviceClient
    .from("swap_quote_reviews")
    .select(quoteColumns)
    .eq("id", body.quoteRecordId)
    .eq("workspace_id", body.workspaceId)
    .eq("agent_id", body.agentId)
    .maybeSingle();
  if (quoteError) throw quoteError;
  if (!quote) {
    throw new HttpError(
      404,
      "swap_quote_not_found",
      "The reviewed swap quote is unavailable.",
    );
  }

  const expected = prepareSwapExecutionIntent({
    body,
    ownerUserId: ownerUserId,
    quote: quote as StoredSwapQuote,
  });
  const existing = await findExistingIntent(
    serviceClient,
    body,
    ownerUserId,
  );
  if (existing) {
    if (!matchesExistingSwapExecutionIntent(existing, expected)) {
      throw new HttpError(
        409,
        "swap_execution_conflict",
        "This execution request no longer matches its immutable review.",
      );
    }
    if (Date.parse(expected.expires_at) <= Date.now()) {
      throw new HttpError(
        409,
        "swap_execution_expired",
        "The reviewed swap step expired. Prepare it again.",
      );
    }
    return { status: 200, body: preparedResponse(body, expected, existing.id) };
  }

  let rateLimit;
  try {
    rateLimit = await createChainActionRateLimitChecker(
      serviceClient as unknown as ChainActionRateLimitRpcClient,
    )({
      ownerUserId: ownerUserId,
      workspaceId: body.workspaceId,
      agentId: body.agentId,
      chainKey: expected.chain_key,
    });
  } catch {
    throw new HttpError(
      503,
      "rate_limit_unavailable",
      "Swap execution preparation is temporarily unavailable.",
    );
  }
  if (!rateLimit.allowed) {
    throw new HttpError(
      429,
      "swap_execution_rate_limited",
      "Too many swap execution reviews. Wait before trying again.",
    );
  }

  const { data: inserted, error: insertError } = await serviceClient
    .from("swap_execution_intents")
    .insert(expected)
    .select("id")
    .single();
  if (insertError?.code === "23505") {
    const raced = await findExistingIntent(
      serviceClient,
      body,
      ownerUserId,
    );
    if (!raced || !matchesExistingSwapExecutionIntent(raced, expected)) {
      throw new HttpError(
        409,
        "swap_execution_conflict",
        "This execution request no longer matches its immutable review.",
      );
    }
    return { status: 200, body: preparedResponse(body, expected, raced.id) };
  }
  if (insertError?.message?.includes("daily_swap_limit_exceeded")) {
    throw new HttpError(
      429,
      "daily_swap_limit_exceeded",
      "You've reached today's swap limit for this workspace. It resets at 00:00 UTC.",
    );
  }
  if (insertError?.code === "23514") {
    throw new HttpError(
      409,
      "swap_execution_policy_rejected",
      "The protected swap step did not satisfy the execution policy.",
    );
  }
  if (insertError || !inserted?.id) {
    throw insertError ?? new Error("swap execution intent insert failed");
  }

  return { status: 201, body: preparedResponse(body, expected, inserted.id) };
}
