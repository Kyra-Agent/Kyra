import { handleOfficialMcpTokenBrokerRequest } from "./index.ts";

Deno.test("official MCP token broker stays disabled and ignores token data", async () => {
  const request = new Request("https://kyra.test/token", {
    method: "POST",
    body: JSON.stringify({
      access_token: "secret-access",
      refresh_token: "secret-refresh",
    }),
  });
  const response = handleOfficialMcpTokenBrokerRequest(request, () => "");
  const text = await response.text();

  if (response.status !== 403) throw new Error("Expected disabled 403.");
  if (!text.includes('"result":"official_mcp_token_broker_disabled"')) {
    throw new Error("Expected fixed token-broker disabled result.");
  }
  if (request.bodyUsed) throw new Error("Token body must remain unread.");
  for (const forbidden of ["secret-access", "secret-refresh"]) {
    if (text.includes(forbidden)) throw new Error(`Leaked ${forbidden}.`);
  }
});

Deno.test("official MCP token broker has no enabled implementation", async () => {
  const response = handleOfficialMcpTokenBrokerRequest(
    new Request("https://kyra.test/token"),
    () => "true",
  );
  const text = await response.text();

  if (response.status !== 503) throw new Error("Expected fail-closed 503.");
  if (
    !text.includes('"result":"official_mcp_token_broker_not_implemented"')
  ) {
    throw new Error("Expected fixed token-broker not-implemented result.");
  }
});
