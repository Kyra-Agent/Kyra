import { handleOfficialMcpStatusRequest } from "./index.ts";

Deno.test("official MCP status stays disabled without revealing binding state", async () => {
  const request = new Request(
    "https://kyra.test/status?owner_id=secret-owner&agent_id=secret-agent",
  );
  const response = handleOfficialMcpStatusRequest(request, () => "");
  const text = await response.text();

  if (response.status !== 403) throw new Error("Expected disabled 403.");
  if (!text.includes('"result":"official_mcp_status_disabled"')) {
    throw new Error("Expected fixed status disabled result.");
  }
  for (const forbidden of ["secret-owner", "secret-agent"]) {
    if (text.includes(forbidden)) throw new Error(`Leaked ${forbidden}.`);
  }
});

Deno.test("official MCP status has no enabled implementation", async () => {
  const response = handleOfficialMcpStatusRequest(
    new Request("https://kyra.test/status"),
    () => "true",
  );
  const text = await response.text();

  if (response.status !== 503) throw new Error("Expected fail-closed 503.");
  if (!text.includes('"result":"official_mcp_status_not_implemented"')) {
    throw new Error("Expected fixed status not-implemented result.");
  }
});
