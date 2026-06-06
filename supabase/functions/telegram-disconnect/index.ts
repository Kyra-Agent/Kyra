import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { HttpError } from "../telegram-connect/core.ts";
import {
  handleTelegramDisconnectRequest,
  type TelegramDisconnectDependencies,
} from "./core.ts";
import {
  createTelegramDisconnectRuntimeConfig,
  type OptionalEnvReader,
} from "./runtime-config.ts";

export * from "./core.ts";
export * from "./runtime-config.ts";

export interface TelegramDisconnectRuntimeOptions {
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
): TelegramDisconnectDependencies {
  const readOptionalEnv = options.getOptionalEnv ?? getOptionalEnv;
  const disconnectRuntimeConfig = createTelegramDisconnectRuntimeConfig(
    readOptionalEnv,
  );
  const dependencies: TelegramDisconnectDependencies = {
    disconnectRuntimeConfig,
  };

  if (!disconnectRuntimeConfig.enabled) {
    return dependencies;
  }

  dependencies.getEnv = getEnv;
  dependencies.getUser = getUser;

  return dependencies;
}

if (import.meta.main) {
  const dependencies = createTelegramDisconnectDependencies();

  Deno.serve((request) =>
    handleTelegramDisconnectRequest(request, dependencies)
  );
}
