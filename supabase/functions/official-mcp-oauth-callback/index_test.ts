import { handleOfficialMcpOauthCallbackRequest } from "./index.ts";

Deno.test("official MCP OAuth callback ignores code and state while disabled", async () => {
  const request = new Request(
    "https://kyra.test/callback?code=secret-code&state=secret-state",
  );
  const response = handleOfficialMcpOauthCallbackRequest(request, () => "");
  const text = await response.text();

  if (response.status !== 403) throw new Error("Expected disabled 403.");
  if (!text.includes('"result":"official_mcp_oauth_callback_disabled"')) {
    throw new Error("Expected fixed callback disabled result.");
  }
  for (const forbidden of ["secret-code", "secret-state", "kyra.test"]) {
    if (text.includes(forbidden)) throw new Error(`Leaked ${forbidden}.`);
  }
});

Deno.test("official MCP OAuth callback has no enabled implementation", async () => {
  const response = handleOfficialMcpOauthCallbackRequest(
    new Request("https://kyra.test/callback?code=secret"),
    () => "true",
  );
  const text = await response.text();

  if (response.status !== 503) throw new Error("Expected fail-closed 503.");
  if (
    !text.includes(
      '"result":"official_mcp_oauth_callback_not_implemented"',
    )
  ) {
    throw new Error("Expected fixed callback not-implemented result.");
  }
  if (text.includes("secret")) throw new Error("Callback query leaked.");
});
