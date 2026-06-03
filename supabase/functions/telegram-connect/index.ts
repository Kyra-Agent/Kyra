import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type AgentOwnershipRecord,
  handleTelegramConnectRequest,
  HttpError,
  isTelegramConnectGetMeEnabled,
  lookupAgentOwnershipRecord,
  type OwnershipLookupClient,
  type TelegramConnectDependencies,
  telegramConnectGetMeEnabledEnvKey,
} from "./core.ts";
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
  const dependencies: TelegramConnectDependencies = {
    getEnv,
    getUser,
    lookupAgentOwnership: async (agentId: string) => {
      const supabaseUrl = getEnv("SUPABASE_URL");
      const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
      const serviceClient = createServiceClient(supabaseUrl, serviceRoleKey);

      return await lookupAgentOwnership(serviceClient, agentId);
    },
  };

  if (
    isTelegramConnectGetMeEnabled(
      getOptionalEnv(telegramConnectGetMeEnabledEnvKey),
    )
  ) {
    dependencies.validateTelegramBotToken = validateTelegramBotTokenWithGetMe;
  }

  return dependencies;
}

if (import.meta.main) {
  const dependencies = createTelegramConnectDependencies();

  Deno.serve((request) => handleTelegramConnectRequest(request, dependencies));
}
