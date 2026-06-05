export const telegramLinkIssueEnabledEnvKey =
  "KYRA_TELEGRAM_LINK_ISSUE_ENABLED";

export type OptionalEnvReader = (key: string) => string;

export type TelegramLinkIssueRuntimeConfig =
  | { enabled: false }
  | { enabled: true };

export function isTelegramLinkIssueEnabled(value: unknown) {
  return value === "true";
}

export function createTelegramLinkIssueRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): TelegramLinkIssueRuntimeConfig {
  const enabled = isTelegramLinkIssueEnabled(
    readOptionalEnv(telegramLinkIssueEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  return { enabled: true };
}
