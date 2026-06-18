import {
  baseMcpProviderProtocol,
  maxBaseMcpProviderResponseBytes,
  readBaseMcpProviderStatusResponse,
} from "./provider-contract.ts";

function assertEquals<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(
      `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

async function assertRejects(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    assertEquals(
      error instanceof Error ? error.message : "",
      "Base MCP provider response is invalid.",
    );
    return;
  }

  throw new Error("Expected provider contract rejection.");
}

const requestId = "base-status:11111111-1111-4111-8111-111111111111";

function validResponse(overrides: Record<string, unknown> = {}) {
  return Response.json({
    protocol: baseMcpProviderProtocol,
    status: "ok",
    actionKind: "base_mcp_status_check",
    chain: "base",
    mode: "read_only",
    requestId,
    ...overrides,
  });
}

Deno.test("Base MCP provider response accepts only exact bound status contract", async () => {
  const result = await readBaseMcpProviderStatusResponse(
    validResponse(),
    requestId,
  );

  assertEquals(result.protocol, "kyra_status_v1");
  assertEquals(result.requestId, requestId);

  const charsetResult = await readBaseMcpProviderStatusResponse(
    new Response(
      JSON.stringify({
        protocol: baseMcpProviderProtocol,
        status: "ok",
        actionKind: "base_mcp_status_check",
        chain: "base",
        mode: "read_only",
        requestId,
      }),
      {
        headers: { "content-type": "application/json; charset=utf-8" },
      },
    ),
    requestId,
  );
  assertEquals(charsetResult.status, "ok");
});

Deno.test("Base MCP provider response rejects mismatches and extra fields", async () => {
  for (
    const response of [
      validResponse({ protocol: "mcp" }),
      validResponse({ requestId: "base-status:wrong-request" }),
      validResponse({ status: "ready" }),
      validResponse({ chain: "ethereum" }),
      validResponse({ mode: "write" }),
      validResponse({ rawCalldata: "0xdeadbeef" }),
    ]
  ) {
    await assertRejects(() =>
      readBaseMcpProviderStatusResponse(response, requestId)
    );
  }
});

Deno.test("Base MCP provider response requires JSON and bounded body", async () => {
  await assertRejects(() =>
    readBaseMcpProviderStatusResponse(
      new Response("not-json", {
        headers: { "content-type": "text/plain" },
      }),
      requestId,
    )
  );
  await assertRejects(() =>
    readBaseMcpProviderStatusResponse(
      new Response("{}", {
        headers: { "content-type": "application/json-evil" },
      }),
      requestId,
    )
  );
  await assertRejects(() =>
    readBaseMcpProviderStatusResponse(
      new Response("x".repeat(maxBaseMcpProviderResponseBytes + 1), {
        headers: { "content-type": "application/json" },
      }),
      requestId,
    )
  );
  await assertRejects(() =>
    readBaseMcpProviderStatusResponse(
      new Response("{}", {
        headers: {
          "content-type": "application/json",
          "content-length": String(maxBaseMcpProviderResponseBytes + 1),
        },
      }),
      requestId,
    )
  );
});
