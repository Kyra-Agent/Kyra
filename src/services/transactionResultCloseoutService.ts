import { appConfig } from "../config/appConfig";
import type {
  Phase8PersistedExecutionResult,
  Phase8PersistedResultStatus,
} from "../types/phase8ResultPersistence";
import type { KyraAuthSession } from "./supabaseAuthService";
import {
  getSupabaseApiKey,
  sanitizeSupabaseMessage,
} from "./supabaseRestClient";

export type TransactionResultCloseoutStatus =
  | "not-configured"
  | "saved"
  | "error";

export interface TransactionResultCloseoutResult {
  status: TransactionResultCloseoutStatus;
  message: string;
}

interface CloseoutResponse {
  ok?: boolean;
  status?: string;
  message?: string;
}

export async function persistTransactionResultCloseout(
  session: KyraAuthSession | null,
  record: Phase8PersistedExecutionResult,
): Promise<TransactionResultCloseoutResult> {
  if (!session || !appConfig.functions.transactionResultCloseoutConfigured) {
    return {
      status: "not-configured",
      message: "Owner-only result closeout backend is unavailable.",
    };
  }

  try {
    const response = await fetch(
      appConfig.functions.transactionResultCloseoutUrl,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          apikey: getSupabaseApiKey(),
          Authorization: "Bearer " + session.accessToken,
        },
        body: JSON.stringify({
          workspaceId: record.workspaceId,
          agentId: record.agentId,
          preparedActionId: record.preparedActionId,
          submissionNonce: record.submissionNonce,
          txHash: record.txHash,
          status: record.status,
          failureCode: getFailureCode(record.status),
        }),
      },
    );
    const payload = await readResponse(response);

    if (!response.ok || payload.ok === false) {
      return {
        status: "error",
        message: sanitizeSupabaseMessage(
          payload.message ?? "Owner-only result closeout failed safely.",
        ),
      };
    }

    return {
      status: "saved",
      message: record.status === "confirmed"
        ? "Confirmed receipt persisted to the owner-only Kyra backend."
        : "Transaction result persisted to the owner-only Kyra backend.",
    };
  } catch {
    return {
      status: "error",
      message: "Owner-only result closeout failed safely.",
    };
  }
}

function getFailureCode(status: Phase8PersistedResultStatus) {
  return status === "failed" ? "transaction_reverted" : null;
}

async function readResponse(response: Response): Promise<CloseoutResponse> {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text) as CloseoutResponse;
  } catch {
    return {};
  }
}