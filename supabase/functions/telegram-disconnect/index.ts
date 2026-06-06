import { HttpError } from "../telegram-connect/core.ts";
import {
  createTelegramDisconnectDependenciesFromOptions,
} from "./dependencies.ts";
import { handleTelegramDisconnectRequest } from "./core.ts";
import type { OptionalEnvReader } from "./runtime-config.ts";

export * from "./core.ts";
export { createTelegramDisconnectClaimRpcClient } from "./dependencies.ts";
export * from "./runtime-config.ts";
export * from "./session-claim.ts";

export interface TelegramDisconnectRuntimeOptions {
  getEnv?: (key: string) => string;
  getOptionalEnv?: OptionalEnvReader;
  fetchRpc?: typeof fetch;
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

export function createTelegramDisconnectDependencies(
  options: TelegramDisconnectRuntimeOptions = {},
): ReturnType<typeof createTelegramDisconnectDependenciesFromOptions> {
  const readRequiredEnv = options.getEnv ?? getEnv;
  const readOptionalEnv = options.getOptionalEnv ?? getOptionalEnv;

  return createTelegramDisconnectDependenciesFromOptions({
    getEnv: readRequiredEnv,
    getOptionalEnv: readOptionalEnv,
    getUser,
    fetchRpc: options.fetchRpc,
  });
}

if (import.meta.main) {
  const dependencies = createTelegramDisconnectDependencies();

  Deno.serve((request) =>
    handleTelegramDisconnectRequest(request, dependencies)
  );
}
