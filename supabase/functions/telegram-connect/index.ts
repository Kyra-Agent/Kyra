import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type AgentOwnershipRecord,
  handleTelegramConnectRequest,
  HttpError,
  isTelegramConnectGetMeEnabled,
  isTelegramConnectSessionWriteEnabled,
  isTelegramConnectStoreEnabled,
  lookupAgentOwnershipRecord,
  type OwnershipLookupClient,
  type PersistTelegramSessionInput,
  persistTelegramSessionRecord,
  type RegisterTelegramWebhookInput,
  type TelegramConnectDependencies,
  telegramConnectGetMeEnabledEnvKey,
  telegramConnectSessionWriteEnabledEnvKey,
  telegramConnectStoreEnabledEnvKey,
  type TelegramSessionPersistenceClient,
} from "./core.ts";
import { createTelegramWebhookRegistrationRuntimeConfig } from "./runtime-config.ts";
import { createRpcTelegramBotTokenSecretStore } from "./secret-store.ts";
import {
  registerTelegramWebhookWithSetWebhook,
  validateTelegramBotTokenWithGetMe,
} from "./telegram-api.ts";

export * from "./core.ts";

type KyraSupabaseClient = ReturnType<typeof createClient<any>>;

export interface TelegramConnectRuntimeOptions {
  getOptionalEnv?: (key: string) => string;
}

export function getEnv(key: string) {
  const value = Deno.env.get(key);

  if (!value) {
    throw new HttpError(
      500,
      "missing_env",
      `Missing required Edge Function secret: ${key}.`,
    );
  }

  return value;
}

export function getOptionalEnv(key: string) {
  return Deno.env.get(key) ?? "";
}

export async function getUser(
  supabaseUrl: string,
  anonKey: string,
  authorization: string,
) {
  const userClient = createClient(supabaseUrl, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: authorization,
      },
    },
  });
  const { data, error } = await userClient.auth.getUser();

  if (error || !data.user) {
    throw new HttpError(
      401,
      "unauthorized",
      "A valid Supabase session is required.",
    );
  }

  return data.user;
}

export function createServiceClient(
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function lookupAgentOwnership(
  serviceClient: KyraSupabaseClient,
  agentId: string,
): Promise<AgentOwnershipRecord | null> {
  return await lookupAgentOwnershipRecord(
    serviceClient as unknown as OwnershipLookupClient,
    agentId,
  );
}

export async function persistTelegramSession(
  serviceClient: KyraSupabaseClient,
  input: PersistTelegramSessionInput,
) {
  return await persistTelegramSessionRecord(
    serviceClient as unknown as TelegramSessionPersistenceClient,
    input,
  );
}

export async function registerTelegramWebhook(
  input: RegisterTelegramWebhookInput,
) {
  await registerTelegramWebhookWithSetWebhook({
    botToken: input.botToken,
    webhookUrl: input.webhookUrl,
    webhookSecretToken: input.webhookSecretToken,
  });
}

export function createTelegramConnectDependencies(
  options: TelegramConnectRuntimeOptions = {},
): TelegramConnectDependencies {
  const readOptionalEnv = options.getOptionalEnv ?? getOptionalEnv;
  let serviceClient: KyraSupabaseClient | null = null;
  const getServiceClient = () => {
    if (!serviceClient) {
      const supabaseUrl = getEnv("SUPABASE_URL");
      const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
      serviceClient = createServiceClient(supabaseUrl, serviceRoleKey);
    }

    return serviceClient;
  };
  const getMeEnabled = isTelegramConnectGetMeEnabled(
    readOptionalEnv(telegramConnectGetMeEnabledEnvKey),
  );
  const storeEnabled = isTelegramConnectStoreEnabled(
    readOptionalEnv(telegramConnectStoreEnabledEnvKey),
  );
  const sessionWriteEnabled = isTelegramConnectSessionWriteEnabled(
    readOptionalEnv(telegramConnectSessionWriteEnabledEnvKey),
  );
  const webhookRegistrationConfig =
    createTelegramWebhookRegistrationRuntimeConfig(
      readOptionalEnv,
    );
  const webhookRegisterEnabled = webhookRegistrationConfig.enabled;
  const dependencies: TelegramConnectDependencies = {
    getEnv,
    getUser,
    lookupAgentOwnership: async (agentId: string) => {
      return await lookupAgentOwnership(getServiceClient(), agentId);
    },
  };

  if (getMeEnabled || storeEnabled) {
    dependencies.validateTelegramBotToken = validateTelegramBotTokenWithGetMe;
  }

  if (storeEnabled) {
    const secretStore = createRpcTelegramBotTokenSecretStore({
      rpc: async (functionName, args) => {
        return await getServiceClient().rpc(functionName, args);
      },
    });
    dependencies.storeTelegramBotToken = (input) =>
      secretStore.storeTelegramBotToken(input);

    if (sessionWriteEnabled) {
      dependencies.persistTelegramSession = (input) =>
        persistTelegramSession(getServiceClient(), input);
      dependencies.revokeTelegramBotToken = async (input) => {
        await secretStore.revokeTelegramBotToken(input);
      };
    }
  }

  if (webhookRegisterEnabled) {
    dependencies.getTelegramWebhookUrl =
      webhookRegistrationConfig.getTelegramWebhookUrl;
    dependencies.generateTelegramWebhookSecret =
      webhookRegistrationConfig.generateTelegramWebhookSecret;
    dependencies.registerTelegramWebhook = registerTelegramWebhook;
  }

  return dependencies;
}

if (import.meta.main) {
  const dependencies = createTelegramConnectDependencies();

  Deno.serve((request) => handleTelegramConnectRequest(request, dependencies));
}
