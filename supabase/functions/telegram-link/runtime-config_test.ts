import {
  createTelegramLinkIssueRuntimeConfig,
  isTelegramLinkIssueEnabled,
  telegramLinkIssueEnabledEnvKey,
} from "./runtime-config.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

Deno.test("telegram-link issue gate defaults off and requires exact true", () => {
  for (
    const value of [
      undefined,
      null,
      "",
      " ",
      "false",
      "1",
      "yes",
      "TRUE",
      " true ",
    ]
  ) {
    assertEquals(isTelegramLinkIssueEnabled(value), false);
  }

  assertEquals(isTelegramLinkIssueEnabled("true"), true);
});

Deno.test("telegram-link issue config reads only its exact gate key", () => {
  const keys: string[] = [];
  const config = createTelegramLinkIssueRuntimeConfig((key) => {
    keys.push(key);
    return "";
  });

  assertEquals(config.enabled, false);
  assertEquals(keys.join(","), telegramLinkIssueEnabledEnvKey);
});

Deno.test("telegram-link disabled config exposes no runtime dependency", () => {
  const config = createTelegramLinkIssueRuntimeConfig((key) => {
    assertEquals(key, telegramLinkIssueEnabledEnvKey);
    return "false";
  });

  assertEquals(config.enabled, false);
  assert(
    !("getServiceClient" in config),
    "Disabled config must not expose service-role dependency.",
  );
});
