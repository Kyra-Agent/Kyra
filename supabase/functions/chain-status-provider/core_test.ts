import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { backendChainRegistry } from "../_shared/chain-runtime.ts";
import {
  chainStatusProviderProtocol,
  handleChainStatusProviderRequest,
  normalizeChainRpcUrl,
} from "./core.ts";

const secret = "provider-secret-at-least-thirty-two-characters";
const now = new Date("2026-07-22T10:00:00.000Z");

function request(overrides: Record<string, unknown> = {}, authorization = `Bearer ${secret}`) {
  return new Request("https://provider.test/status-check", {
    method: "POST",
    headers: { authorization, "content-type": "application/json" },
    body: JSON.stringify({
      actionKind: "chain_status_check",
      protocol: chainStatusProviderProtocol,
      chainKey: "robinhood_testnet",
      chainId: 46630,
      mode: "read_only",
      requestId: "chain-status:request-1234",
      requestedAt: now.toISOString(),
      ...overrides,
    }),
  });
}

function dependencies(fetchRpc: typeof fetch) {
  return {
    runtimeConfig: {
      enabled: true as const,
      expectedBearerSecret: secret,
      rpcUrl: "https://rpc.testnet.chain.robinhood.com",
      providerKind: "robinhood_public_testnet" as const,
      allowedRpcHosts: [] as const,
      chain: backendChainRegistry.robinhood_testnet,
    },
    getNow: () => now,
    fetchRpc,
  };
}

Deno.test("chain status provider stays inert while disabled", async () => {
  let rpcCalls = 0;
  const response = await handleChainStatusProviderRequest(request(), {
    runtimeConfig: { enabled: false },
    fetchRpc: async () => {
      rpcCalls += 1;
      return new Response();
    },
  });
  assertEquals(response.status, 501);
  assertEquals(rpcCalls, 0);
});

Deno.test("chain status provider returns exact bounded testnet result", async () => {
  let rpcBody = "";
  const response = await handleChainStatusProviderRequest(
    request(),
    dependencies(async (_input, init) => {
      rpcBody = String((init as RequestInit | undefined)?.body ?? "");
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: "kyra-chain-status",
        result: "0xb626",
      }), { headers: { "content-type": "application/json" } });
    }),
  );
  assertEquals(response.status, 200);
  assertEquals(
    Object.keys(await response.clone().json()).sort().join(","),
    "actionKind,chainId,chainKey,mode,protocol,requestId,status",
  );
  assert(rpcBody.includes('"method":"eth_chainId"'));
  assertEquals(response.headers.get("cache-control"), "no-store");
});

Deno.test("chain status provider rejects auth, drift, and malformed RPC before disclosure", async () => {
  let calls = 0;
  const fetchRpc = async () => {
    calls += 1;
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: "kyra-chain-status",
      result: "0x1",
    }), { headers: { "content-type": "application/json" } });
  };

  assertEquals(
    (await handleChainStatusProviderRequest(request({}, ""), dependencies(fetchRpc))).status,
    401,
  );
  assertEquals(calls, 0);

  for (const overrides of [
    { chainId: 4663 },
    { chainKey: "robinhood_mainnet" },
    { mode: "write" },
    { extra: true },
    { requestedAt: "2026-07-22T09:58:00.000Z" },
  ]) {
    assertEquals(
      (await handleChainStatusProviderRequest(request(overrides), dependencies(fetchRpc))).status,
      400,
    );
  }

  const wrongRpc = await handleChainStatusProviderRequest(request(), dependencies(fetchRpc));
  assertEquals(wrongRpc.status, 503);
  assert(!(await wrongRpc.text()).includes("0x1"));
});

Deno.test("chain RPC normalization allows testnet smoke and allowlisted private providers only", () => {
  assertEquals(
    normalizeChainRpcUrl(
      "https://rpc.testnet.chain.robinhood.com",
      "robinhood_public_testnet",
      [],
      "robinhood_testnet",
    ),
    "https://rpc.testnet.chain.robinhood.com/",
  );
  assertEquals(
    normalizeChainRpcUrl(
      "https://rpc.kyra-provider.example/v2/private-key-path",
      "managed_private",
      ["rpc.kyra-provider.example"],
      "robinhood_mainnet",
    ),
    "https://rpc.kyra-provider.example/v2/private-key-path",
  );

  for (const input of [
    ["http://rpc.kyra-provider.example", "managed_private", ["rpc.kyra-provider.example"], "robinhood_mainnet"],
    ["https://rpc.mainnet.chain.robinhood.com", "managed_private", ["rpc.mainnet.chain.robinhood.com"], "robinhood_mainnet"],
    ["https://rpc.testnet.chain.robinhood.com", "robinhood_public_testnet", [], "robinhood_mainnet"],
    ["https://rpc.other.example", "managed_private", ["rpc.kyra-provider.example"], "robinhood_mainnet"],
  ] as const) {
    let failed = false;
    try {
      normalizeChainRpcUrl(input[0], input[1], input[2], input[3]);
    } catch {
      failed = true;
    }
    assert(failed);
  }
});
