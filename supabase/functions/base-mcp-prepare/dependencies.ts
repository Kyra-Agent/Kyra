import {
  lookupAgentOwnershipRecord,
  type OwnershipLookupClient,
} from "../telegram-connect/core.ts";
import type { BaseMcpPrepareDependencies } from "./core.ts";
import {
  createBaseMcpPrepareRuntimeConfig,
  type OptionalEnvReader,
} from "./runtime-config.ts";

export interface BaseMcpPrepareDependencyOptions {
  getEnv: (key: string) => string;
  getOptionalEnv: OptionalEnvReader;
  getUser: NonNullable<BaseMcpPrepareDependencies["getUser"]>;
  createServiceClient: (
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<OwnershipLookupClient> | OwnershipLookupClient;
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
  let serviceClientPromise: Promise<OwnershipLookupClient> | null = null;
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

  return dependencies;
}
