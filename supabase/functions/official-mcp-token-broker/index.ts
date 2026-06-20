import { createOfficialMcpDisabledOnlyResponse } from "../official-mcp-shared/disabled-response.ts";
import {
  type OfficialMcpEnvReader,
  officialMcpRouteGateKeys,
} from "../official-mcp-shared/gates.ts";

export function handleOfficialMcpTokenBrokerRequest(
  _request: Request,
  readEnv: OfficialMcpEnvReader = (key) => Deno.env.get(key),
) {
  return createOfficialMcpDisabledOnlyResponse(
    "token_broker",
    officialMcpRouteGateKeys.tokenBroker,
    readEnv,
  );
}

if (import.meta.main) {
  Deno.serve((request) => handleOfficialMcpTokenBrokerRequest(request));
}
