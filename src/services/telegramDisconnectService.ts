import { appConfig } from "../config/appConfig";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey } from "./supabaseRestClient";

export type TelegramDisconnectStatus =
  | "paused"
  | "disconnected"
  | "revoked"
  | "not_configured"
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "telegram_session_not_found"
  | "telegram_session_conflict"
  | "telegram_disconnect_unavailable"
  | "telegram_disconnect_cleanup_failed"
  | "server_error"
  | "function_unavailable"
  | "function_not_configured";

interface TelegramDisconnectPayload {
  ok?: boolean;
  status?: string;
  message?: string;
}

export interface TelegramDisconnectResult {
  ok: boolean;
  status: TelegramDisconnectStatus;
  message: string;
}

function normalizeStatus(status: string | undefined): TelegramDisconnectStatus {
  switch (status) {
    case "paused":
    case "disconnected":
    case "revoked":
    case "not_configured":
    case "invalid_request":
    case "unauthorized":
    case "forbidden":
    case "telegram_session_not_found":
    case "telegram_session_conflict":
    case "telegram_disconnect_unavailable":
    case "telegram_disconnect_cleanup_failed":
    case "server_error":
      return status;
    default:
      return "function_unavailable";
  }
}

function getTelegramDisconnectMessage(status: TelegramDisconnectStatus) {
  switch (status) {
    case "paused":
      return "Telegram connection paused.";
    case "disconnected":
      return "Telegram connection disconnected.";
    case "revoked":
      return "Telegram connection and backend credentials revoked.";
    case "not_configured":
    case "function_not_configured":
      return "Telegram disconnect backend is not configured.";
    case "invalid_request":
      return "Telegram disconnect request is incomplete or invalid.";
    case "unauthorized":
      return "Account session expired. Sign in again before disconnecting Telegram.";
    case "forbidden":
      return "This account cannot disconnect the selected Telegram agent.";
    case "telegram_session_not_found":
      return "No active Telegram session was found for this agent.";
    case "telegram_session_conflict":
      return "Telegram connection changed during this request. Refresh and try again.";
    case "telegram_disconnect_cleanup_failed":
      return "Telegram access was stopped, but backend cleanup needs another attempt.";
    case "telegram_disconnect_unavailable":
    case "server_error":
    case "function_unavailable":
    default:
      return "Telegram disconnect backend is temporarily unavailable.";
  }
}

async function parseResponse(response: Response): Promise<TelegramDisconnectPayload> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as TelegramDisconnectPayload;
  } catch {
    return { message: "Telegram disconnect backend returned an invalid response." };
  }
}

export async function revokeTelegramAgentConnection({
  session,
  agentId,
}: {
  session: KyraAuthSession;
  agentId: string;
}): Promise<TelegramDisconnectResult> {
  if (!appConfig.functions.telegramDisconnectConfigured) {
    return {
      ok: false,
      status: "function_not_configured",
      message: "Telegram disconnect backend is not configured.",
    };
  }

  try {
    const response = await fetch(appConfig.functions.telegramDisconnectUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: getSupabaseApiKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        agentId,
        action: "revoke",
      }),
    });
    const payload = await parseResponse(response);
    const status = normalizeStatus(payload.status);

    return {
      ok: response.ok && payload.ok === true && status === "revoked",
      status,
      message: getTelegramDisconnectMessage(status),
    };
  } catch {
    return {
      ok: false,
      status: "function_unavailable",
      message: "Telegram disconnect backend is temporarily unavailable.",
    };
  }
}
