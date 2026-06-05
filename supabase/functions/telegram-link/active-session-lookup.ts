import { HttpError } from "../telegram-connect/core.ts";

export interface TelegramLinkActiveSession {
  telegramSessionId: string;
  agentId: string;
  botHandle: string;
}

export interface TelegramLinkActiveSessionRow {
  id?: unknown;
  agent_id?: unknown;
  bot_handle?: unknown;
  webhook_status?: unknown;
}

export interface TelegramLinkActiveSessionLookupResult<T> {
  data: T | null;
  error: unknown;
}

export interface TelegramLinkActiveSessionLookupBuilder {
  select(columns: string): TelegramLinkActiveSessionLookupBuilder;
  eq(column: string, value: string): TelegramLinkActiveSessionLookupBuilder;
  limit<T>(
    count: number,
  ): Promise<TelegramLinkActiveSessionLookupResult<T[]>>;
}

export interface TelegramLinkActiveSessionLookupClient {
  from(table: "telegram_sessions"): TelegramLinkActiveSessionLookupBuilder;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const botHandlePattern = /^@[A-Za-z0-9_]{5,32}$/;

export async function lookupTelegramLinkActiveSession(input: {
  agentId: unknown;
  serviceClient: TelegramLinkActiveSessionLookupClient;
}): Promise<TelegramLinkActiveSession> {
  try {
    const agentId = readUuid(input.agentId);
    const { data, error } = await input.serviceClient
      .from("telegram_sessions")
      .select("id,agent_id,bot_handle,webhook_status")
      .eq("agent_id", agentId)
      .eq("webhook_status", "active")
      .limit<TelegramLinkActiveSessionRow>(2);

    if (error) {
      throw error;
    }

    if (!Array.isArray(data)) {
      throw new Error("Unexpected Telegram active session result.");
    }

    if (!data.length) {
      throw new HttpError(
        409,
        "owner_link_unavailable",
        "Telegram owner-link challenge is unavailable.",
      );
    }

    if (data.length !== 1) {
      throw new Error("Unexpected Telegram active session result.");
    }

    return mapTelegramLinkActiveSession(data[0], agentId);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw sanitizeTelegramLinkActiveSessionLookupError(error);
  }
}

export function sanitizeTelegramLinkActiveSessionLookupError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram active session lookup failed.",
  );
}

function mapTelegramLinkActiveSession(
  value: unknown,
  expectedAgentId: string,
): TelegramLinkActiveSession {
  if (!isPlainRecord(value)) {
    throw new Error("Unexpected Telegram active session row.");
  }

  if (
    Object.keys(value).sort().join(",") !==
      "agent_id,bot_handle,id,webhook_status"
  ) {
    throw new Error("Unexpected Telegram active session row.");
  }

  const telegramSessionId = readUuid(value.id);
  const agentId = readUuid(value.agent_id);
  const botHandle = readBotHandle(value.bot_handle);

  if (agentId !== expectedAgentId || value.webhook_status !== "active") {
    throw new Error("Unexpected Telegram active session row.");
  }

  return {
    telegramSessionId,
    agentId,
    botHandle,
  };
}

function readUuid(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error("Unexpected Telegram active session identifier.");
  }

  return value;
}

function readBotHandle(value: unknown) {
  if (typeof value !== "string" || !botHandlePattern.test(value)) {
    throw new Error("Unexpected Telegram bot handle.");
  }

  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
