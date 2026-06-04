import {
  createTelegramWebhookChatAuthRuntimeConfig,
  createTelegramWebhookLookupRuntimeConfig,
  createTelegramWebhookParseRuntimeConfig,
  isTelegramWebhookChatAuthEnabled,
  isTelegramWebhookLookupEnabled,
  isTelegramWebhookParseEnabled,
  telegramWebhookChatAuthEnabledEnvKey,
  telegramWebhookLookupEnabledEnvKey,
  telegramWebhookParseEnabledEnvKey,
} from "./index.ts";

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

Deno.test("telegram webhook lookup runtime gate defaults off and requires exact true", () => {
  const disabledValues = [
    undefined,
    null,
    "",
    " ",
    "false",
    "1",
    "yes",
    "TRUE",
    " true ",
  ];

  for (const value of disabledValues) {
    assertEquals(isTelegramWebhookLookupEnabled(value), false);
  }

  assertEquals(isTelegramWebhookLookupEnabled("true"), true);
});

Deno.test("telegram webhook lookup runtime config reads only the gate key", () => {
  const keys: string[] = [];
  const config = createTelegramWebhookLookupRuntimeConfig((key) => {
    keys.push(key);
    return "";
  });

  assertEquals(config.enabled, false);
  assertEquals(keys.join(","), telegramWebhookLookupEnabledEnvKey);
});

Deno.test("telegram webhook lookup runtime config stays inert while disabled", () => {
  const config = createTelegramWebhookLookupRuntimeConfig((key) => {
    if (key !== telegramWebhookLookupEnabledEnvKey) {
      throw new Error("Disabled gate must not read unrelated env keys.");
    }

    return "false";
  });

  assertEquals(config.enabled, false);
  assert(
    !("getServiceClient" in config),
    "Disabled config must not expose service-role factories.",
  );
});

Deno.test("telegram webhook lookup runtime config enables only on exact true", () => {
  const config = createTelegramWebhookLookupRuntimeConfig((key) => {
    assertEquals(key, telegramWebhookLookupEnabledEnvKey);
    return "true";
  });

  assertEquals(config.enabled, true);
});

Deno.test("telegram webhook parse runtime gate defaults off and requires exact true", () => {
  const disabledValues = [
    undefined,
    null,
    "",
    " ",
    "false",
    "1",
    "yes",
    "TRUE",
    " true ",
  ];

  for (const value of disabledValues) {
    assertEquals(isTelegramWebhookParseEnabled(value), false);
  }

  assertEquals(isTelegramWebhookParseEnabled("true"), true);
});

Deno.test("telegram webhook parse runtime config reads only the parse gate key", () => {
  const keys: string[] = [];
  const config = createTelegramWebhookParseRuntimeConfig((key) => {
    keys.push(key);
    return "";
  });

  assertEquals(config.enabled, false);
  assertEquals(keys.join(","), telegramWebhookParseEnabledEnvKey);
});

Deno.test("telegram webhook chat auth runtime gate defaults off and requires exact true", () => {
  const disabledValues = [
    undefined,
    null,
    "",
    " ",
    "false",
    "1",
    "yes",
    "TRUE",
    " true ",
  ];

  for (const value of disabledValues) {
    assertEquals(isTelegramWebhookChatAuthEnabled(value), false);
  }

  assertEquals(isTelegramWebhookChatAuthEnabled("true"), true);
});

Deno.test("telegram webhook chat auth runtime config reads only the chat auth gate key", () => {
  const keys: string[] = [];
  const config = createTelegramWebhookChatAuthRuntimeConfig((key) => {
    keys.push(key);
    return "";
  });

  assertEquals(config.enabled, false);
  assertEquals(keys.join(","), telegramWebhookChatAuthEnabledEnvKey);
});
