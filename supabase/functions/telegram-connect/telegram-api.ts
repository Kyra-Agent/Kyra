import { HttpError, type TelegramBotValidationResult } from "./core.ts";

export type TelegramFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface TelegramGetMeOptions {
  fetch?: TelegramFetch;
  timeoutMs?: number;
}

const telegramApiBaseUrl = "https://api.telegram.org";
const defaultGetMeTimeoutMs = 5000;
const validationFailedMessage = "Telegram bot token could not be validated.";
const unavailableMessage = "Telegram is unavailable.";

function getTimeoutMs(timeoutMs: number | undefined) {
  if (
    !Number.isFinite(timeoutMs) || timeoutMs === undefined || timeoutMs <= 0
  ) {
    return defaultGetMeTimeoutMs;
  }

  return timeoutMs;
}

function throwValidationFailed(): never {
  throw new HttpError(
    422,
    "telegram_validation_failed",
    validationFailedMessage,
  );
}

function throwTelegramUnavailable(): never {
  throw new HttpError(503, "telegram_unavailable", unavailableMessage);
}

function throwRateLimited(): never {
  throw new HttpError(
    429,
    "rate_limited",
    "Telegram validation is rate limited.",
  );
}

function normalizeTelegramBotResult(
  result: unknown,
): TelegramBotValidationResult {
  if (!result || typeof result !== "object") {
    throwValidationFailed();
  }

  const payload = result as Record<string, unknown>;
  const telegramBotId =
    typeof payload.id === "number" && Number.isFinite(payload.id)
      ? String(Math.trunc(payload.id))
      : typeof payload.id === "string"
      ? payload.id.trim()
      : "";
  const username = typeof payload.username === "string"
    ? payload.username.trim()
    : "";
  const firstName = typeof payload.first_name === "string"
    ? payload.first_name.trim()
    : "";

  if (payload.is_bot === false || !telegramBotId || !username || !firstName) {
    throwValidationFailed();
  }

  return {
    telegramBotId,
    username,
    firstName,
    canJoinGroups: typeof payload.can_join_groups === "boolean"
      ? payload.can_join_groups
      : undefined,
    canReadAllGroupMessages:
      typeof payload.can_read_all_group_messages === "boolean"
        ? payload.can_read_all_group_messages
        : undefined,
  };
}

function mapTelegramFailure(status: number): never {
  if (status === 429) {
    throwRateLimited();
  }

  if (status === 401 || status === 404) {
    throwValidationFailed();
  }

  if (status >= 500) {
    throwTelegramUnavailable();
  }

  throwValidationFailed();
}

export async function validateTelegramBotTokenWithGetMe(
  botToken: string,
  options: TelegramGetMeOptions = {},
): Promise<TelegramBotValidationResult> {
  const fetchTelegram = options.fetch ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    getTimeoutMs(options.timeoutMs),
  );
  const getMeUrl = `${telegramApiBaseUrl}/bot${botToken}/getMe`;

  try {
    const response = await fetchTelegram(getMeUrl, {
      method: "GET",
      signal: controller.signal,
    });

    if (!response.ok) {
      mapTelegramFailure(response.status);
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throwTelegramUnavailable();
    }

    if (!payload || typeof payload !== "object") {
      throwValidationFailed();
    }

    const envelope = payload as Record<string, unknown>;
    const errorCode = typeof envelope.error_code === "number"
      ? envelope.error_code
      : response.status;

    if (envelope.ok !== true) {
      mapTelegramFailure(errorCode);
    }

    return normalizeTelegramBotResult(envelope.result);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throwTelegramUnavailable();
    }

    throwTelegramUnavailable();
  } finally {
    clearTimeout(timeoutId);
  }
}
