import { handleChainStatusProviderRequest } from "./core.ts";
import { createChainStatusProviderRuntimeConfig } from "./runtime-config.ts";

export * from "./core.ts";
export * from "./runtime-config.ts";

export function getOptionalEnv(key: string) {
  return Deno.env.get(key) ?? "";
}

if (import.meta.main) {
  Deno.serve((request) =>
    handleChainStatusProviderRequest(request, {
      runtimeConfig: createChainStatusProviderRuntimeConfig(getOptionalEnv),
    })
  );
}
