import {
  lookupAgentOwnershipRecord,
  type OwnershipLookupClient,
} from "../telegram-connect/core.ts";
import type { ChainActionPrepareDependencies } from "./core.ts";
import { createChainStatusCheckAdapter } from "./provider-adapter.ts";
import {
  createChainActionRateLimitChecker,
  type ChainActionRateLimitRpcClient,
} from "./rate-limit.ts";
import { createChainActionPrepareRuntimeConfig } from "./runtime-config.ts";
import {
  createChainPreparedActionStorageAdapter,
  type ChainPreparedActionStorageClient,
} from "./storage-adapter.ts";

type ChainActionServiceClient = OwnershipLookupClient &
  ChainActionRateLimitRpcClient & ChainPreparedActionStorageClient;

export interface ChainActionDependencyOptions {
  getEnv: (key: string) => string;
  getOptionalEnv: (key: string) => string;
  getUser: NonNullable<ChainActionPrepareDependencies["getUser"]>;
  createServiceClient: (
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<ChainActionServiceClient> | ChainActionServiceClient;
}

export function createChainActionDependenciesFromOptions(
  options: ChainActionDependencyOptions,
): ChainActionPrepareDependencies {
  const runtimeConfig = createChainActionPrepareRuntimeConfig(
    options.getOptionalEnv,
  );
  const dependencies: ChainActionPrepareDependencies = { runtimeConfig };
  if (!runtimeConfig.enabled) return dependencies;

  dependencies.getEnv = options.getEnv;
  dependencies.getUser = options.getUser;
  dependencies.prepareChainAction = createChainStatusCheckAdapter();

  let serviceClientPromise: Promise<ChainActionServiceClient> | null = null;
  const getServiceClient = () => {
    serviceClientPromise ??= Promise.resolve(options.createServiceClient(
      options.getEnv("SUPABASE_URL"),
      options.getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    ));
    return serviceClientPromise;
  };

  dependencies.lookupAgentOwnership = async (agentId) =>
    await lookupAgentOwnershipRecord(await getServiceClient(), agentId);
  dependencies.checkRateLimit = async (input) =>
    await createChainActionRateLimitChecker(await getServiceClient())(input);
  dependencies.storePreparedAction = async (input) =>
    await createChainPreparedActionStorageAdapter(await getServiceClient())(
      input,
    );

  return dependencies;
}
