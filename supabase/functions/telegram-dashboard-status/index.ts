import { HttpError } from "../telegram-connect/core.ts";
import {
  handleTelegramDashboardStatusRequest,
  type TelegramDashboardStatusDependencies,
} from "./core.ts";
import {
  createTelegramDashboardStatusRuntimeConfig,
  type OptionalEnvReader,
} from "./runtime-config.ts";

export * from "./core.ts";
export * from "./runtime-config.ts";

export interface TelegramDashboardStatusRuntimeOptions {
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
  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2"
  );
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

export function createTelegramDashboardStatusDependencies(
  options: TelegramDashboardStatusRuntimeOptions = {},
): TelegramDashboardStatusDependencies {
  const readOptionalEnv = options.getOptionalEnv ?? getOptionalEnv;
  const dashboardStatusRuntimeConfig =
    createTelegramDashboardStatusRuntimeConfig(readOptionalEnv);
  const dependencies: TelegramDashboardStatusDependencies = {
    dashboardStatusRuntimeConfig,
  };

  if (!dashboardStatusRuntimeConfig.enabled) {
    return dependencies;
  }

  dependencies.getEnv = getEnv;
  dependencies.getUser = getUser;

  return dependencies;
}

if (import.meta.main) {
  const dependencies = createTelegramDashboardStatusDependencies();

  Deno.serve((request) =>
    handleTelegramDashboardStatusRequest(request, dependencies)
  );
}
