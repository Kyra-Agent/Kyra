import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { backendChainRegistry } from "../_shared/chain-runtime.ts";
import { chainStatusProviderProtocol } from "../chain-status-provider/core.ts";
import type { ChainActionPrepareRequest } from "./core.ts";
import { createChainStatusCheckAdapter } from "./provider-adapter.ts";

const sharedSecret = "provider-secret-that-must-never-leak";
const input: ChainActionPrepareRequest = {
  actionKind: "chain_status_check",
  agentId: "11111111-1111-4111-8111-111111111111",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  requestId: "chain-status:request-1234",
  chainKey: "robinhood_testnet",
  chainId: 46630,
  mode: "read_only",
  requestedAt: "2026-07-22T10:00:00.000Z",
};

const runtimeConfig = {
  enabled: true as const,
  endpoint: "https://project.supabase.co/functions/v1/chain-status-provider",
  sharedSecret,
  timeoutMs: 250,
  providerProtocol: chainStatusProviderProtocol,
  chain: backendChainRegistry.robinhood_testnet,
};

function providerResponse(overrides: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({
    protocol: chainStatusProviderProtocol,
    status: "ok",
    actionKind: "chain_status_check",
    chainKey: input.chainKey,
    chainId: input.chainId,
    mode: input.mode,
    requestId: input.requestId,
    ...overrides,
  }), { headers: { "content-type": "application/json" } });
}

Deno.test("chain status adapter sends the exact bounded provider request", async () => {
  let observed: Request | undefined;
  const adapter = createChainStatusCheckAdapter(async (request) => {
    observed = request;
    return providerResponse();
  });

  const result = await adapter(input, runtimeConfig);
  assert(result.ok);
  assertEquals(result.status, "preview_ready");
  assertEquals(
    observed?.url,
    "https://project.supabase.co/functions/v1/chain-status-provider/status-check",
  );
  assertEquals(observed?.method, "POST");
  assertEquals(observed?.headers.get("authorization"), `Bearer ${sharedSecret}`);
  assertEquals(observed?.headers.get("x-kyra-action-kind"), "chain_status_check");
  assertEquals(await observed?.json(), {
    actionKind: input.actionKind,
    protocol: chainStatusProviderProtocol,
    chainKey: input.chainKey,
    chainId: input.chainId,
    mode: input.mode,
    requestId: input.requestId,
    requestedAt: input.requestedAt,
  });
  assert(!JSON.stringify(result).includes(sharedSecret));
});

Deno.test("chain status adapter fails closed on response drift without leaking provider data", async () => {
  const adapter = createChainStatusCheckAdapter(async () =>
    providerResponse({
      chainId: 4663,
      providerDetail: sharedSecret,
    })
  );
  const result = await adapter(input, runtimeConfig);
  assertEquals(result, {
    ok: false,
    status: "failed",
    code: "chain_action_unavailable",
    message: "No chain action can be prepared right now.",
  });
  assert(!JSON.stringify(result).includes(sharedSecret));
});

Deno.test("chain status adapter aborts a stalled provider", async () => {
  let aborted = false;
  const adapter = createChainStatusCheckAdapter((request) =>
    new Promise<Response>((_resolve, reject) => {
      request.signal.addEventListener("abort", () => {
        aborted = true;
        reject(new DOMException("Aborted", "AbortError"));
      }, { once: true });
    })
  );

  const result = await adapter(input, runtimeConfig);
  assertEquals(aborted, true);
  assertEquals(result, {
    ok: false,
    status: "failed",
    code: "chain_action_timeout",
    message: "Chain action preparation timed out.",
  });
});

Deno.test("chain status adapter stays blocked when configuration is incomplete", async () => {
  let called = false;
  const adapter = createChainStatusCheckAdapter(async () => {
    called = true;
    return providerResponse();
  });
  const result = await adapter(input, { ...runtimeConfig, sharedSecret: null });
  assertEquals(result.status, "blocked");
  assertEquals(called, false);
});
