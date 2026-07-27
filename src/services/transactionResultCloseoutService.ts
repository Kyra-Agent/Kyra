import { appConfig } from "../config/appConfig";
import type {
  Phase8PersistedExecutionResult,
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
  verifiedStatus: Phase8PersistedExecutionResult["status"] | null;
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
      verifiedStatus: null,
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
          txHash: record.txHash,
        }),
      },
    );
    const payload = await readResponse(response);

    if (!response.ok || payload.ok === false) {
      return {
        status: "error",
        verifiedStatus: null,
        message: sanitizeSupabaseMessage(
          payload.message ?? "Owner-only result closeout failed safely.",
        ),
      };
    }

    const verifiedStatus = readVerifiedStatus(payload.status);
    if (!verifiedStatus) {
      return {
        status: "error",
        verifiedStatus: null,
        message: "The backend returned an invalid receipt verification state.",
      };
    }
    return {
      status: "saved",
      verifiedStatus,
      message: verifiedStatus === "confirmed"
        ? "Confirmed receipt persisted to the owner-only Kyra backend."
        : "Transaction result verified and persisted to the owner-only Kyra backend.",
    };
  } catch {
    return {
      status: "error",
      message: "Owner-only result closeout failed safely.",
      verifiedStatus: null,
    };
  }
}

function readVerifiedStatus(value: unknown): Phase8PersistedExecutionResult["status"] | null {
  return value === "submitted" || value === "confirmed" || value === "failed"
    ? value
    : null;
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