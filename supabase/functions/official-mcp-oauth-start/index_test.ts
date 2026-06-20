import { handleOfficialMcpOauthStartRequest } from "./index.ts";

Deno.test("official MCP OAuth start stays disabled without reading request body", async () => {
  const request = secretBearingRequest("https://kyra.test/start?code=secret");
  const response = handleOfficialMcpOauthStartRequest(request, () => "");

  await assertDisabledResponse(
    response,
    "official_mcp_oauth_start_disabled",
  );
  assertBodyUnread(request);
});

Deno.test("official MCP OAuth start has no enabled implementation", async () => {
  const response = handleOfficialMcpOauthStartRequest(
    secretBearingRequest("https://kyra.test/start?state=secret"),
    () => "true",
  );

  await assertNotImplementedResponse(
    response,
    "official_mcp_oauth_start_not_implemented",
  );
});

function secretBearingRequest(url: string) {
  return new Request(url, {
    method: "POST",
    body: JSON.stringify({
      authorization_code: "secret-code",
      access_token: "secret-token",
    }),
  });
}

function assertBodyUnread(request: Request) {
  if (request.bodyUsed) throw new Error("Request body must remain unread.");
}

async function assertDisabledResponse(response: Response, result: string) {
  await assertResponse(response, 403, result);
}

async function assertNotImplementedResponse(response: Response, result: string) {
  await assertResponse(response, 503, result);
}

async function assertResponse(
  response: Response,
  status: number,
  result: string,
) {
  const text = await response.text();
  if (response.status !== status) throw new Error(`Expected ${status}.`);
  if (!text.includes(`"result":"${result}"`)) {
    throw new Error(`Expected result ${result}.`);
  }
  for (const forbidden of ["secret-code", "secret-token", "kyra.test"]) {
    if (text.includes(forbidden)) throw new Error(`Leaked ${forbidden}.`);
  }
}
