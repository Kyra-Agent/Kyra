import { HttpError } from "../telegram-connect/core.ts";
import {
  type BaseMcpPrepareDependencies,
  handleBaseMcpPrepareRequest,
} from "./core.ts";
import { createBaseMcpPrepareDependenciesFromOptions } from "./dependencies.ts";
import type { OptionalEnvReader } from "./runtime-config.ts";
import type { OwnershipLookupClient } from "../telegram-connect/core.ts";

export * from "./core.ts";
export * from "./dependencies.ts";
export * from "./runtime-config.ts";
export * from "./storage-adapter.ts";

export interface BaseMcpPrepareRuntimeOptions {
  getEnv?: (key: string) => string;
  getOptionalEnv?: OptionalEnvReader;
  createServiceClient?: (
    supabaseUrl: string,
    serviceRoleKey: string,
  ) => Promise<OwnershipLookupClient> | OwnershipLookupClient;
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

export async function createServiceClient(
  supabaseUrl: string,
  serviceRoleKey: string,
) {
  const { createClient } = await import(
    "https://esm.sh/@supabase/supabase-js@2"
  );

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }) as unknown as OwnershipLookupClient;
}

export function createBaseMcpPrepareDependencies(
  options: BaseMcpPrepareRuntimeOptions = {},
): BaseMcpPrepareDependencies {
  const readRequiredEnv = options.getEnv ?? getEnv;
  const readOptionalEnv = options.getOptionalEnv ?? getOptionalEnv;
  const createLookupClient = options.createServiceClient ?? createServiceClient;

  return createBaseMcpPrepareDependenciesFromOptions({
    getEnv: readRequiredEnv,
    getOptionalEnv: readOptionalEnv,
    getUser,
    createServiceClient: createLookupClient,
  });
}

if (import.meta.main) {
  const dependencies = createBaseMcpPrepareDependencies();

  Deno.serve((request) => handleBaseMcpPrepareRequest(request, dependencies));
}
