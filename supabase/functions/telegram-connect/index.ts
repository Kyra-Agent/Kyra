import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type AgentOwnershipRecord,
  handleTelegramConnectRequest,
  HttpError,
  isTelegramConnectGetMeEnabled,
  isTelegramConnectStoreEnabled,
  lookupAgentOwnershipRecord,
  type OwnershipLookupClient,
  type TelegramConnectDependencies,
  telegramConnectGetMeEnabledEnvKey,
  telegramConnectStoreEnabledEnvKey,
} from "./core.ts";
import { createRpcTelegramBotTokenSecretStore } from "./secret-store.ts";
import { validateTelegramBotTokenWithGetMe } from "./telegram-api.ts";

export * from "./core.ts";

type KyraSupabaseClient = ReturnType<typeof createClient<any>>;

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

export function createTelegramConnectDependencies(): TelegramConnectDependencies {
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
    getOptionalEnv(telegramConnectGetMeEnabledEnvKey),
  );
  const storeEnabled = isTelegramConnectStoreEnabled(
    getOptionalEnv(telegramConnectStoreEnabledEnvKey),
  );
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
  }

  return dependencies;
}

if (import.meta.main) {
  const dependencies = createTelegramConnectDependencies();

  Deno.serve((request) => handleTelegramConnectRequest(request, dependencies));
}
