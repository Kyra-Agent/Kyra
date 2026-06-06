import { HttpError } from "../telegram-connect/core.ts";
import {
  assertTelegramDisconnectAction,
  type TelegramDisconnectAction,
} from "./core.ts";

export interface TelegramDisconnectClaimResult {
  claimed: true;
  action: TelegramDisconnectAction;
  telegramSessionId: string;
  agentId: string;
  botHandle?: string;
  tokenSecretRef?: string;
  webhookSecretRef?: string;
}

export interface TelegramDisconnectClaimRpcResult {
  data?: unknown;
  error?: unknown | null;
}

export interface TelegramDisconnectClaimRpcClient {
  rpc(
    functionName: "claim_telegram_disconnect_session",
    args: {
      p_agent_id: string;
      p_owner_user_id: string;
      p_action: TelegramDisconnectAction;
    },
  ): Promise<TelegramDisconnectClaimRpcResult> | TelegramDisconnectClaimRpcResult;
}

type TelegramDisconnectClaimFailureStatus =
  | "invalid_request"
  | "invalid_action"
  | "not_found"
  | "forbidden"
  | "conflict"
  | "missing_secret_ref";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const botHandlePattern = /^@[A-Za-z0-9_]{5,32}$/;
const tokenSecretRefPattern = /^[A-Za-z0-9][A-Za-z0-9:_-]{15,255}$/;
const webhookSecretRefPattern =
  /^webhook:telegram:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export async function claimTelegramDisconnectSession(input: {
  agentId: unknown;
  ownerUserId: unknown;
  action: unknown;
  rpcClient: TelegramDisconnectClaimRpcClient;
}): Promise<TelegramDisconnectClaimResult> {
  const agentId = readInputUuid(input.agentId);
  const ownerUserId = readInputUuid(input.ownerUserId);
  const action = assertTelegramDisconnectAction(input.action);

  try {
    const result = await input.rpcClient.rpc(
      "claim_telegram_disconnect_session",
      {
        p_agent_id: agentId,
        p_owner_user_id: ownerUserId,
        p_action: action,
      },
    );

    return assertTelegramDisconnectClaimRpcResult(result, action);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw sanitizeTelegramDisconnectClaimRpcError(error);
  }
}

export function assertTelegramDisconnectClaimRpcResult(
  result: TelegramDisconnectClaimRpcResult,
  action: TelegramDisconnectAction,
): TelegramDisconnectClaimResult {
  if (result.error) {
    throw sanitizeTelegramDisconnectClaimRpcError(result.error);
  }

  return assertTelegramDisconnectClaimRows(result.data, action);
}

export function assertTelegramDisconnectClaimRows(
  rows: unknown,
  action: TelegramDisconnectAction,
): TelegramDisconnectClaimResult {
  if (!Array.isArray(rows) || rows.length !== 1) {
    throw sanitizeTelegramDisconnectClaimValidationError(
      new Error("Unexpected Telegram disconnect claim rows."),
    );
  }

  return assertTelegramDisconnectClaimRow(rows[0], action);
}

export function assertTelegramDisconnectClaimRow(
  value: unknown,
  action: TelegramDisconnectAction,
): TelegramDisconnectClaimResult {
  try {
    if (!isPlainRecord(value)) {
      throw new Error("Unexpected Telegram disconnect claim row.");
    }

    const keys = Object.keys(value).sort().join(",");

    if (
      keys !==
        "agent_id,bot_handle,claimed,status,telegram_session_id,token_secret_ref,webhook_secret_ref"
    ) {
      throw new Error("Unexpected Telegram disconnect claim row.");
    }

    if (value.claimed !== true) {
      throw claimFailureToHttpError(value.status);
    }

    if (value.status !== "claimed") {
      throw new Error("Unexpected Telegram disconnect claim status.");
    }

    const telegramSessionId = readRpcUuid(value.telegram_session_id);
    const agentId = readRpcUuid(value.agent_id);
    const botHandle = readOptionalBotHandle(value.bot_handle);

    if (action === "pause") {
      if (value.token_secret_ref !== null || value.webhook_secret_ref !== null) {
        throw new Error("Pause claim returned secret refs.");
      }

      return {
        claimed: true,
        action,
        telegramSessionId,
        agentId,
        ...(botHandle ? { botHandle } : {}),
      };
    }

    const tokenSecretRef = readTokenSecretRef(value.token_secret_ref);
    const webhookSecretRef = readWebhookSecretRef(value.webhook_secret_ref);

    return {
      claimed: true,
      action,
      telegramSessionId,
      agentId,
      ...(botHandle ? { botHandle } : {}),
      tokenSecretRef,
      webhookSecretRef,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw sanitizeTelegramDisconnectClaimValidationError(error);
  }
}

export function sanitizeTelegramDisconnectClaimRpcError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram disconnect session claim failed.",
  );
}

export function sanitizeTelegramDisconnectClaimValidationError(
  _error: unknown,
) {
  return new HttpError(
    500,
    "server_error",
    "Telegram disconnect session claim validation failed.",
  );
}

function claimFailureToHttpError(status: unknown) {
  switch (status as TelegramDisconnectClaimFailureStatus) {
    case "invalid_request":
    case "invalid_action":
      return new HttpError(
        400,
        "invalid_request",
        "Telegram disconnect request is invalid.",
      );
    case "not_found":
      return new HttpError(
        404,
        "telegram_session_not_found",
        "Telegram session was not found.",
      );
    case "forbidden":
      return new HttpError(
        403,
        "forbidden",
        "Telegram disconnect is not allowed for this agent.",
      );
    case "conflict":
      return new HttpError(
        409,
        "telegram_session_conflict",
        "Telegram disconnect session state is inconsistent.",
      );
    case "missing_secret_ref":
      return new HttpError(
        409,
        "telegram_disconnect_unavailable",
        "Telegram disconnect is unavailable for this session.",
      );
    default:
      return sanitizeTelegramDisconnectClaimValidationError(
        new Error("Unexpected Telegram disconnect claim status."),
      );
  }
}

function readInputUuid(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value.trim())) {
    throw new HttpError(
      400,
      "invalid_request",
      "Telegram disconnect request is invalid.",
    );
  }

  return value.trim();
}

function readRpcUuid(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value.trim())) {
    throw new Error("Unexpected Telegram disconnect claim identifier.");
  }

  return value.trim();
}

function readOptionalBotHandle(value: unknown) {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value !== "string" || !botHandlePattern.test(value.trim())) {
    throw new Error("Unexpected Telegram bot handle.");
  }

  return value.trim();
}

function readTokenSecretRef(value: unknown) {
  if (typeof value !== "string" || !tokenSecretRefPattern.test(value.trim())) {
    throw new Error("Unexpected token secret ref.");
  }

  return value.trim();
}

function readWebhookSecretRef(value: unknown) {
  if (
    typeof value !== "string" ||
    !webhookSecretRefPattern.test(value.trim())
  ) {
    throw new Error("Unexpected webhook secret ref.");
  }

  return value.trim();
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
