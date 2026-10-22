import {
  assertExistingSwapResultScope,
  assertStoredSwapExecutionIntent,
  type ExistingSwapExecutionResult,
  HttpError,
  nextSwapExecutionAction,
  reconcileSwapExecutionResultStatus,
  type SwapResultCloseoutBody,
} from "./core.ts";
import {
  readReceiptRpcConfig,
  verifySwapExecutionReceipt,
} from "./receipt-verifier.ts";

// The owner-scoped part of verifying a swap step, shared by the dashboard
// endpoint (account session) and the Telegram Mini App (Telegram-signed
// owner). Callers must already have proven that ownerUserId is the owner.

const intentColumns =
  "id,owner_user_id,workspace_id,agent_id,quote_review_id,request_id,step,chain_key,chain_id,sender_address,transaction_to,transaction_data,transaction_value_wei,token_address,spender_address,allowance_amount_atomic,status,policy_version,expires_at";
const resultColumns =
  "id,owner_user_id,workspace_id,agent_id,intent_id,request_id,step,chain_key,chain_id,submission_key,tx_hash,status";

// deno-lint-ignore no-explicit-any
type ServiceClient = any;

export interface OwnerFlowResult {
  status: number;
  body: Record<string, unknown>;
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

export async function runOwnerSwapCloseout(input: {
  serviceClient: ServiceClient;
  ownerUserId: string;
  body: SwapResultCloseoutBody;
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
      "The selected agent is not ready for protected Robinhood Chain swap verification.",
    );
  }

  const { data: intentData, error: intentError } = await serviceClient
    .from("swap_execution_intents")
    .select(intentColumns)
    .eq("id", body.intentRecordId)
    .eq("owner_user_id", ownerUserId)
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
    ownerUserId: ownerUserId,
  });

  const { data: quote, error: quoteError } = await serviceClient
    .from("swap_quote_reviews")
    .select("id,sell_token_symbol,allowance_target")
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
    quote.sell_token_symbol === "USDG" &&
    typeof quote.allowance_target === "string";

  const submissionKey = await sha256Hex(
    `${ownerUserId}:${intent.id}:${body.txHash}`,
  );
  const { data: existingData, error: existingError } = await serviceClient
    .from("swap_execution_results")
    .select(resultColumns)
    .eq("owner_user_id", ownerUserId)
    .eq("intent_id", intent.id)
    .maybeSingle();
  if (existingError) throw existingError;

  const expectedResultScope = {
    ownerUserId: ownerUserId,
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
        owner_user_id: ownerUserId,
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
        .eq("owner_user_id", ownerUserId)
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

  return { status: 200, body: {
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
  } };
}
