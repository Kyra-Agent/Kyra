import { createBaseMcpStatusCheckAdapter } from "./provider-adapter.ts";
import { normalizeBaseMcpEndpoint } from "./runtime-config.ts";

function assert(condition: boolean, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

function assertFailure(
  result: { ok: boolean; code?: unknown; message?: unknown },
): asserts result is { ok: false; code: string; message: string } {
  if (result.ok !== false) {
    throw new Error("Expected Base MCP adapter failure.");
  }
}

const runtimeConfig = {
  enabled: true,
  endpoint: "https://base-mcp.test/v1",
  providerProtocol: "kyra_status_v1",
  apiKey: null,
  timeoutMs: 2500,
} as const;

function validInput() {
  return {
    actionKind: "base_mcp_status_check",
    agentId: "11111111-1111-4111-8111-111111111111",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    requestId: "base-mcp-request-01",
    chain: "base",
    mode: "read_only",
    requestedAt: "2026-06-14T01:02:03.000Z",
  } as const;
}

function validProviderResponse() {
  return Response.json({
    protocol: "kyra_status_v1",
    status: "ok",
    actionKind: "base_mcp_status_check",
    chain: "base",
    mode: "read_only",
    requestId: validInput().requestId,
  });
}

Deno.test("Base MCP provider adapter sends only bounded status-check payload", async () => {
  const capturedRequests: Request[] = [];
  let capturedPayload = "";
  const adapter = createBaseMcpStatusCheckAdapter(async (request) => {
    capturedRequests.push(request);
    capturedPayload = await request.text();

    return validProviderResponse();
  });
  const result = await adapter(validInput(), runtimeConfig);
  const serializedResult = JSON.stringify(result);
  const capturedRequest = capturedRequests[0];

  assert(
    capturedRequest instanceof Request,
    "Transport must receive a request.",
  );
  assertEquals(capturedRequest.method, "POST");
  assertEquals(capturedRequest.url, "https://base-mcp.test/v1/status-check");
  assertEquals(capturedRequest.headers.get("accept"), "application/json");
  assertEquals(capturedRequest.headers.get("content-type"), "application/json");
  assertEquals(
    capturedRequest.headers.get("x-kyra-action-kind"),
    "base_mcp_status_check",
  );
  assertEquals(capturedRequest.headers.get("authorization"), null);
  assert(
    capturedPayload.includes("base_mcp_status_check"),
    "Payload needs action kind.",
  );
  assert(
    capturedPayload.includes("read_only"),
    "Payload needs read-only mode.",
  );
  assert(
    capturedPayload.includes("kyra_status_v1"),
    "Payload needs exact provider protocol.",
  );
  assert(
    !capturedPayload.includes("agentId"),
    "Provider payload must not include agent id.",
  );
  assert(
    !capturedPayload.includes("workspaceId"),
    "Provider payload must not include workspace id.",
  );
  assert(
    !capturedPayload.includes("ownerUserId"),
    "Provider payload must not include owner id.",
  );
  assert(
    !capturedPayload.includes("wallet"),
    "Provider payload must not include wallet data.",
  );
  assert(
    !capturedPayload.includes("telegram"),
    "Provider payload must not include Telegram token data.",
  );
  assertEquals(result.ok, true);
  assert(
    serializedResult.includes("No token spend, no gas request, no calldata."),
    "Adapter result should describe read-only no-calldata status.",
  );
  assert(
    !serializedResult.includes(validInput().requestId),
    "Result must hide request id.",
  );
});

Deno.test("Base MCP provider adapter preserves a provider function path", async () => {
  let capturedUrl = "";
  const adapter = createBaseMcpStatusCheckAdapter(async (request) => {
    capturedUrl = request.url;
    return validProviderResponse();
  });

  await adapter(validInput(), {
    enabled: true,
    endpoint:
      "https://project.supabase.co/functions/v1/base-mcp-status-provider/",
    apiKey: null,
    timeoutMs: 2500,
    providerProtocol: "kyra_status_v1",
  });

  assertEquals(
    capturedUrl,
    "https://project.supabase.co/functions/v1/base-mcp-status-provider/status-check",
  );
});

Deno.test("Base MCP provider adapter adds API key only as backend authorization header", async () => {
  let authorizationHeader: string | null = null;
  const adapter = createBaseMcpStatusCheckAdapter(async (request) => {
    authorizationHeader = request.headers.get("authorization");

    return validProviderResponse();
  });
  const result = await adapter(validInput(), {
    ...runtimeConfig,
    apiKey: "provider-secret-api-key",
  });
  const serializedResult = JSON.stringify(result);

  assertEquals(result.ok, true);
  assertEquals(authorizationHeader, "Bearer provider-secret-api-key");
  assert(
    !serializedResult.includes("provider-secret-api-key"),
    "Adapter result must never expose provider API key.",
  );
});

Deno.test("Base MCP provider adapter fails closed for unsupported action and missing endpoint", async () => {
  let transportCalls = 0;
  const adapter = createBaseMcpStatusCheckAdapter(async () => {
    transportCalls += 1;

    return validProviderResponse();
  });
  const unsupported = await adapter({
    ...validInput(),
    actionKind: "swap",
  } as never, runtimeConfig);
  const notConfigured = await adapter(validInput(), {
    ...runtimeConfig,
    endpoint: null,
  });

  assertFailure(unsupported);
  assertEquals(unsupported.code, "base_mcp_unknown_action");
  assertFailure(notConfigured);
  assertEquals(notConfigured.code, "base_mcp_not_configured");
  assertEquals(transportCalls, 0);
});

Deno.test("Base MCP custom adapter never calls the official OAuth MCP endpoint", async () => {
  let transportCalls = 0;
  const adapter = createBaseMcpStatusCheckAdapter(async () => {
    transportCalls += 1;
    return validProviderResponse();
  });
  const result = await adapter(validInput(), {
    ...runtimeConfig,
    endpoint: normalizeBaseMcpEndpoint("https://mcp.base.org/"),
  });

  assertFailure(result);
  assertEquals(result.code, "base_mcp_not_configured");
  assertEquals(transportCalls, 0);
});

Deno.test("Base MCP provider adapter sanitizes provider failures", async () => {
  for (
    const transport of [
      async () =>
        new Response("raw provider failure token_secret_ref", { status: 503 }),
      async () => new Response("not-json", { status: 200 }),
      async () => {
        throw new Error("KYRA_BASE_MCP_API_KEY raw provider payload leaked");
      },
    ]
  ) {
    const adapter = createBaseMcpStatusCheckAdapter(transport);
    const result = await adapter(validInput(), runtimeConfig);
    const serialized = JSON.stringify(result);

    assertFailure(result);
    assertEquals(result.code, "base_mcp_unavailable");
    assertEquals(
      result.message,
      "No Base MCP action can be prepared right now.",
    );
    assert(
      !serialized.includes("token_secret_ref"),
      "Adapter failure must hide token refs.",
    );
    assert(
      !serialized.includes("KYRA_BASE_MCP_API_KEY"),
      "Adapter failure must hide API key names.",
    );
    assert(
      !serialized.includes("raw provider payload"),
      "Adapter failure must hide raw provider errors.",
    );
  }
});

Deno.test("Base MCP provider adapter maps transport abort to timeout", async () => {
  const adapter = createBaseMcpStatusCheckAdapter(async () => {
    throw new DOMException("The operation was aborted.", "AbortError");
  });
  const result = await adapter(validInput(), runtimeConfig);

  assertFailure(result);
  assertEquals(result.code, "base_mcp_timeout");
  assertEquals(result.message, "Base MCP preparation timed out.");
});
