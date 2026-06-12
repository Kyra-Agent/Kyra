export const telegramWebhookLookupEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_LOOKUP_ENABLED";
export const telegramWebhookParseEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_PARSE_ENABLED";
export const telegramWebhookChatAuthEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_CHAT_AUTH_ENABLED";
export const telegramWebhookClaimEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_CLAIM_ENABLED";
export const telegramWebhookDeliveryEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_DELIVERY_ENABLED";
export const telegramWebhookOwnerLinkConsumeEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_OWNER_LINK_CONSUME_ENABLED";
export const telegramWebhookTemplateContextEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_TEMPLATE_CONTEXT_ENABLED";
export const telegramWebhookAgentBrainEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_AGENT_BRAIN_ENABLED";

export type OptionalEnvReader = (key: string) => string;

export type TelegramWebhookLookupRuntimeConfig =
  | { enabled: false }
  | { enabled: true };
export type TelegramWebhookParseRuntimeConfig =
  | { enabled: false }
  | { enabled: true };
export type TelegramWebhookChatAuthRuntimeConfig =
  | { enabled: false }
  | { enabled: true };
export type TelegramWebhookClaimRuntimeConfig =
  | { enabled: false }
  | { enabled: true };
export type TelegramWebhookDeliveryRuntimeConfig =
  | { enabled: false }
  | { enabled: true };
export type TelegramWebhookOwnerLinkConsumeRuntimeConfig =
  | { enabled: false }
  | { enabled: true };
export type TelegramWebhookTemplateContextRuntimeConfig =
  | { enabled: false }
  | { enabled: true };
export type TelegramWebhookAgentBrainRuntimeConfig =
  | { enabled: false }
  | { enabled: true };

export function isTelegramWebhookLookupEnabled(value: unknown) {
  return value === "true";
}

export function isTelegramWebhookParseEnabled(value: unknown) {
  return value === "true";
}

export function isTelegramWebhookChatAuthEnabled(value: unknown) {
  return value === "true";
}

export function isTelegramWebhookClaimEnabled(value: unknown) {
  return value === "true";
}

export function isTelegramWebhookDeliveryEnabled(value: unknown) {
  return value === "true";
}

export function isTelegramWebhookOwnerLinkConsumeEnabled(value: unknown) {
  return value === "true";
}

export function isTelegramWebhookTemplateContextEnabled(value: unknown) {
  return value === "true";
}

export function isTelegramWebhookAgentBrainEnabled(value: unknown) {
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

export function createTelegramWebhookChatAuthRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): TelegramWebhookChatAuthRuntimeConfig {
  const enabled = isTelegramWebhookChatAuthEnabled(
    readOptionalEnv(telegramWebhookChatAuthEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  return { enabled: true };
}

export function createTelegramWebhookClaimRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): TelegramWebhookClaimRuntimeConfig {
  const enabled = isTelegramWebhookClaimEnabled(
    readOptionalEnv(telegramWebhookClaimEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  return { enabled: true };
}

export function createTelegramWebhookDeliveryRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): TelegramWebhookDeliveryRuntimeConfig {
  const enabled = isTelegramWebhookDeliveryEnabled(
    readOptionalEnv(telegramWebhookDeliveryEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  return { enabled: true };
}

export function createTelegramWebhookOwnerLinkConsumeRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): TelegramWebhookOwnerLinkConsumeRuntimeConfig {
  const enabled = isTelegramWebhookOwnerLinkConsumeEnabled(
    readOptionalEnv(telegramWebhookOwnerLinkConsumeEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  return { enabled: true };
}

export function createTelegramWebhookTemplateContextRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): TelegramWebhookTemplateContextRuntimeConfig {
  const enabled = isTelegramWebhookTemplateContextEnabled(
    readOptionalEnv(telegramWebhookTemplateContextEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  return { enabled: true };
}

export function createTelegramWebhookAgentBrainRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): TelegramWebhookAgentBrainRuntimeConfig {
  const enabled = isTelegramWebhookAgentBrainEnabled(
    readOptionalEnv(telegramWebhookAgentBrainEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  return { enabled: true };
}
