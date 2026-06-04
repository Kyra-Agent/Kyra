import {
  HttpError,
  isTelegramConnectWebhookRegisterEnabled,
  telegramConnectWebhookRegisterEnabledEnvKey,
} from "./core.ts";

export const telegramWebhookUrlEnvKey = "KYRA_TELEGRAM_WEBHOOK_URL";

export type OptionalEnvReader = (key: string) => string;

export type TelegramWebhookRegistrationRuntimeConfig =
  | { enabled: false }
  | {
    enabled: true;
    getTelegramWebhookUrl: () => string;
    generateTelegramWebhookSecret: () => string;
  };

export function getTelegramWebhookUrl(readOptionalEnv: OptionalEnvReader) {
  const webhookUrl = readOptionalEnv(telegramWebhookUrlEnvKey).trim();

  if (!webhookUrl) {
    throw new HttpError(
      500,
      "missing_env",
      "Telegram webhook URL is not configured.",
    );
  }

  return webhookUrl;
}

export function generateTelegramWebhookSecret() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);

  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function createTelegramWebhookRegistrationRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): TelegramWebhookRegistrationRuntimeConfig {
  const enabled = isTelegramConnectWebhookRegisterEnabled(
    readOptionalEnv(telegramConnectWebhookRegisterEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  return {
    enabled: true,
    getTelegramWebhookUrl: () => getTelegramWebhookUrl(readOptionalEnv),
    generateTelegramWebhookSecret,
  };
}
