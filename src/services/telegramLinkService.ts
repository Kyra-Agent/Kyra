import { appConfig } from "../config/appConfig";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey } from "./supabaseRestClient";

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

function getTelegramLinkMessage(status: TelegramLinkStatus) {
  switch (status) {
    case "link_ready":
      return "Secure owner-chat link is ready.";
    case "not_configured":
    case "function_not_configured":
      return "Telegram owner-link backend is not configured yet.";
    case "invalid_request":
      return "Telegram owner-link request is incomplete or invalid.";
    case "unauthorized":
      return "Account session expired. Sign in again before linking Telegram.";
    case "forbidden":
      return "This account cannot link the selected Telegram agent.";
    case "agent_not_found":
      return "The selected deployed agent was not found.";
    case "owner_link_unavailable":
      return "Owner link needs one active Telegram session for the selected agent. Refresh dashboard status, then reconnect via deploy if it stays unavailable.";
    case "rate_limited":
      return "Owner-link requests are temporarily rate limited. Wait briefly and try again.";
    case "server_error":
    case "function_unavailable":
    default:
      return "Telegram owner-link backend is temporarily unavailable.";
  }
}

async function parseTelegramLinkResponse(response: Response): Promise<TelegramLinkPayload> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as TelegramLinkPayload;
  } catch {
    return {};
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

    return {
      ok: Boolean(payload.ok) && response.ok && Boolean(telegramLink),
      status,
      message: getTelegramLinkMessage(status),
      telegramLink,
      expiresAt: readExpiresAt(payload.expiresAt),
    };
  } catch {
    return {
      ok: false,
      status: "function_unavailable",
      message: "Telegram owner-link backend is temporarily unavailable.",
      telegramLink: null,
      expiresAt: null,
    };
  }
}
