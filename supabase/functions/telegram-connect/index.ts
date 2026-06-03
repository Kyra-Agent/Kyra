import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleTelegramConnectRequest,
  HttpError,
} from "./core.ts";

export * from "./core.ts";

export function getEnv(key: string) {
  const value = Deno.env.get(key);

  if (!value) {
    throw new HttpError(500, "missing_env", `Missing required Edge Function secret: ${key}.`);
  }

  return value;
}

export async function getUser(supabaseUrl: string, anonKey: string, authorization: string) {
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
    throw new HttpError(401, "unauthorized", "A valid Supabase session is required.");
  }

  return data.user;
}

if (import.meta.main) {
  const dependencies = {
    getEnv,
    getUser,
  };

  Deno.serve((request) => handleTelegramConnectRequest(request, dependencies));
}
