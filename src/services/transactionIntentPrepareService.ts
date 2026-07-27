import { appConfig } from "../config/appConfig";
import { productChainId } from "../types/unsignedTransactionHandoff";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey, sanitizeSupabaseMessage } from "./supabaseRestClient";

export interface TransactionIntentPrepareInput {
  workspaceId: string;
  agentId: string;
  requestId: string;
  recipient: `0x${string}`;
}

export interface TransactionIntentPrepareResult {
  ok: boolean;
  status: "prepared" | "not-configured" | "error";
  message: string;
}

interface PrepareResponse {
  ok?: boolean;
  status?: string;
  message?: string;
  preparedActionId?: string;
  expiresAt?: string;
}

export async function prepareTransactionIntent(
  session: KyraAuthSession | null,
  input: TransactionIntentPrepareInput,
): Promise<TransactionIntentPrepareResult> {
  if (appConfig.chain.currentKey !== "robinhood_mainnet") {
    return {
      ok: false,
      status: "not-configured",
      message: "Owner transaction preparation is available only in the approved Robinhood mainnet release.",
    };
  }

  if (!session || !appConfig.functions.transactionIntentPrepareConfigured) {
    return {
      ok: false,
      status: "not-configured",
      message: "Owner transaction preparation is unavailable.",
    };
  }

  try {
    const response = await fetch(appConfig.functions.transactionIntentPrepareUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: getSupabaseApiKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        requestId: input.requestId,
        chainKey: "robinhood_mainnet",
        chainId: productChainId,
        recipient: input.recipient,
        valueWei: "0",
        data: "0x",
      }),
    });
    const payload = await readResponse(response);
    if (!response.ok || payload.ok !== true || payload.status !== "prepared") {
      return {
        ok: false,
        status: "error",
        message: sanitizeSupabaseMessage(payload.message ?? "Transaction preparation failed safely."),
      };
    }

    return {
      ok: true,
      status: "prepared",
      message: "Owner transaction intent prepared and bound to this wallet session.",
    };
  } catch {
    return {
      ok: false,
      status: "error",
      message: "Transaction preparation failed safely.",
    };
  }
}

async function readResponse(response: Response): Promise<PrepareResponse> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as PrepareResponse;
  } catch {
    return {};
  }
}
