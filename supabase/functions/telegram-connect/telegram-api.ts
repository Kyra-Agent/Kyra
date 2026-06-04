import {
  assertBotToken,
  HttpError,
  type TelegramBotValidationResult,
} from "./core.ts";

export type TelegramFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface TelegramGetMeOptions {
  fetch?: TelegramFetch;
  timeoutMs?: number;
}

export interface TelegramSetWebhookInput {
  botToken: string;
  webhookUrl: string;
  webhookSecretToken: string;
}

export interface TelegramSetWebhookResult {
  registered: true;
}

export interface TelegramSetWebhookOptions {
  fetch?: TelegramFetch;
  timeoutMs?: number;
}

const telegramApiBaseUrl = "https://api.telegram.org";
const defaultGetMeTimeoutMs = 5000;
const defaultSetWebhookTimeoutMs = 5000;
const webhookSecretTokenPattern = /^[A-Za-z0-9_-]{32,256}$/;
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

function throwWebhookRegistrationFailed(): never {
  throw new HttpError(
    422,
    "telegram_validation_failed",
    "Telegram webhook could not be registered.",
  );
}

function throwWebhookRateLimited(): never {
  throw new HttpError(
    429,
    "rate_limited",
    "Telegram webhook registration is rate limited.",
  );
}

function assertWebhookUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "invalid_request", "webhookUrl is required.");
  }

  const rawUrl = value.trim();

  if (rawUrl.length > 2048) {
    throw new HttpError(400, "invalid_request", "webhookUrl is invalid.");
  }

  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new HttpError(400, "invalid_request", "webhookUrl is invalid.");
  }

  if (
    parsedUrl.protocol !== "https:" ||
    !parsedUrl.hostname ||
    parsedUrl.username ||
    parsedUrl.password ||
    parsedUrl.hash
  ) {
    throw new HttpError(400, "invalid_request", "webhookUrl is invalid.");
  }

  return parsedUrl.toString();
}

function assertWebhookSecretToken(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(
      400,
      "invalid_request",
      "webhookSecretToken is required.",
    );
  }

  const secretToken = value.trim();

  if (!webhookSecretTokenPattern.test(secretToken)) {
    throw new HttpError(
      400,
      "invalid_request",
      "webhookSecretToken is invalid.",
    );
  }

  return secretToken;
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

function mapSetWebhookFailure(status: number): never {
  if (status === 429) {
    throwWebhookRateLimited();
  }

  if (status === 401 || status === 404) {
    throwWebhookRegistrationFailed();
  }

  if (status >= 500) {
    throwTelegramUnavailable();
  }

  throwWebhookRegistrationFailed();
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

export async function registerTelegramWebhookWithSetWebhook(
  input: TelegramSetWebhookInput,
  options: TelegramSetWebhookOptions = {},
): Promise<TelegramSetWebhookResult> {
  const botToken = assertBotToken(input.botToken);
  const webhookUrl = assertWebhookUrl(input.webhookUrl);
  const webhookSecretToken = assertWebhookSecretToken(
    input.webhookSecretToken,
  );
  const fetchTelegram = options.fetch ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    getTimeoutMs(options.timeoutMs ?? defaultSetWebhookTimeoutMs),
  );
  const setWebhookUrl = `${telegramApiBaseUrl}/bot${botToken}/setWebhook`;

  try {
    const response = await fetchTelegram(setWebhookUrl, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        url: webhookUrl,
        secret_token: webhookSecretToken,
        allowed_updates: ["message", "callback_query"],
        drop_pending_updates: false,
      }),
    });

    if (!response.ok) {
      mapSetWebhookFailure(response.status);
    }

    let payload: unknown;

    try {
      payload = await response.json();
    } catch {
      throwTelegramUnavailable();
    }

    if (!payload || typeof payload !== "object") {
      throwWebhookRegistrationFailed();
    }

    const envelope = payload as Record<string, unknown>;
    const errorCode = typeof envelope.error_code === "number"
      ? envelope.error_code
      : response.status;

    if (envelope.ok !== true || envelope.result !== true) {
      mapSetWebhookFailure(errorCode);
    }

    return { registered: true };
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
