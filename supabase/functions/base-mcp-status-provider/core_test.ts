import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  baseMainnetChainId,
  handleBaseMcpStatusProviderRequest,
  normalizeBaseRpcUrl,
} from "./core.ts";

const providerSecret = "provider-secret-at-least-thirty-two-characters";
const now = new Date("2026-06-19T10:00:00.000Z");

function createRequest(
  overrides: Record<string, unknown> = {},
  authorization = `Bearer ${providerSecret}`,
) {
  return new Request("https://provider.test/status-check", {
    method: "POST",
    headers: {
      authorization,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      actionKind: "base_mcp_status_check",
      protocol: "kyra_status_v1",
      chain: "base",
      mode: "read_only",
      requestId: "base-status:request-1234",
      requestedAt: now.toISOString(),
      ...overrides,
    }),
  });
}

function createDependencies(fetchRpc: typeof fetch) {
  return {
    expectedBearerSecret: providerSecret,
    baseRpcUrl: "https://mainnet.base.org",
    baseRpcProvider: "base_public_smoke",
    getNow: () => now,
    fetchRpc,
  };
}

Deno.test("status provider returns exact bounded contract after Base chain verification", async () => {
  let rpcBody = "";
  const response = await handleBaseMcpStatusProviderRequest(
    createRequest(),
    createDependencies(async (_input, init) => {
      rpcBody = String(
        (init as { body?: BodyInit | null } | undefined)?.body ?? "",
      );
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: "kyra-base-status",
        result: baseMainnetChainId,
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(
    Object.keys(await response.clone().json()).sort().join(","),
    "actionKind,chain,mode,protocol,requestId,status",
  );
  assert(rpcBody.includes('"method":"eth_chainId"'));
  assertEquals(response.headers.get("cache-control"), "no-store");
});

Deno.test("status provider rejects missing or incorrect bearer credentials before RPC", async () => {
  let rpcCalls = 0;
  const fetchRpc = async () => {
    rpcCalls += 1;
    return new Response();
  };

  for (const authorization of ["", "Bearer wrong-secret"]) {
    const response = await handleBaseMcpStatusProviderRequest(
      createRequest({}, authorization),
      createDependencies(fetchRpc),
    );

    assertEquals(response.status, 401);
  }

  assertEquals(rpcCalls, 0);
});

Deno.test("status provider rejects non-status paths before RPC", async () => {
  let rpcCalls = 0;
  const request = new Request("https://provider.test/other", {
    method: "POST",
    headers: {
      authorization: `Bearer ${providerSecret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      actionKind: "base_mcp_status_check",
      protocol: "kyra_status_v1",
      chain: "base",
      mode: "read_only",
      requestId: "base-status:request-1234",
      requestedAt: now.toISOString(),
    }),
  });
  const response = await handleBaseMcpStatusProviderRequest(
    request,
    createDependencies(async () => {
      rpcCalls += 1;
      return new Response();
    }),
  );

  assertEquals(response.status, 404);
  assertEquals(rpcCalls, 0);
});

Deno.test("status provider rejects extra fields, stale requests, and write modes", async () => {
  const fetchRpc = async () => new Response();

  for (
    const overrides of [
      { extra: true },
      { requestedAt: "2026-06-19T09:58:00.000Z" },
      { mode: "write" },
      { chain: "ethereum" },
    ]
  ) {
    const response = await handleBaseMcpStatusProviderRequest(
      createRequest(overrides),
      createDependencies(fetchRpc),
    );

    assertEquals(response.status, 400);
  }
});

Deno.test("status provider fails closed for wrong chain and malformed RPC responses", async () => {
  for (
    const rpcResponse of [
      new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: "kyra-base-status",
        result: "0x1",
      }), { headers: { "content-type": "application/json" } }),
      new Response("not-json", {
        headers: { "content-type": "application/json" },
      }),
      new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: "kyra-base-status",
        result: baseMainnetChainId,
      }), { headers: { "content-type": "text/plain" } }),
    ]
  ) {
    const response = await handleBaseMcpStatusProviderRequest(
      createRequest(),
      createDependencies(async () => rpcResponse),
    );

    assertEquals(response.status, 503);
    const serialized = await response.text();
    assert(!serialized.includes("0x1"));
    assert(!serialized.includes("not-json"));
  }
});

Deno.test("status provider requires HTTPS RPC URLs without embedded credentials", () => {
  assertEquals(
    normalizeBaseRpcUrl("https://mainnet.base.org", "base_public_smoke"),
    "https://mainnet.base.org/",
  );
  assertEquals(
    normalizeBaseRpcUrl(
      "https://api.developer.coinbase.com/rpc/v1/base/client_api_key_123456",
      "coinbase_cdp",
    ),
    "https://api.developer.coinbase.com/rpc/v1/base/client_api_key_123456",
  );

  for (const [value, provider] of [
    ["http://mainnet.base.org", "base_public_smoke"],
    ["https://user:password@mainnet.base.org", "base_public_smoke"],
    ["https://mainnet.base.org/?key=value", "base_public_smoke"],
    ["https://mainnet.base.org", "coinbase_cdp"],
    [
      "https://api.developer.coinbase.com/rpc/v1/ethereum/client_api_key_123456",
      "coinbase_cdp",
    ]
  ]) {
    let failed = false;

    try {
      normalizeBaseRpcUrl(value, provider);
    } catch {
      failed = true;
    }

    assert(failed);
  }
});
