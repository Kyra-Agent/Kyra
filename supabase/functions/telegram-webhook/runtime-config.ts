export const telegramWebhookLookupEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_LOOKUP_ENABLED";
export const telegramWebhookParseEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_PARSE_ENABLED";

export type OptionalEnvReader = (key: string) => string;

export type TelegramWebhookLookupRuntimeConfig =
  | { enabled: false }
  | { enabled: true };
export type TelegramWebhookParseRuntimeConfig =
  | { enabled: false }
  | { enabled: true };

export function isTelegramWebhookLookupEnabled(value: unknown) {
  return value === "true";
}

export function isTelegramWebhookParseEnabled(value: unknown) {
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

export function createTelegramWebhookParseRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): TelegramWebhookParseRuntimeConfig {
  const enabled = isTelegramWebhookParseEnabled(
    readOptionalEnv(telegramWebhookParseEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  return { enabled: true };
}
