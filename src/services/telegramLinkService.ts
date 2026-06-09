import { appConfig } from "../config/appConfig";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey, sanitizeSupabaseMessage } from "./supabaseRestClient";

export type TelegramLinkStatus =
  | "link_ready"
  | "not_configured"
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "agent_not_found"
  | "owner_link_unavailable"
  | "rate_limited"
  | "server_error"
  | "function_unavailable"
  | "function_not_configured";

interface TelegramLinkPayload {
  ok?: boolean;
  status?: string;
  message?: string;
  telegramLink?: string;
  expiresAt?: string;
}

export interface TelegramLinkResult {
  ok: boolean;
  status: TelegramLinkStatus;
  message: string;
  telegramLink: string | null;
  expiresAt: string | null;
}

function sanitizeTelegramLinkMessage(message: string) {
  return sanitizeSupabaseMessage(message)
    .replace(/\b\d{5,20}:[A-Za-z0-9_-]{20,128}\b/g, "[telegram_token_hidden]")
    .replace(/\b(start|link)=[A-Za-z0-9_-]{16,256}\b/gi, "$1=[hidden]")
    .replace(/\/start\s+[A-Za-z0-9_-]{32,128}/gi, "/start [hidden]");
}

function getTelegramLinkMessage(status: TelegramLinkStatus, message: string) {
  if (status === "owner_link_unavailable") {
    return "Owner link needs one active Telegram session for the selected agent. Refresh dashboard status, then reconnect via deploy if it still stays unavailable.";
  }

  return message;
}

async function parseTelegramLinkResponse(response: Response): Promise<TelegramLinkPayload> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as TelegramLinkPayload;
  } catch {
    return {
      message: text,
    };
  }
}

function normalizeTelegramLinkStatus(status: string | undefined): TelegramLinkStatus {
  switch (status) {
    case "link_ready":
    case "not_configured":
    case "invalid_request":
    case "unauthorized":
    case "forbidden":
    case "agent_not_found":
    case "owner_link_unavailable":
    case "rate_limited":
    case "server_error":
      return status;
    default:
      return "function_unavailable";
  }
}

function readTelegramLink(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return /^https:\/\/t\.me\/[A-Za-z0-9_]{5,32}\?start=[A-Za-z0-9_-]{32,128}$/.test(trimmed)
    ? trimmed
    : null;
}

function readExpiresAt(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

export async function issueTelegramOwnerLink({
  session,
  agentId,
}: {
  session: KyraAuthSession;
  agentId: string;
}): Promise<TelegramLinkResult> {
  if (!appConfig.functions.telegramLinkConfigured) {
    return {
      ok: false,
      status: "function_not_configured",
      message: "Telegram owner-link backend is not configured yet.",
      telegramLink: null,
      expiresAt: null,
    };
  }

  try {
    const response = await fetch(appConfig.functions.telegramLinkUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: getSupabaseApiKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ agentId }),
    });
    const payload = await parseTelegramLinkResponse(response);
    const status = normalizeTelegramLinkStatus(payload.status);
    const telegramLink = readTelegramLink(payload.telegramLink);
    const fallbackMessage = response.ok
      ? "Telegram owner-link request completed."
      : `Telegram owner-link request failed with ${response.status}.`;

    return {
      ok: Boolean(payload.ok) && response.ok && Boolean(telegramLink),
      status,
      message: getTelegramLinkMessage(
        status,
        sanitizeTelegramLinkMessage(payload.message ?? fallbackMessage),
      ),
      telegramLink,
      expiresAt: readExpiresAt(payload.expiresAt),
    };
  } catch (error) {
    return {
      ok: false,
      status: "function_unavailable",
      message:
        error instanceof Error
          ? sanitizeTelegramLinkMessage(error.message)
          : "Telegram owner-link backend is unavailable.",
      telegramLink: null,
      expiresAt: null,
    };
  }
}
