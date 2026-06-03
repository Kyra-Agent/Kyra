import { appConfig } from "../config/appConfig";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey, sanitizeSupabaseMessage } from "./supabaseRestClient";

export type TelegramConnectStatus =
  | "not_configured"
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "agent_not_found"
  | "server_error"
  | "function_unavailable"
  | "function_not_configured";

interface TelegramConnectPayload {
  ok?: boolean;
  status?: string;
  message?: string;
}

export interface TelegramConnectResult {
  ok: boolean;
  status: TelegramConnectStatus;
  message: string;
}

const tokenLikePattern = /\b\d{5,20}:[A-Za-z0-9_-]{20,128}\b/g;

function sanitizeTelegramConnectMessage(message: string) {
  return sanitizeSupabaseMessage(message).replace(tokenLikePattern, "[telegram_token_hidden]");
}

async function parseTelegramConnectResponse(response: Response): Promise<TelegramConnectPayload> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as TelegramConnectPayload;
  } catch {
    return {
      message: text,
    };
  }
}

function normalizeTelegramConnectStatus(status: string | undefined): TelegramConnectStatus {
  switch (status) {
    case "not_configured":
    case "invalid_request":
    case "unauthorized":
    case "forbidden":
    case "agent_not_found":
    case "server_error":
      return status;
    default:
      return "function_unavailable";
  }
}

export async function connectTelegramBot({
  session,
  agentId,
  botToken,
}: {
  session: KyraAuthSession;
  agentId: string;
  botToken: string;
}): Promise<TelegramConnectResult> {
  if (!appConfig.functions.telegramConnectConfigured) {
    return {
      ok: false,
      status: "function_not_configured",
      message: "Telegram connect backend is not configured yet.",
    };
  }

  try {
    const response = await fetch(appConfig.functions.telegramConnectUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: getSupabaseApiKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        agentId,
        botToken,
      }),
    });
    const payload = await parseTelegramConnectResponse(response);
    const status = normalizeTelegramConnectStatus(payload.status);
    const fallbackMessage = response.ok
      ? "Telegram connect request completed."
      : `Telegram connect request failed with ${response.status}.`;

    return {
      ok: Boolean(payload.ok) && response.ok,
      status,
      message: sanitizeTelegramConnectMessage(payload.message ?? fallbackMessage),
    };
  } catch (error) {
    return {
      ok: false,
      status: "function_unavailable",
      message:
        error instanceof Error
          ? sanitizeTelegramConnectMessage(error.message)
          : "Telegram connect backend is unavailable.",
    };
  }
}
