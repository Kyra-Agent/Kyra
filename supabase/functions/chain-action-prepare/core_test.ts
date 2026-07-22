import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { backendChainRegistry } from "../_shared/chain-runtime.ts";
import { chainStatusProviderProtocol } from "../chain-status-provider/core.ts";
import {
  type ChainActionPrepareDependencies,
  handleChainActionPrepareRequest,
} from "./core.ts";

const now = new Date("2026-07-22T10:00:00.000Z");
const ownerUserId = "33333333-3333-4333-8333-333333333333";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const agentId = "11111111-1111-4111-8111-111111111111";

function request(overrides: Record<string, unknown> = {}) {
  return new Request(
    "https://project.supabase.co/functions/v1/chain-action-prepare",
    {
      method: "POST",
      headers: {
        authorization: "Bearer user-jwt",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        actionKind: "chain_status_check",
        agentId,
        workspaceId,
        requestId: "chain-status:request-1234",
        chainKey: "robinhood_testnet",
        chainId: 46630,
        mode: "read_only",
        requestedAt: now.toISOString(),
        ...overrides,
      }),
    },
  );
}

function dependencies(
  overrides: Partial<ChainActionPrepareDependencies> = {},
): ChainActionPrepareDependencies {
  return {
    runtimeConfig: {
      enabled: true,
      endpoint:
        "https://project.supabase.co/functions/v1/chain-status-provider",
      sharedSecret: "x".repeat(32),
      timeoutMs: 2500,
      providerProtocol: chainStatusProviderProtocol,
      chain: backendChainRegistry.robinhood_testnet,
    },
    getEnv: (key) => `env-${key}`,
    getUser: async () => ({ id: ownerUserId }),
    lookupAgentOwnership: async () => ({
      agentId,
      ownerUserId,
      workspaceId,
      chainKey: "robinhood_testnet",
      chainActionStatus: "ready",
    }),
    checkRateLimit: async () => ({ allowed: true, status: "allowed" }),
    prepareChainAction: async (input) => ({
      ok: true,
      status: "preview_ready",
      summary: {
        actionKind: input.actionKind,
        chainKey: input.chainKey,
        chainId: input.chainId,
        chainName: "Robinhood Chain Testnet",
        routeSummary: "Robinhood Chain Testnet status check only.",
        valueSummary: "No token spend, gas request, calldata, or signature.",
        risk: "read-only",
        expiryIso: null,
      },
    }),
    storePreparedAction: async () => ({ ok: true }),
    getNow: () => now,
    ...overrides,
  };
}

Deno.test("chain prepare is inert while disabled before auth or body reads", async () => {
  let touched = false;
  const response = await handleChainActionPrepareRequest(request(), {
    runtimeConfig: { enabled: false },
    getEnv: () => {
      touched = true;
      return "";
    },
  });
  assertEquals(response.status, 501);
  assertEquals(touched, false);
});

Deno.test("chain prepare verifies ownership, rate limit, provider, and storage", async () => {
  let stored: unknown;
  const response = await handleChainActionPrepareRequest(
    request(),
    dependencies({
      storePreparedAction: async (input) => {
        stored = input;
        return { ok: true };
      },
    }),
  );
  assertEquals(response.status, 200);
  assertEquals(
    response.headers.get("access-control-expose-headers"),
    "x-kyra-request-id",
  );
  assertEquals(
    response.headers.get("x-kyra-request-id"),
    "chain-status:request-1234",
  );
  const body = await response.json();
  assertEquals(body.status, "preview_ready");
  assertEquals((stored as { ownerUserId: string }).ownerUserId, ownerUserId);
  assert(!JSON.stringify(body).includes(ownerUserId));
  assert(!JSON.stringify(body).includes(workspaceId));
});

Deno.test("chain prepare fails closed on chain, ownership, and limiter drift", async () => {
  assertEquals(
    (await handleChainActionPrepareRequest(
      request({ chainId: 4663 }),
      dependencies(),
    )).status,
    400,
  );
  assertEquals(
    (await handleChainActionPrepareRequest(
      request(),
      dependencies({
        lookupAgentOwnership: async () => ({
          agentId,
          ownerUserId,
          workspaceId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          chainKey: "robinhood_testnet",
          chainActionStatus: "ready",
        }),
      }),
    )).status,
    403,
  );
  assertEquals(
    (await handleChainActionPrepareRequest(
      request(),
      dependencies({
        lookupAgentOwnership: async () => ({
          agentId,
          ownerUserId,
          workspaceId,
          chainKey: "base",
          chainActionStatus: "ready",
        }),
      }),
    )).status,
    409,
  );
  for (const chainActionStatus of ["disabled", "paused"] as const) {
    assertEquals(
      (await handleChainActionPrepareRequest(
        request(),
        dependencies({
          lookupAgentOwnership: async () => ({
            agentId,
            ownerUserId,
            workspaceId,
            chainKey: "robinhood_testnet",
            chainActionStatus,
          }),
        }),
      )).status,
      409,
    );
  }
  assertEquals(
    (await handleChainActionPrepareRequest(
      request(),
      dependencies({
        checkRateLimit: async () => ({
          allowed: false,
          status: "rate_limited",
        }),
      }),
    )).status,
    429,
  );
});

Deno.test("chain prepare sanitizes provider and storage failures", async () => {
  for (
    const overrides of [
      {
        prepareChainAction: async () => {
          throw new Error("raw provider secret");
        },
      },
      {
        storePreparedAction: async () => {
          throw new Error("raw database row");
        },
      },
    ] as Partial<ChainActionPrepareDependencies>[]
  ) {
    const response = await handleChainActionPrepareRequest(
      request(),
      dependencies(overrides),
    );
    assertEquals(response.status, 502);
    const serialized = await response.text();
    assert(!serialized.includes("raw provider"));
    assert(!serialized.includes("raw database"));
  }
});
