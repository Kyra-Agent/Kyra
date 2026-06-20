export const officialMcpRouteGateKeys = {
  oauthStart: "KYRA_OFFICIAL_MCP_OAUTH_START_ENABLED",
  oauthCallback: "KYRA_OFFICIAL_MCP_OAUTH_CALLBACK_ENABLED",
  tokenBroker: "KYRA_OFFICIAL_MCP_TOKEN_BROKER_ENABLED",
  revoke: "KYRA_OFFICIAL_MCP_REVOKE_ENABLED",
  status: "KYRA_OFFICIAL_MCP_STATUS_ENABLED",
} as const;

export type OfficialMcpRouteGateKey =
  (typeof officialMcpRouteGateKeys)[keyof typeof officialMcpRouteGateKeys];

export type OfficialMcpEnvReader = (key: string) => string | undefined;

export function isOfficialMcpRouteGateEnabled(value: unknown) {
  return value === "true";
}

export function readOfficialMcpRouteGate(
  key: OfficialMcpRouteGateKey,
  readEnv: OfficialMcpEnvReader,
) {
  try {
    return isOfficialMcpRouteGateEnabled(readEnv(key));
  } catch {
    return false;
  }
}
