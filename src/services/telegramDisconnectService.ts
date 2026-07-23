import { appConfig } from "../config/appConfig";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey, sanitizeSupabaseMessage } from "./supabaseRestClient";

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

function sanitizeMessage(message: string) {
  return sanitizeSupabaseMessage(message)
    .replace(/\b\d{5,20}:[A-Za-z0-9_-]{20,128}\b/g, "[telegram_token_hidden]")
    .replace(/vault:telegram:[A-Za-z0-9:_-]+/gi, "telegram_secret_[hidden]")
    .replace(/webhook:telegram:[A-Za-z0-9:_-]+/gi, "webhook_secret_[hidden]");
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
    const fallback = response.ok
      ? "Telegram connection revoked."
      : "Telegram connection could not be revoked safely.";

    return {
      ok: response.ok && payload.ok === true && status === "revoked",
      status,
      message: sanitizeMessage(payload.message ?? fallback),
    };
  } catch (error) {
    return {
      ok: false,
      status: "function_unavailable",
      message: error instanceof Error
        ? sanitizeMessage(error.message)
        : "Telegram disconnect backend is unavailable.",
    };
  }
}
