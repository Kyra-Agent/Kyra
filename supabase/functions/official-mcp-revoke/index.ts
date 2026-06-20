import { createOfficialMcpDisabledOnlyResponse } from "../official-mcp-shared/disabled-response.ts";
import {
  type OfficialMcpEnvReader,
  officialMcpRouteGateKeys,
} from "../official-mcp-shared/gates.ts";

export function handleOfficialMcpRevokeRequest(
  _request: Request,
  readEnv: OfficialMcpEnvReader = (key) => Deno.env.get(key),
) {
  return createOfficialMcpDisabledOnlyResponse(
    "revoke",
    officialMcpRouteGateKeys.revoke,
    readEnv,
  );
}

if (import.meta.main) {
  Deno.serve((request) => handleOfficialMcpRevokeRequest(request));
}
