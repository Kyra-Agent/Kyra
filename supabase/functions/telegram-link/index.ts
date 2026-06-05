import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type AgentOwnershipRecord,
  HttpError,
  lookupAgentOwnershipRecord,
  type OwnershipLookupClient,
} from "../telegram-connect/core.ts";
import {
  issueTelegramOwnerLinkChallenge,
  type TelegramOwnerLinkIssueRpcClient,
} from "../telegram-connect/owner-link-challenge.ts";
import { createTelegramOwnerLinkChallengeMaterial } from "../_shared/telegram-owner-link.ts";
import {
  lookupTelegramLinkActiveSession,
  type TelegramLinkActiveSessionLookupClient,
} from "./active-session-lookup.ts";
import {
  handleTelegramLinkRequest,
  type TelegramLinkDependencies,
} from "./core.ts";
import {
  createTelegramLinkIssueRuntimeConfig,
  type OptionalEnvReader,
} from "./runtime-config.ts";

export * from "./core.ts";
export * from "./runtime-config.ts";
export * from "./active-session-lookup.ts";

type KyraSupabaseClient = ReturnType<typeof createClient<any>>;

export interface TelegramLinkRuntimeOptions {
  getOptionalEnv?: OptionalEnvReader;
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

export function createTelegramLinkDependencies(
  options: TelegramLinkRuntimeOptions = {},
): TelegramLinkDependencies {
  const readOptionalEnv = options.getOptionalEnv ?? getOptionalEnv;
  const issueRuntimeConfig = createTelegramLinkIssueRuntimeConfig(
    readOptionalEnv,
  );
  const dependencies: TelegramLinkDependencies = { issueRuntimeConfig };

  if (!issueRuntimeConfig.enabled) {
    return dependencies;
  }

  let serviceClient: KyraSupabaseClient | null = null;
  const getServiceClient = () => {
    if (!serviceClient) {
      serviceClient = createServiceClient(
        getEnv("SUPABASE_URL"),
        getEnv("SUPABASE_SERVICE_ROLE_KEY"),
      );
    }

    return serviceClient;
  };

  dependencies.getEnv = getEnv;
  dependencies.getUser = getUser;
  dependencies.lookupAgentOwnership = async (
    agentId: string,
    _ownerUserId: string,
  ): Promise<AgentOwnershipRecord | null> => {
    return await lookupAgentOwnershipRecord(
      getServiceClient() as unknown as OwnershipLookupClient,
      agentId,
    );
  };
  dependencies.lookupActiveTelegramSession = async (agentId) => {
    return await lookupTelegramLinkActiveSession({
      agentId,
      serviceClient:
        getServiceClient() as unknown as TelegramLinkActiveSessionLookupClient,
    });
  };
  dependencies.createChallengeMaterial =
    createTelegramOwnerLinkChallengeMaterial;
  dependencies.issueOwnerLinkChallenge = async (input) => {
    return await issueTelegramOwnerLinkChallenge({
      ...input,
      rpcClient:
        getServiceClient() as unknown as TelegramOwnerLinkIssueRpcClient,
    });
  };

  return dependencies;
}

if (import.meta.main) {
  const dependencies = createTelegramLinkDependencies();

  Deno.serve((request) => handleTelegramLinkRequest(request, dependencies));
}
