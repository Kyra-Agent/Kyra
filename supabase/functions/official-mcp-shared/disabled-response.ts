import {
  type OfficialMcpEnvReader,
  type OfficialMcpRouteGateKey,
  readOfficialMcpRouteGate,
} from "./gates.ts";
import { sanitizeOfficialMcpPublicMessage } from "./redaction.ts";

export const officialMcpDisabledRouteNames = [
  "oauth_start",
  "oauth_callback",
  "token_broker",
  "revoke",
  "status",
] as const;

export type OfficialMcpDisabledRouteName =
  (typeof officialMcpDisabledRouteNames)[number];

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8",
  "cache-control": "no-store",
  "referrer-policy": "no-referrer",
  "x-content-type-options": "nosniff",
};

export function createOfficialMcpDisabledOnlyResponse(
  route: OfficialMcpDisabledRouteName,
  gateKey: OfficialMcpRouteGateKey,
  readEnv: OfficialMcpEnvReader,
) {
  const gateEnabled = readOfficialMcpRouteGate(gateKey, readEnv);
  const status = gateEnabled ? 503 : 403;
  const result = gateEnabled
    ? `official_mcp_${route}_not_implemented`
    : `official_mcp_${route}_disabled`;
  const message = gateEnabled
    ? "Official Base MCP route is not implemented."
    : "Official Base MCP route is disabled.";

  return new Response(JSON.stringify({
    ok: false,
    result,
    message: sanitizeOfficialMcpPublicMessage(message),
  }), {
    status,
    headers: jsonHeaders,
  });
}
