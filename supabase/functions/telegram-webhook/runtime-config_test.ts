import {
  createTelegramWebhookAgentBrainRuntimeConfig,
  createTelegramWebhookAgentBrainProviderRuntimeConfig,
  createTelegramWebhookChatAuthRuntimeConfig,
  createTelegramWebhookClaimRuntimeConfig,
  createTelegramWebhookDeliveryRuntimeConfig,
  createTelegramWebhookLookupRuntimeConfig,
  createTelegramWebhookOwnerLinkConsumeRuntimeConfig,
  createTelegramWebhookParseRuntimeConfig,
  createTelegramWebhookTemplateContextRuntimeConfig,
  isTelegramWebhookAgentBrainEnabled,
  isTelegramWebhookAgentBrainProviderEnabled,
  isTelegramWebhookChatAuthEnabled,
  isTelegramWebhookClaimEnabled,
  isTelegramWebhookDeliveryEnabled,
  isTelegramWebhookLookupEnabled,
  isTelegramWebhookOwnerLinkConsumeEnabled,
  isTelegramWebhookParseEnabled,
  isTelegramWebhookTemplateContextEnabled,
  telegramWebhookAgentBrainEnabledEnvKey,
  telegramWebhookAgentBrainProviderEnabledEnvKey,
  telegramWebhookChatAuthEnabledEnvKey,
  telegramWebhookClaimEnabledEnvKey,
  telegramWebhookDeliveryEnabledEnvKey,
  telegramWebhookLookupEnabledEnvKey,
  telegramWebhookOwnerLinkConsumeEnabledEnvKey,
  telegramWebhookParseEnabledEnvKey,
  telegramWebhookTemplateContextEnabledEnvKey,
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

Deno.test("telegram webhook claim runtime gate defaults off and requires exact true", () => {
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
    assertEquals(isTelegramWebhookClaimEnabled(value), false);
  }

  assertEquals(isTelegramWebhookClaimEnabled("true"), true);
});

Deno.test("telegram webhook claim runtime config reads only the claim gate key", () => {
  const keys: string[] = [];
  const config = createTelegramWebhookClaimRuntimeConfig((key) => {
    keys.push(key);
    return "";
  });

  assertEquals(config.enabled, false);
  assertEquals(keys.join(","), telegramWebhookClaimEnabledEnvKey);
});

Deno.test("telegram webhook delivery runtime gate defaults off and requires exact true", () => {
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
    assertEquals(isTelegramWebhookDeliveryEnabled(value), false);
  }

  assertEquals(isTelegramWebhookDeliveryEnabled("true"), true);
});

Deno.test("telegram webhook delivery runtime config reads only the delivery gate key", () => {
  const keys: string[] = [];
  const config = createTelegramWebhookDeliveryRuntimeConfig((key) => {
    keys.push(key);
    return "";
  });

  assertEquals(config.enabled, false);
  assertEquals(keys.join(","), telegramWebhookDeliveryEnabledEnvKey);
});

Deno.test("telegram webhook owner-link consume gate defaults off and requires exact true", () => {
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
    assertEquals(isTelegramWebhookOwnerLinkConsumeEnabled(value), false);
  }

  assertEquals(isTelegramWebhookOwnerLinkConsumeEnabled("true"), true);
});

Deno.test("telegram webhook owner-link consume config reads only its gate key", () => {
  const keys: string[] = [];
  const config = createTelegramWebhookOwnerLinkConsumeRuntimeConfig((key) => {
    keys.push(key);
    return "";
  });

  assertEquals(config.enabled, false);
  assertEquals(keys.join(","), telegramWebhookOwnerLinkConsumeEnabledEnvKey);
});

Deno.test("telegram webhook template context gate defaults off and requires exact true", () => {
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
    assertEquals(isTelegramWebhookTemplateContextEnabled(value), false);
  }

  assertEquals(isTelegramWebhookTemplateContextEnabled("true"), true);
});

Deno.test("telegram webhook template context config reads only its gate key", () => {
  const keys: string[] = [];
  const config = createTelegramWebhookTemplateContextRuntimeConfig((key) => {
    keys.push(key);
    return "";
  });

  assertEquals(config.enabled, false);
  assertEquals(keys.join(","), telegramWebhookTemplateContextEnabledEnvKey);
});

Deno.test("telegram webhook agent brain gate defaults off and requires exact true", () => {
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
    assertEquals(isTelegramWebhookAgentBrainEnabled(value), false);
  }

  assertEquals(isTelegramWebhookAgentBrainEnabled("true"), true);
});

Deno.test("telegram webhook agent brain config reads only its gate key", () => {
  const keys: string[] = [];
  const config = createTelegramWebhookAgentBrainRuntimeConfig((key) => {
    keys.push(key);
    return "";
  });

  assertEquals(config.enabled, false);
  assertEquals(keys.join(","), telegramWebhookAgentBrainEnabledEnvKey);
});

Deno.test("telegram webhook agent brain provider gate defaults off and requires exact true", () => {
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
    assertEquals(isTelegramWebhookAgentBrainProviderEnabled(value), false);
  }

  assertEquals(isTelegramWebhookAgentBrainProviderEnabled("true"), true);
});

Deno.test("telegram webhook agent brain provider config reads only its gate key", () => {
  const keys: string[] = [];
  const config = createTelegramWebhookAgentBrainProviderRuntimeConfig((key) => {
    keys.push(key);
    return "";
  });

  assertEquals(config.enabled, false);
  assertEquals(keys.join(","), telegramWebhookAgentBrainProviderEnabledEnvKey);
});
