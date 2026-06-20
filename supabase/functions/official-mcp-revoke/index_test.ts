import { handleOfficialMcpRevokeRequest } from "./index.ts";

Deno.test("official MCP revoke stays disabled without revealing credential state", async () => {
  const request = new Request("https://kyra.test/revoke", {
    method: "POST",
    body: JSON.stringify({
      credential_ref: "secret-credential",
      owner_id: "secret-owner",
    }),
  });
  const response = handleOfficialMcpRevokeRequest(request, () => "");
  const text = await response.text();

  if (response.status !== 403) throw new Error("Expected disabled 403.");
  if (!text.includes('"result":"official_mcp_revoke_disabled"')) {
    throw new Error("Expected fixed revoke disabled result.");
  }
  if (request.bodyUsed) throw new Error("Revoke body must remain unread.");
  for (const forbidden of ["secret-credential", "secret-owner"]) {
    if (text.includes(forbidden)) throw new Error(`Leaked ${forbidden}.`);
  }
});

Deno.test("official MCP revoke has no enabled implementation", async () => {
  const response = handleOfficialMcpRevokeRequest(
    new Request("https://kyra.test/revoke"),
    () => "true",
  );
  const text = await response.text();

  if (response.status !== 503) throw new Error("Expected fail-closed 503.");
  if (!text.includes('"result":"official_mcp_revoke_not_implemented"')) {
    throw new Error("Expected fixed revoke not-implemented result.");
  }
});
