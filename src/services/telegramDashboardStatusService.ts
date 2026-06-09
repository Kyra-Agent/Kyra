import { appConfig } from "../config/appConfig";
import type { DemoTelegramWebhookStatus } from "../types/backend";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey, sanitizeSupabaseMessage } from "./supabaseRestClient";

export type TelegramDashboardStatusCode =
  | "ready"
  | "not_configured"
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "agent_not_found"
  | "server_error"
  | "function_unavailable"
  | "function_not_configured";

export interface TelegramDashboardStatusRecord {
  agentId: string;
  botHandle: string | null;
  webhookStatus: DemoTelegramWebhookStatus;
  ownerChatLinked: boolean;
  ownerLinkAvailable: boolean;
  lastEventAt: string | null;
}

interface TelegramDashboardStatusPayload {
  ok?: boolean;
  status?: string;
  message?: string;
  telegramStatuses?: unknown;
}

export interface TelegramDashboardStatusResult {
  ok: boolean;
  status: TelegramDashboardStatusCode;
  message: string;
  telegramStatuses: TelegramDashboardStatusRecord[];
}

async function parseTelegramDashboardStatusResponse(
  response: Response,
): Promise<TelegramDashboardStatusPayload> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as TelegramDashboardStatusPayload;
  } catch {
    return {
      message: text,
    };
  }
}

function normalizeTelegramDashboardStatusCode(
  status: string | undefined,
): TelegramDashboardStatusCode {
  switch (status) {
    case "ready":
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

function readTelegramDashboardStatusRecord(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (
    typeof record.agentId !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      record.agentId,
    )
  ) {
    return null;
  }

  if (
    record.botHandle !== null &&
    (typeof record.botHandle !== "string" || !/^@[A-Za-z0-9_]{5,32}$/.test(record.botHandle))
  ) {
    return null;
  }

  if (
    record.webhookStatus !== "mocked" &&
    record.webhookStatus !== "queued" &&
    record.webhookStatus !== "active" &&
    record.webhookStatus !== "paused"
  ) {
    return null;
  }

  if (
    typeof record.ownerChatLinked !== "boolean" ||
    typeof record.ownerLinkAvailable !== "boolean"
  ) {
    return null;
  }

  if (record.lastEventAt !== null) {
    if (typeof record.lastEventAt !== "string") {
      return null;
    }

    const timestamp = Date.parse(record.lastEventAt);

    if (!Number.isFinite(timestamp)) {
      return null;
    }
  }

  return {
    agentId: record.agentId,
    botHandle: record.botHandle,
    webhookStatus: record.webhookStatus,
    ownerChatLinked: record.ownerChatLinked,
    ownerLinkAvailable: record.ownerLinkAvailable,
    lastEventAt:
      typeof record.lastEventAt === "string"
        ? new Date(record.lastEventAt).toISOString()
        : null,
  } satisfies TelegramDashboardStatusRecord;
}

function readTelegramDashboardStatuses(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const records = value.map(readTelegramDashboardStatusRecord);

  if (records.some((record) => record === null)) {
    return null;
  }

  return records as TelegramDashboardStatusRecord[];
}

function sanitizeTelegramDashboardStatusMessage(message: string) {
  return sanitizeSupabaseMessage(message)
    .replace(/\b\d{5,20}:[A-Za-z0-9_-]{20,128}\b/g, "[telegram_token_hidden]")
    .replace(/\b(start|link)=[A-Za-z0-9_-]{16,256}\b/gi, "$1=[hidden]")
    .replace(/\/start\s+[A-Za-z0-9_-]{32,128}/gi, "/start [hidden]");
}

export async function fetchTelegramDashboardStatuses({
  session,
  agentIds,
}: {
  session: KyraAuthSession;
  agentIds: string[];
}): Promise<TelegramDashboardStatusResult> {
  if (
    !appConfig.featureFlags.telegramDashboardStatusReadModel ||
    !appConfig.functions.telegramDashboardStatusConfigured
  ) {
    return {
      ok: false,
      status: "function_not_configured",
      message: "Telegram dashboard status read model is not enabled.",
      telegramStatuses: [],
    };
  }

  if (agentIds.length === 0) {
    return {
      ok: true,
      status: "ready",
      message: "No deployed agents require Telegram status lookup.",
      telegramStatuses: [],
    };
  }

  try {
    const response = await fetch(appConfig.functions.telegramDashboardStatusUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: getSupabaseApiKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ agentIds }),
    });
    const payload = await parseTelegramDashboardStatusResponse(response);
    const status = normalizeTelegramDashboardStatusCode(payload.status);
    const telegramStatuses = readTelegramDashboardStatuses(payload.telegramStatuses);
    const fallbackMessage = response.ok
      ? "Telegram dashboard status loaded."
      : `Telegram dashboard status failed with ${response.status}.`;

    if (!response.ok || payload.ok !== true || !telegramStatuses) {
      return {
        ok: false,
        status,
        message: sanitizeTelegramDashboardStatusMessage(payload.message ?? fallbackMessage),
        telegramStatuses: [],
      };
    }

    return {
      ok: true,
      status,
      message: sanitizeTelegramDashboardStatusMessage(payload.message ?? fallbackMessage),
      telegramStatuses,
    };
  } catch (error) {
    return {
      ok: false,
      status: "function_unavailable",
      message:
        error instanceof Error
          ? sanitizeTelegramDashboardStatusMessage(error.message)
          : "Telegram dashboard status backend is unavailable.",
      telegramStatuses: [],
    };
  }
}
