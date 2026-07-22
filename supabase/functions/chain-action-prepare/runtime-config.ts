import {
  readBackendChain,
  type BackendChainDefinition,
} from "../_shared/chain-runtime.ts";
import { chainStatusProviderProtocol } from "../chain-status-provider/core.ts";

export const chainActionPrepareEnabledEnvKey =
  "KYRA_CHAIN_ACTION_PREPARE_ENABLED";
export const chainActionEndpointEnvKey = "KYRA_CHAIN_STATUS_ENDPOINT";
export const chainActionEndpointHostEnvKey = "KYRA_CHAIN_STATUS_ENDPOINT_HOST";
export const chainActionSharedSecretEnvKey =
  "KYRA_CHAIN_PROVIDER_SHARED_SECRET";
export const chainActionTimeoutMsEnvKey = "KYRA_CHAIN_ACTION_TIMEOUT_MS";
export const chainActionProtocolEnvKey = "KYRA_CHAIN_PROVIDER_PROTOCOL";
export const chainActionChainKeyEnvKey = "KYRA_CHAIN_KEY";
export const chainActionChainIdEnvKey = "KYRA_CHAIN_ID";

export type ChainActionPrepareRuntimeConfig =
  | { enabled: false }
  | {
    enabled: true;
    endpoint: string | null;
    sharedSecret: string | null;
    timeoutMs: number;
    providerProtocol: typeof chainStatusProviderProtocol | null;
    chain: BackendChainDefinition;
  };

export function createChainActionPrepareRuntimeConfig(
  getOptionalEnv: (key: string) => string,
): ChainActionPrepareRuntimeConfig {
  if (getOptionalEnv(chainActionPrepareEnabledEnvKey) !== "true") {
    return { enabled: false };
  }

  const chain = readBackendChain(
    getOptionalEnv(chainActionChainKeyEnvKey).trim(),
    Number(getOptionalEnv(chainActionChainIdEnvKey).trim()),
  );
  const endpoint = normalizeChainStatusEndpoint(
    getOptionalEnv(chainActionEndpointEnvKey),
    getOptionalEnv(chainActionEndpointHostEnvKey),
  );
  const sharedSecret = getOptionalEnv(chainActionSharedSecretEnvKey).trim();

  return {
    enabled: true,
    endpoint,
    sharedSecret: sharedSecret.length >= 32 ? sharedSecret : null,
    timeoutMs: parseChainActionTimeoutMs(
      getOptionalEnv(chainActionTimeoutMsEnvKey),
    ),
    providerProtocol:
      getOptionalEnv(chainActionProtocolEnvKey) === chainStatusProviderProtocol
        ? chainStatusProviderProtocol
        : null,
    chain,
  };
}

export function parseChainActionTimeoutMs(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return 2500;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 250) return 2500;
  return Math.min(parsed, 5000);
}

export function normalizeChainStatusEndpoint(
  value: unknown,
  expectedHost: unknown,
) {
  if (
    typeof value !== "string" ||
    typeof expectedHost !== "string" ||
    !value.trim() ||
    !expectedHost.trim()
  ) {
    return null;
  }

  try {
    const url = new URL(value.trim());
    const hostname = expectedHost.trim().toLowerCase();

    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      url.hostname.toLowerCase() !== hostname ||
      !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)*[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u
        .test(hostname)
    ) {
      return null;
    }

    url.pathname = url.pathname.replace(/\/+$/u, "");
    return url.toString();
  } catch {
    return null;
  }
}
