import {
  readBackendChain,
  type BackendChainDefinition,
} from "../_shared/chain-runtime.ts";

export const chainStatusProviderEnabledEnvKey =
  "KYRA_CHAIN_STATUS_PROVIDER_ENABLED";
export const chainStatusProviderSecretEnvKey =
  "KYRA_CHAIN_PROVIDER_SHARED_SECRET";
export const chainStatusProviderRpcUrlEnvKey = "KYRA_CHAIN_RPC_URL";
export const chainStatusProviderKindEnvKey = "KYRA_CHAIN_RPC_PROVIDER";
export const chainStatusProviderAllowedHostsEnvKey =
  "KYRA_CHAIN_RPC_ALLOWED_HOSTS";
export const chainStatusProviderChainKeyEnvKey = "KYRA_CHAIN_KEY";
export const chainStatusProviderChainIdEnvKey = "KYRA_CHAIN_ID";

export type ChainRpcProviderKind =
  | "managed_private"
  | "robinhood_public_testnet";

export type ChainStatusProviderRuntimeConfig =
  | { enabled: false }
  | {
    enabled: true;
    expectedBearerSecret: string;
    rpcUrl: string;
    providerKind: ChainRpcProviderKind;
    allowedRpcHosts: readonly string[];
    chain: BackendChainDefinition;
  };

export function createChainStatusProviderRuntimeConfig(
  getOptionalEnv: (key: string) => string,
): ChainStatusProviderRuntimeConfig {
  if (getOptionalEnv(chainStatusProviderEnabledEnvKey) !== "true") {
    return { enabled: false };
  }

  const chainIdValue = getOptionalEnv(chainStatusProviderChainIdEnvKey).trim();
  const chainId = Number(chainIdValue);
  const chain = readBackendChain(
    getOptionalEnv(chainStatusProviderChainKeyEnvKey).trim(),
    chainId,
  );
  const providerKind = readProviderKind(
    getOptionalEnv(chainStatusProviderKindEnvKey),
  );
  const allowedRpcHosts = parseAllowedRpcHosts(
    getOptionalEnv(chainStatusProviderAllowedHostsEnvKey),
  );

  return {
    enabled: true,
    expectedBearerSecret: getOptionalEnv(
      chainStatusProviderSecretEnvKey,
    ).trim(),
    rpcUrl: getOptionalEnv(chainStatusProviderRpcUrlEnvKey).trim(),
    providerKind,
    allowedRpcHosts,
    chain,
  };
}

export function parseAllowedRpcHosts(value: unknown) {
  if (typeof value !== "string") return [];

  const hosts = value.split(",").map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  if (
    hosts.length > 8 ||
    hosts.some((host) =>
      host.length > 253 ||
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u
        .test(host)
    ) ||
    new Set(hosts).size !== hosts.length
  ) {
    throw new Error("Chain provider configuration is invalid.");
  }

  return hosts;
}

function readProviderKind(value: unknown): ChainRpcProviderKind {
  if (value === "managed_private" || value === "robinhood_public_testnet") {
    return value;
  }

  throw new Error("Chain provider configuration is invalid.");
}
