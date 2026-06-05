import type { RegisterTelegramWebhookInput } from "./core.ts";
import {
  registerTelegramWebhookWithSetWebhook,
  unregisterTelegramWebhookWithDeleteWebhook,
} from "./telegram-api.ts";
import {
  createTelegramWebhookSecretMaterial,
  finalizeTelegramWebhookRegistration,
} from "./webhook-secret.ts";
import {
  activateTelegramSessionRecord,
  revokeTelegramWebhookSecretRecord,
  storeTelegramWebhookSecretRecord,
  type TelegramWebhookPersistenceClient,
} from "./webhook-persistence.ts";

export async function registerTelegramWebhook(
  input: Pick<
    RegisterTelegramWebhookInput,
    "botToken" | "webhookUrl" | "webhookSecretToken"
  >,
) {
  await registerTelegramWebhookWithSetWebhook({
    botToken: input.botToken,
    webhookUrl: input.webhookUrl,
    webhookSecretToken: input.webhookSecretToken,
  });
}

export async function unregisterTelegramWebhook(input: { botToken: string }) {
  await unregisterTelegramWebhookWithDeleteWebhook({
    botToken: input.botToken,
  });
}

export interface FinalizeTelegramWebhookRegistrationRuntimeOptions {
  createWebhookSecretMaterial?: typeof createTelegramWebhookSecretMaterial;
  registerWebhook?: typeof registerTelegramWebhook;
  unregisterWebhook?: typeof unregisterTelegramWebhook;
}

export async function finalizeTelegramWebhookRegistrationRuntime(
  serviceClient: TelegramWebhookPersistenceClient,
  input: RegisterTelegramWebhookInput,
  options: FinalizeTelegramWebhookRegistrationRuntimeOptions = {},
) {
  const createWebhookSecretMaterial = options.createWebhookSecretMaterial ??
    createTelegramWebhookSecretMaterial;
  const registerWebhook = options.registerWebhook ?? registerTelegramWebhook;
  const unregisterWebhook = options.unregisterWebhook ??
    unregisterTelegramWebhook;
  const webhookSecretMaterial = await createWebhookSecretMaterial(
    {
      webhookSecretToken: input.webhookSecretToken,
    },
  );

  await finalizeTelegramWebhookRegistration(
    {
      telegramSessionId: input.telegramSessionId,
      botToken: input.botToken,
      webhookUrl: input.webhookUrl,
      ...webhookSecretMaterial,
    },
    {
      storeTelegramWebhookSecret: async (storeInput) => {
        return await storeTelegramWebhookSecretRecord(
          serviceClient,
          storeInput,
        );
      },
      registerTelegramWebhook: registerWebhook,
      activateTelegramSession: async (activateInput) => {
        return await activateTelegramSessionRecord(
          serviceClient,
          activateInput,
        );
      },
      revokeTelegramWebhookSecret: async (revokeInput) => {
        return await revokeTelegramWebhookSecretRecord(
          serviceClient,
          revokeInput,
        );
      },
      unregisterTelegramWebhook: unregisterWebhook,
    },
  );
}
