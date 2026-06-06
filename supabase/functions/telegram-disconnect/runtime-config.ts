export const telegramDisconnectEnabledEnvKey =
  "KYRA_TELEGRAM_DISCONNECT_ENABLED";

export type OptionalEnvReader = (key: string) => string;

export type TelegramDisconnectRuntimeConfig =
  | { enabled: false }
  | { enabled: true };

export function isTelegramDisconnectEnabled(value: unknown) {
  return value === "true";
}

export function createTelegramDisconnectRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): TelegramDisconnectRuntimeConfig {
  const enabled = isTelegramDisconnectEnabled(
    readOptionalEnv(telegramDisconnectEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  return { enabled: true };
}
