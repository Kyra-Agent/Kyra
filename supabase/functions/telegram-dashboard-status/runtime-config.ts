export const telegramDashboardStatusEnabledEnvKey =
  "KYRA_TELEGRAM_DASHBOARD_STATUS_ENABLED";

export type OptionalEnvReader = (key: string) => string;

export type TelegramDashboardStatusRuntimeConfig =
  | { enabled: false }
  | { enabled: true };

export function isTelegramDashboardStatusEnabled(value: unknown) {
  return value === "true";
}

export function createTelegramDashboardStatusRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): TelegramDashboardStatusRuntimeConfig {
  const enabled = isTelegramDashboardStatusEnabled(
    readOptionalEnv(telegramDashboardStatusEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  return { enabled: true };
}
