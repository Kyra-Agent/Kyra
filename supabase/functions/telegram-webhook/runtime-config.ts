export const telegramWebhookLookupEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_LOOKUP_ENABLED";

export type OptionalEnvReader = (key: string) => string;

export type TelegramWebhookLookupRuntimeConfig =
  | { enabled: false }
  | { enabled: true };

export function isTelegramWebhookLookupEnabled(value: unknown) {
  return value === "true";
}

export function createTelegramWebhookLookupRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): TelegramWebhookLookupRuntimeConfig {
  const enabled = isTelegramWebhookLookupEnabled(
    readOptionalEnv(telegramWebhookLookupEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  return { enabled: true };
}
