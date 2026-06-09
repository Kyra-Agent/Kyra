import type { TelegramDashboardStatusDependencies } from "./core.ts";
import {
  createTelegramDashboardStatusRuntimeConfig,
  type OptionalEnvReader,
} from "./runtime-config.ts";
import {
  lookupTelegramDashboardStatuses,
  type TelegramDashboardStatusLookupClient,
} from "./status-lookup.ts";

export interface TelegramDashboardStatusDependencyOptions {
  getEnv: (key: string) => string;
  getOptionalEnv: OptionalEnvReader;
  getUser: NonNullable<TelegramDashboardStatusDependencies["getUser"]>;
  createServiceClient: (
    supabaseUrl: string,
    serviceRoleKey: string,
  ) =>
    | Promise<TelegramDashboardStatusLookupClient>
    | TelegramDashboardStatusLookupClient;
}

export function createTelegramDashboardStatusDependenciesFromOptions(
  options: TelegramDashboardStatusDependencyOptions,
): TelegramDashboardStatusDependencies {
  const dashboardStatusRuntimeConfig =
    createTelegramDashboardStatusRuntimeConfig(options.getOptionalEnv);
  const dependencies: TelegramDashboardStatusDependencies = {
    dashboardStatusRuntimeConfig,
  };

  if (!dashboardStatusRuntimeConfig.enabled) {
    return dependencies;
  }

  dependencies.getEnv = options.getEnv;
  dependencies.getUser = options.getUser;
  let serviceClientPromise: Promise<TelegramDashboardStatusLookupClient> |
    null = null;
  const getServiceClient = () => {
    serviceClientPromise ??= Promise.resolve(options.createServiceClient(
      options.getEnv("SUPABASE_URL"),
      options.getEnv("SUPABASE_SERVICE_ROLE_KEY"),
    ));

    return serviceClientPromise;
  };

  dependencies.lookupDashboardTelegramStatuses = async (input) => {
    return await lookupTelegramDashboardStatuses({
      ...input,
      serviceClient: await getServiceClient(),
    });
  };

  return dependencies;
}
