import { handleBaseMcpStatusProviderRequest } from "./core.ts";

function readRequiredEnv(key: string) {
  const value = Deno.env.get(key)?.trim();

  if (!value) {
    throw new Error(`Missing required provider environment: ${key}.`);
  }

  return value;
}

if (import.meta.main) {
  const expectedBearerSecret = readRequiredEnv(
    "KYRA_BASE_MCP_PROVIDER_SHARED_SECRET",
  );
  const baseRpcUrl = readRequiredEnv("KYRA_BASE_RPC_URL");

  Deno.serve((request) =>
    handleBaseMcpStatusProviderRequest(request, {
      expectedBearerSecret,
      baseRpcUrl,
    })
  );
}
