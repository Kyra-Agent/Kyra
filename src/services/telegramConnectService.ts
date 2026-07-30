import { appConfig } from "../config/appConfig";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey } from "./supabaseRestClient";

export type TelegramConnectStatus =
  | "validated"
  | "review"
  | "queued"
  | "active"
  | "not_configured"
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "agent_not_found"
  | "telegram_validation_failed"
  | "secret_store_unavailable"
  | "duplicate_bot_active"
  | "webhook_registration_failed"
  | "server_error"
  | "function_unavailable"
  | "function_not_configured";

interface TelegramConnectPayload {
  ok?: boolean;
  status?: string;
  message?: string;
  botHandle?: string;
  webhookStatus?: string;
}

export interface TelegramConnectResult {
  ok: boolean;
  status: TelegramConnectStatus;
  message: string;
  botHandle: string | null;
  webhookStatus: "queued" | "active" | null;
}


async function parseTelegramConnectResponse(response: Response): Promise<TelegramConnectPayload> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as TelegramConnectPayload;
  } catch {
    return {};
  }
}

function normalizeTelegramConnectStatus(status: string | undefined): TelegramConnectStatus {
  switch (status) {
    case "validated":
    case "review":
    case "queued":
    case "active":
    case "not_configured":
    case "invalid_request":
    case "unauthorized":
    case "forbidden":
    case "agent_not_found":
    case "telegram_validation_failed":
    case "secret_store_unavailable":
    case "duplicate_bot_active":
    case "webhook_registration_failed":
    case "server_error":
      return status;
    default:
      return "function_unavailable";
  }
}


function getTelegramConnectMessage(status: TelegramConnectStatus) {
  switch (status) {
    case "validated":
      return "Telegram bot token validated.";
    case "review":
    case "queued":
      return "Telegram connection is pending backend activation.";
    case "active":
      return "Telegram connection is active.";
    case "not_configured":
    case "function_not_configured":
      return "Telegram connect backend is not configured yet.";
    case "invalid_request":
      return "Telegram connection request is incomplete or invalid.";
    case "unauthorized":
      return "Account session expired. Sign in again before connecting Telegram.";
    case "forbidden":
      return "This account cannot connect Telegram for the selected agent.";
    case "agent_not_found":
      return "The selected deployed agent was not found.";
    case "telegram_validation_failed":
      return "Telegram could not validate this bot token. Check the token and try again.";
    case "secret_store_unavailable":
      return "Telegram credential storage is temporarily unavailable.";
    case "duplicate_bot_active":
      return "This Telegram bot is already connected to another active agent.";
    case "webhook_registration_failed":
      return "Telegram webhook activation failed safely. No live command access was enabled.";
    case "server_error":
    case "function_unavailable":
    default:
      return "Telegram connect backend is temporarily unavailable.";
  }
}
function readTelegramBotHandle(value: unknown) {
  return typeof value === "string" && /^@[A-Za-z0-9_]{5,32}$/.test(value)
    ? value
    : null;
}

function readTelegramWebhookStatus(value: unknown) {
  return value === "queued" || value === "active" ? value : null;
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
      botHandle: null,
      webhookStatus: null,
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

    return {
      ok: Boolean(payload.ok) && response.ok,
      status,
      message: getTelegramConnectMessage(status),
      botHandle: readTelegramBotHandle(payload.botHandle),
      webhookStatus: readTelegramWebhookStatus(payload.webhookStatus),
    };
  } catch {
    return {
      ok: false,
      status: "function_unavailable",
      message: "Telegram connect backend is temporarily unavailable.",
      botHandle: null,
      webhookStatus: null,
    };
  }
}

export async function validateTelegramBotTokenForDeploy({
  session,
  botToken,
}: {
  session: KyraAuthSession;
  botToken: string;
}): Promise<TelegramConnectResult> {
  if (!appConfig.functions.telegramConnectConfigured) {
    return {
      ok: false,
      status: "function_not_configured",
      message: "Telegram connect backend is not configured yet.",
      botHandle: null,
      webhookStatus: null,
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
        mode: "validate_token",
        botToken,
      }),
    });
    const payload = await parseTelegramConnectResponse(response);
    const status = normalizeTelegramConnectStatus(payload.status);

    return {
      ok: Boolean(payload.ok) && response.ok && status === "validated",
      status,
      message: getTelegramConnectMessage(status),
      botHandle: readTelegramBotHandle(payload.botHandle),
      webhookStatus: readTelegramWebhookStatus(payload.webhookStatus),
    };
  } catch {
    return {
      ok: false,
      status: "function_unavailable",
      message: "Telegram connect backend is temporarily unavailable.",
      botHandle: null,
      webhookStatus: null,
    };
  }
}
