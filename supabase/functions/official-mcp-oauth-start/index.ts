import { createOfficialMcpDisabledOnlyResponse } from "../official-mcp-shared/disabled-response.ts";
import {
  type OfficialMcpEnvReader,
  officialMcpRouteGateKeys,
} from "../official-mcp-shared/gates.ts";

export function handleOfficialMcpOauthStartRequest(
  _request: Request,
  readEnv: OfficialMcpEnvReader = (key) => Deno.env.get(key),
) {
  return createOfficialMcpDisabledOnlyResponse(
    "oauth_start",
    officialMcpRouteGateKeys.oauthStart,
    readEnv,
  );
}

if (import.meta.main) {
  Deno.serve((request) => handleOfficialMcpOauthStartRequest(request));
}
