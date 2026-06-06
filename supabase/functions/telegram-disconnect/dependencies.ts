import type { TelegramDisconnectDependencies } from "./core.ts";
import {
  createTelegramDisconnectRuntimeConfig,
  type OptionalEnvReader,
} from "./runtime-config.ts";
import {
  claimTelegramDisconnectSession,
  type TelegramDisconnectClaimRpcClient,
} from "./session-claim.ts";

export interface TelegramDisconnectDependencyFactoryOptions {
  getEnv: (key: string) => string;
  getOptionalEnv: OptionalEnvReader;
  getUser: NonNullable<TelegramDisconnectDependencies["getUser"]>;
  fetchRpc?: typeof fetch;
}

export function createTelegramDisconnectClaimRpcClient(
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchRpc: typeof fetch = fetch,
): TelegramDisconnectClaimRpcClient {
  const rpcBaseUrl = supabaseUrl.replace(/\/+$/, "");

  return {
    async rpc(functionName, args) {
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
  };
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
  let rpcClient: TelegramDisconnectClaimRpcClient | null = null;
  const getRpcClient = () => {
    if (!rpcClient) {
      const supabaseUrl = options.getEnv("SUPABASE_URL");
      const serviceRoleKey = options.getEnv("SUPABASE_SERVICE_ROLE_KEY");
      rpcClient = createTelegramDisconnectClaimRpcClient(
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
      rpcClient: getRpcClient(),
    });
  };

  return dependencies;
}
