import { HttpError } from "../telegram-connect/core.ts";
import {
  handleChainActionPrepareRequest,
  type ChainActionPrepareDependencies,
} from "./core.ts";
import { createChainActionDependenciesFromOptions } from "./dependencies.ts";
import type { ChainActionRateLimitRpcClient } from "./rate-limit.ts";
import type { ChainPreparedActionStorageClient } from "./storage-adapter.ts";
import type { OwnershipLookupClient } from "../telegram-connect/core.ts";

export * from "./core.ts";
export * from "./dependencies.ts";
export * from "./provider-adapter.ts";
export * from "./provider-contract.ts";
export * from "./rate-limit.ts";
export * from "./runtime-config.ts";
export * from "./storage-adapter.ts";

type ServiceClient = OwnershipLookupClient & ChainActionRateLimitRpcClient &
  ChainPreparedActionStorageClient;

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
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) {
    throw new HttpError(401, "unauthorized", "A valid Supabase session is required.");
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
    auth: { persistSession: false, autoRefreshToken: false },
  }) as unknown as ServiceClient;
}

export function createChainActionPrepareDependencies(): ChainActionPrepareDependencies {
  return createChainActionDependenciesFromOptions({
    getEnv,
    getOptionalEnv,
    getUser,
    createServiceClient,
  });
}

if (import.meta.main) {
  const dependencies = createChainActionPrepareDependencies();
  Deno.serve((request) => handleChainActionPrepareRequest(request, dependencies));
}
