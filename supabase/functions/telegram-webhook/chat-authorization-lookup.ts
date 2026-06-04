import {
  HttpError,
  type TelegramWebhookChatAuthorization,
  type TelegramWebhookCommandKind,
} from "./core.ts";

export interface TelegramChatAuthorizationLookupRpcRow {
  authorized?: unknown;
  role?: unknown;
}

export interface TelegramChatAuthorizationLookupRpcResult {
  data?: unknown;
  error?: unknown | null;
}

export interface TelegramChatAuthorizationLookupRpcClient {
  rpc(
    functionName: "resolve_telegram_chat_authorization",
    args: {
      p_agent_id: string;
      p_telegram_user_id: string;
      p_telegram_chat_id: string;
      p_command_kind: TelegramWebhookCommandKind;
    },
  ):
    | Promise<TelegramChatAuthorizationLookupRpcResult>
    | TelegramChatAuthorizationLookupRpcResult;
}

export async function lookupTelegramChatAuthorization(input: {
  agentId: unknown;
  telegramUserId: unknown;
  telegramChatId: unknown;
  commandKind: unknown;
  rpcClient: TelegramChatAuthorizationLookupRpcClient;
}): Promise<TelegramWebhookChatAuthorization> {
  try {
    const result = await input.rpcClient.rpc(
      "resolve_telegram_chat_authorization",
      {
        p_agent_id: readLookupString(input.agentId),
        p_telegram_user_id: readLookupString(input.telegramUserId),
        p_telegram_chat_id: readLookupString(input.telegramChatId),
        p_command_kind: readCommandKind(input.commandKind),
      },
    );

    return assertTelegramChatAuthorizationLookupResult(result);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw sanitizeTelegramChatAuthorizationLookupError(error);
  }
}

export function assertTelegramChatAuthorizationLookupResult(
  result: TelegramChatAuthorizationLookupRpcResult,
): TelegramWebhookChatAuthorization {
  if (result.error) {
    throw sanitizeTelegramChatAuthorizationLookupError(result.error);
  }

  return assertTelegramChatAuthorizationLookupRows(result.data);
}

export function assertTelegramChatAuthorizationLookupRows(
  rows: unknown,
): TelegramWebhookChatAuthorization {
  if (rows === null || rows === undefined) {
    throwUnauthorizedChat();
  }

  if (!Array.isArray(rows)) {
    throw sanitizeTelegramChatAuthorizationLookupError(
      new Error("Unexpected Telegram chat authorization lookup result."),
    );
  }

  if (!rows.length) {
    throwUnauthorizedChat();
  }

  if (rows.length > 1) {
    throw sanitizeTelegramChatAuthorizationLookupError(
      new Error("Unexpected Telegram chat authorization lookup result."),
    );
  }

  return mapTelegramChatAuthorizationRow(rows[0]);
}

export function sanitizeTelegramChatAuthorizationLookupError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram chat authorization lookup failed.",
  );
}

function mapTelegramChatAuthorizationRow(
  row: TelegramChatAuthorizationLookupRpcRow | undefined,
): TelegramWebhookChatAuthorization {
  try {
    if (!row || row.authorized !== true) {
      throwUnauthorizedChat();
    }

    if (row.role !== "owner") {
      throw new Error("Unexpected Telegram chat authorization role.");
    }

    return { authorized: true, role: "owner" };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw sanitizeTelegramChatAuthorizationLookupError(error);
  }
}

function readLookupString(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw sanitizeTelegramChatAuthorizationLookupError(
      new Error("Missing Telegram chat authorization lookup input."),
    );
  }

  return value.trim();
}

function readCommandKind(value: unknown): TelegramWebhookCommandKind {
  if (
    value !== "read_only" &&
    value !== "write" &&
    value !== "approval"
  ) {
    throw new HttpError(
      400,
      "invalid_update",
      "Telegram update is invalid.",
    );
  }

  return value;
}

function throwUnauthorizedChat(): never {
  throw new HttpError(
    403,
    "chat_not_authorized",
    "Telegram chat is not authorized.",
  );
}
