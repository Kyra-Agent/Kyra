import { HttpError } from "./core.ts";
import type { TelegramReadOnlyCommandResponse } from "./read-only-response.ts";

export type TelegramResponseDeliveryFetch = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

export interface TelegramResponseDeliveryInput {
  botToken: unknown;
  telegramChatId: unknown;
  response: unknown;
  // In groups the answer is threaded under the member's question.
  replyToMessageId?: unknown;
  // Owner chats only: one button that opens the Kyra Mini App.
  miniAppButton?: unknown;
}

export interface TelegramResponseDeliveryOptions {
  fetch?: TelegramResponseDeliveryFetch;
  timeoutMs?: number;
}

export interface TelegramResponseDeliveryResult {
  delivered: true;
}

const telegramApiBaseUrl = "https://api.telegram.org";
const defaultDeliveryTimeoutMs = 5000;
const botTokenPattern = /^\d{5,20}:[A-Za-z0-9_-]{20,128}$/;
const maxTelegramMessageTextLength = 4096;

export async function deliverTelegramReadOnlyResponse(
  input: TelegramResponseDeliveryInput,
  options: TelegramResponseDeliveryOptions = {},
): Promise<TelegramResponseDeliveryResult> {
  const botToken = assertTelegramDeliveryBotToken(input.botToken);
  const chatId = assertTelegramDeliveryChatId(input.telegramChatId);
  const response = assertTelegramDeliveryResponse(input.response);
  const replyToMessageId = readReplyToMessageId(input.replyToMessageId);
  const miniAppButton = readMiniAppButton(input.miniAppButton);
  const fetchTelegram = options.fetch ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    getTimeoutMs(options.timeoutMs),
  );

  try {
    const fetchResponse = await fetchTelegram(
      `${telegramApiBaseUrl}/bot${botToken}/sendMessage`,
      {
        method: "POST",
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text: response.text,
          disable_web_page_preview: true,
          ...(replyToMessageId
            ? {
              reply_parameters: {
                message_id: replyToMessageId,
                allow_sending_without_reply: true,
              },
            }
            : {}),
          ...(miniAppButton
            ? {
              reply_markup: {
                inline_keyboard: [[{
                  text: miniAppButton.text,
                  web_app: { url: miniAppButton.url },
                }]],
              },
            }
            : {}),
        }),
      },
    );

    if (!fetchResponse.ok) {
      mapTelegramDeliveryFailure(fetchResponse.status);
    }

    let payload: unknown;

    try {
      payload = await fetchResponse.json();
    } catch {
      throwTelegramUnavailable();
    }

    if (!payload || typeof payload !== "object") {
      throwTelegramDeliveryFailed();
    }

    const envelope = payload as Record<string, unknown>;
    const errorCode = typeof envelope.error_code === "number"
      ? envelope.error_code
      : fetchResponse.status;

    if (envelope.ok !== true) {
      mapTelegramDeliveryFailure(errorCode);
    }

    return { delivered: true };
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

export function assertTelegramDeliveryBotToken(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(
      400,
      "invalid_request",
      "Telegram delivery is invalid.",
    );
  }

  const botToken = value.trim();

  if (!botTokenPattern.test(botToken)) {
    throw new HttpError(
      400,
      "invalid_request",
      "Telegram delivery is invalid.",
    );
  }

  return botToken;
}

export function assertTelegramDeliveryChatId(value: unknown) {
  if (typeof value === "number") {
    if (Number.isSafeInteger(value) && value !== 0) {
      return String(value);
    }

    throw invalidTelegramDeliveryTarget();
  }

  if (typeof value !== "string" || !/^-?[0-9]+$/.test(value.trim())) {
    throw invalidTelegramDeliveryTarget();
  }

  const parsed = Number(value.trim());

  if (!Number.isSafeInteger(parsed) || parsed === 0) {
    throw invalidTelegramDeliveryTarget();
  }

  return String(parsed);
}

export function assertTelegramDeliveryResponse(
  value: unknown,
): TelegramReadOnlyCommandResponse {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidTelegramDeliveryResponse();
  }

  const response = value as Record<string, unknown>;
  const keys = Object.keys(response).sort();

  if (keys.join(",") !== "command,text") {
    throw invalidTelegramDeliveryResponse();
  }

  if (
    response.command !== "help" &&
    response.command !== "status" &&
    response.command !== "agent" &&
    response.command !== "actions" &&
    response.command !== "modules" &&
    response.command !== "policy" &&
    response.command !== "forget" &&
    response.command !== "community_on" &&
    response.command !== "community_off" &&
    response.command !== "watch" &&
    response.command !== "unwatch" &&
    response.command !== "watchlist" &&
    response.command !== "alert" &&
    response.command !== "alerts" &&
    response.command !== "alerts_clear" &&
    response.command !== "launches" &&
    response.command !== "swap" &&
    response.command !== "dca" &&
    response.command !== "stoploss" &&
    response.command !== "takeprofit" &&
    response.command !== "rules" &&
    response.command !== "rules_clear" &&
    response.command !== "chat"
  ) {
    throw invalidTelegramDeliveryResponse();
  }

  if (
    typeof response.text !== "string" ||
    !response.text.trim() ||
    response.text.length > maxTelegramMessageTextLength
  ) {
    throw invalidTelegramDeliveryResponse();
  }

  return {
    command: response.command,
    text: response.text,
  };
}

export function sanitizeTelegramResponseDeliveryError(_error: unknown) {
  return new HttpError(
    503,
    "telegram_unavailable",
    "Telegram is unavailable.",
  );
}

function getTimeoutMs(timeoutMs: number | undefined) {
  if (
    !Number.isFinite(timeoutMs) || timeoutMs === undefined || timeoutMs <= 0
  ) {
    return defaultDeliveryTimeoutMs;
  }

  return timeoutMs;
}

function mapTelegramDeliveryFailure(status: number): never {
  if (status === 429) {
    throw new HttpError(
      429,
      "rate_limited",
      "Telegram response delivery is rate limited.",
    );
  }

  if (status >= 500) {
    throwTelegramUnavailable();
  }

  throwTelegramDeliveryFailed();
}

function invalidTelegramDeliveryTarget(): never {
  throw new HttpError(400, "invalid_update", "Telegram update is invalid.");
}

function invalidTelegramDeliveryResponse(): never {
  throw new HttpError(
    500,
    "server_error",
    "Telegram response delivery is invalid.",
  );
}

function throwTelegramDeliveryFailed(): never {
  throw new HttpError(
    422,
    "telegram_delivery_failed",
    "Telegram response could not be delivered.",
  );
}

function throwTelegramUnavailable(): never {
  throw new HttpError(503, "telegram_unavailable", "Telegram is unavailable.");
}

function readReplyToMessageId(value: unknown) {
  const id = typeof value === "string" ? Number(value) : value;

  return typeof id === "number" && Number.isSafeInteger(id) && id > 0 ? id : null;
}

const miniAppHosts = new Set(["kyraagent.xyz", "www.kyraagent.xyz"]);

// Buttons may only open the Kyra Mini App page; anything else is refused
// so a bot message can never carry an arbitrary web app.
export function readMiniAppButton(value: unknown): { text: string; url: string } | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw invalidTelegramDeliveryResponse();
  }
  const button = value as Record<string, unknown>;
  if (
    typeof button.text !== "string" || !button.text.trim() || button.text.length > 64 ||
    typeof button.url !== "string" || button.url.length > 512
  ) {
    throw invalidTelegramDeliveryResponse();
  }
  let url: URL;
  try {
    url = new URL(button.url);
  } catch {
    throw invalidTelegramDeliveryResponse();
  }
  if (url.protocol !== "https:" || !miniAppHosts.has(url.hostname) || url.pathname !== "/tg" || url.username || url.password) {
    throw invalidTelegramDeliveryResponse();
  }
  return { text: button.text.trim(), url: url.toString() };
}
