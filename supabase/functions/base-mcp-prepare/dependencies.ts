import {
  lookupAgentOwnershipRecord,
  type OwnershipLookupClient,
} from "../telegram-connect/core.ts";
import type { BaseMcpPrepareDependencies } from "./core.ts";
import {
  createBaseMcpPrepareRuntimeConfig,
  type OptionalEnvReader,
} from "./runtime-config.ts";
import {
  createBaseMcpStatusCheckAdapter,
  type BaseMcpProviderTransport,
} from "./provider-adapter.ts";
import {
  createBaseMcpStatusRateLimitChecker,
  type BaseMcpRateLimitRpcClient,
} from "./rate-limit.ts";

type BaseMcpServiceClient = OwnershipLookupClient & BaseMcpRateLimitRpcClient;

export interface BaseMcpPrepareDependencyOptions {
  getEnv: (key: string) => string;
  getOptionalEnv: OptionalEnvReader;
  getUser: NonNullable<BaseMcpPrepareDependencies["getUser"]>;
  createServiceClient: (
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<BaseMcpServiceClient> | BaseMcpServiceClient;
  baseMcpProviderTransport?: BaseMcpProviderTransport;
}

export function createBaseMcpPrepareDependenciesFromOptions(
  options: BaseMcpPrepareDependencyOptions,
): BaseMcpPrepareDependencies {
  const baseMcpPrepareRuntimeConfig = createBaseMcpPrepareRuntimeConfig(
    options.getOptionalEnv,
  );
  const dependencies: BaseMcpPrepareDependencies = {
    baseMcpPrepareRuntimeConfig,
  };

  if (!baseMcpPrepareRuntimeConfig.enabled) {
    return dependencies;
  }

  dependencies.getEnv = options.getEnv;
  dependencies.getUser = options.getUser;
  dependencies.prepareBaseMcpAction = createBaseMcpStatusCheckAdapter(
    options.baseMcpProviderTransport,
  );

  let serviceClientPromise: Promise<BaseMcpServiceClient> | null = null;
  const getServiceClient = () => {
    serviceClientPromise ??= Promise.resolve(options.createServiceClient(
      options.getEnv("SUPABASE_URL"),
      options.getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    ));

    return serviceClientPromise;
  };

  dependencies.lookupAgentOwnership = async (agentId, _ownerUserId) => {
    return await lookupAgentOwnershipRecord(
      await getServiceClient(),
      agentId,
    );
  };
  dependencies.checkBaseMcpRateLimit = async (input) => {
    return await createBaseMcpStatusRateLimitChecker(
      await getServiceClient(),
    )(input);
  };

  return dependencies;
}
