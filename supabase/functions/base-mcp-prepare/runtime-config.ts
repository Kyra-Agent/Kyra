export const baseMcpPrepareEnabledEnvKey = "KYRA_BASE_MCP_PREP_ENABLED";
export const baseMcpEndpointEnvKey = "KYRA_BASE_MCP_ENDPOINT";
export const baseMcpApiKeyEnvKey = "KYRA_BASE_MCP_API_KEY";
export const baseMcpTimeoutMsEnvKey = "KYRA_BASE_MCP_TIMEOUT_MS";
export const baseMcpProviderProtocolEnvKey =
  "KYRA_BASE_MCP_PROVIDER_PROTOCOL";
export const baseMcpProviderProtocol = "kyra_status_v1";

export type OptionalEnvReader = (key: string) => string;

export type BaseMcpPrepareRuntimeConfig =
  | { enabled: false }
  | {
    enabled: true;
    endpoint: string | null;
    apiKey: string | null;
    timeoutMs: number;
    providerProtocol: typeof baseMcpProviderProtocol | null;
  };

export function isBaseMcpPrepareEnabled(value: unknown) {
  return value === "true";
}

export function parseBaseMcpTimeoutMs(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return 2500;
  }

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    return 2500;
  }

  return Math.min(parsed, 5000);
}

export function normalizeBaseMcpEndpoint(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function createBaseMcpPrepareRuntimeConfig(
  readOptionalEnv: OptionalEnvReader,
): BaseMcpPrepareRuntimeConfig {
  const enabled = isBaseMcpPrepareEnabled(
    readOptionalEnv(baseMcpPrepareEnabledEnvKey),
  );

  if (!enabled) {
    return { enabled: false };
  }

  const endpoint = normalizeBaseMcpEndpoint(
    readOptionalEnv(baseMcpEndpointEnvKey),
  );
  const apiKey = readOptionalEnv(baseMcpApiKeyEnvKey).trim() || null;
  const timeoutMs = parseBaseMcpTimeoutMs(
    readOptionalEnv(baseMcpTimeoutMsEnvKey),
  );
  const providerProtocol = readOptionalEnv(baseMcpProviderProtocolEnvKey) ===
      baseMcpProviderProtocol
    ? baseMcpProviderProtocol
    : null;

  return {
    enabled: true,
    endpoint,
    apiKey,
    timeoutMs,
    providerProtocol,
  };
}
