import { HttpError } from "./core.ts";

export interface TelegramUpdateClaimResult {
  claimed: boolean;
  status: "claimed" | "duplicate";
}

export interface TelegramUpdateClaimRpcResult {
  data?: unknown;
  error?: unknown | null;
}

export interface TelegramUpdateClaimRpcClient {
  rpc(
    functionName: "claim_telegram_update",
    args: {
      p_telegram_session_id: string;
      p_telegram_update_id: number;
    },
  ): Promise<TelegramUpdateClaimRpcResult> | TelegramUpdateClaimRpcResult;
}

export async function claimTelegramUpdate(input: {
  telegramSessionId: unknown;
  telegramUpdateId: unknown;
  rpcClient: TelegramUpdateClaimRpcClient;
}): Promise<TelegramUpdateClaimResult> {
  try {
    const result = await input.rpcClient.rpc("claim_telegram_update", {
      p_telegram_session_id: readClaimSessionId(input.telegramSessionId),
      p_telegram_update_id: readClaimUpdateId(input.telegramUpdateId),
    });

    return assertTelegramUpdateClaimRpcResult(result);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw sanitizeTelegramUpdateClaimRpcError(error);
  }
}

export function assertTelegramUpdateClaimRpcResult(
  result: TelegramUpdateClaimRpcResult,
): TelegramUpdateClaimResult {
  if (result.error) {
    throw sanitizeTelegramUpdateClaimRpcError(result.error);
  }

  return assertTelegramUpdateClaimRows(result.data);
}

export function assertTelegramUpdateClaimRows(
  rows: unknown,
): TelegramUpdateClaimResult {
  if (!Array.isArray(rows)) {
    throw sanitizeTelegramUpdateClaimRpcError(
      new Error("Unexpected Telegram update claim rows."),
    );
  }

  if (!rows.length) {
    throw new HttpError(
      404,
      "session_not_found",
      "Telegram webhook session was not found.",
    );
  }

  if (rows.length > 1) {
    throw sanitizeTelegramUpdateClaimRpcError(
      new Error("Unexpected Telegram update claim rows."),
    );
  }

  return assertTelegramUpdateClaimResult(rows[0]);
}

export function assertTelegramUpdateClaimResult(
  value: unknown,
): TelegramUpdateClaimResult {
  try {
    if (!isPlainRecord(value)) {
      throw new Error("Unexpected Telegram update claim result.");
    }

    const keys = Object.keys(value).sort();

    if (keys.join(",") !== "claimed,status") {
      throw new Error("Unexpected Telegram update claim result.");
    }

    if (value.claimed === true && value.status === "claimed") {
      return { claimed: true, status: "claimed" };
    }

    if (value.claimed === false && value.status === "duplicate") {
      return { claimed: false, status: "duplicate" };
    }

    throw new Error("Unexpected Telegram update claim result.");
  } catch (error) {
    throw sanitizeTelegramUpdateClaimError(error);
  }
}

export function shouldProcessTelegramUpdateClaim(value: unknown) {
  return assertTelegramUpdateClaimResult(value).claimed;
}

export function sanitizeTelegramUpdateClaimError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram update claim validation failed.",
  );
}

export function sanitizeTelegramUpdateClaimRpcError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram update claim failed.",
  );
}

function readClaimSessionId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw sanitizeTelegramUpdateClaimRpcError(
      new Error("Missing Telegram session id."),
    );
  }

  return value.trim();
}

function readClaimUpdateId(value: unknown) {
  if (typeof value === "number") {
    if (Number.isSafeInteger(value) && value >= 0) {
      return value;
    }

    throw invalidTelegramUpdateId();
  }

  if (typeof value !== "string" || !/^[0-9]+$/.test(value.trim())) {
    throw invalidTelegramUpdateId();
  }

  const parsed = Number(value.trim());

  if (!Number.isSafeInteger(parsed)) {
    throw invalidTelegramUpdateId();
  }

  return parsed;
}

function invalidTelegramUpdateId() {
  return new HttpError(
    400,
    "invalid_update",
    "Telegram update is invalid.",
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
