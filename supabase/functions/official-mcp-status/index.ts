import { createOfficialMcpDisabledOnlyResponse } from "../official-mcp-shared/disabled-response.ts";
import {
  type OfficialMcpEnvReader,
  officialMcpRouteGateKeys,
} from "../official-mcp-shared/gates.ts";

export function handleOfficialMcpStatusRequest(
  _request: Request,
  readEnv: OfficialMcpEnvReader = (key) => Deno.env.get(key),
) {
  return createOfficialMcpDisabledOnlyResponse(
    "status",
    officialMcpRouteGateKeys.status,
    readEnv,
  );
}

if (import.meta.main) {
  Deno.serve((request) => handleOfficialMcpStatusRequest(request));
}
