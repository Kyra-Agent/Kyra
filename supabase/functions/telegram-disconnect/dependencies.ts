import type { TelegramDisconnectDependencies } from "./core.ts";
import {
  finalizeTelegramDisconnectCleanup,
  type TelegramDisconnectCleanupDependencies,
} from "./cleanup-finalization.ts";
import type {
  TelegramSecretStoreRpcClient,
} from "../telegram-connect/secret-store.ts";
import {
  createTelegramDisconnectRuntimeConfig,
  type OptionalEnvReader,
} from "./runtime-config.ts";
import {
  claimTelegramDisconnectSession,
  type TelegramDisconnectClaimRpcClient,
} from "./session-claim.ts";

export interface TelegramDisconnectServiceRpcClient
  extends TelegramSecretStoreRpcClient {}

export interface TelegramDisconnectDependencyFactoryOptions {
  getEnv: (key: string) => string;
  getOptionalEnv: OptionalEnvReader;
  getUser: NonNullable<TelegramDisconnectDependencies["getUser"]>;
  fetchRpc?: typeof fetch;
  createCleanupDependencies?: (input: {
    getEnv: (key: string) => string;
    getRpcClient: () => TelegramDisconnectServiceRpcClient;
  }) => TelegramDisconnectCleanupDependencies;
}

export function createTelegramDisconnectServiceRpcClient(
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchRpc: typeof fetch = fetch,
): TelegramDisconnectServiceRpcClient {
  const rpcBaseUrl = supabaseUrl.replace(/\/+$/, "");

  return {
    async rpc(functionName: string, args: Record<string, unknown>) {
      const response = await fetchRpc(
        `${rpcBaseUrl}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",
          headers: {
            apikey: serviceRoleKey,
            authorization: `Bearer ${serviceRoleKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(args),
        },
      );

      let payload: unknown = null;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        return {
          data: null,
          error: payload ?? {
            message: "Telegram disconnect session claim failed.",
          },
        };
      }

      return { data: payload, error: null };
    },
  } as TelegramDisconnectServiceRpcClient;
}

export function createTelegramDisconnectClaimRpcClient(
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchRpc: typeof fetch = fetch,
): TelegramDisconnectClaimRpcClient {
  return createTelegramDisconnectServiceRpcClient(
    supabaseUrl,
    serviceRoleKey,
    fetchRpc,
  ) as TelegramDisconnectClaimRpcClient;
}

export function createTelegramDisconnectDependenciesFromOptions(
  options: TelegramDisconnectDependencyFactoryOptions,
): TelegramDisconnectDependencies {
  const disconnectRuntimeConfig = createTelegramDisconnectRuntimeConfig(
    options.getOptionalEnv,
  );
  const dependencies: TelegramDisconnectDependencies = {
    disconnectRuntimeConfig,
  };

  if (!disconnectRuntimeConfig.enabled) {
    return dependencies;
  }

  dependencies.getEnv = options.getEnv;
  dependencies.getUser = options.getUser;

  const fetchRpc = options.fetchRpc ?? fetch;
  let rpcClient: TelegramDisconnectServiceRpcClient | null = null;
  const getRpcClient = () => {
    if (!rpcClient) {
      const supabaseUrl = options.getEnv("SUPABASE_URL");
      const serviceRoleKey = options.getEnv("SUPABASE_SERVICE_ROLE_KEY");
      rpcClient = createTelegramDisconnectServiceRpcClient(
        supabaseUrl,
        serviceRoleKey,
        fetchRpc,
      );
    }

    return rpcClient;
  };

  dependencies.claimTelegramDisconnectSession = async (input) => {
    return await claimTelegramDisconnectSession({
      ...input,
      rpcClient: getRpcClient() as TelegramDisconnectClaimRpcClient,
    });
  };

  if (options.createCleanupDependencies) {
    let cleanupDependencies: TelegramDisconnectCleanupDependencies | null =
      null;
    const getCleanupDependencies = () => {
      cleanupDependencies ??= options.createCleanupDependencies?.({
        getEnv: options.getEnv,
        getRpcClient,
      }) ?? null;

      if (!cleanupDependencies) {
        throw new Error("Telegram disconnect cleanup dependencies missing.");
      }

      return cleanupDependencies;
    };

    dependencies.finalizeTelegramDisconnectCleanup = async (claim) => {
      return await finalizeTelegramDisconnectCleanup(
        claim,
        getCleanupDependencies(),
      );
    };
  }

  return dependencies;
}
