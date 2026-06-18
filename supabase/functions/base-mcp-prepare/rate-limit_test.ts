import {
  baseMcpStatusHourMax,
  baseMcpStatusMinuteMax,
  createBaseMcpStatusRateLimitChecker,
  readBaseMcpRateLimitDecision,
} from "./rate-limit.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const ownerUserId = "33333333-3333-4333-8333-333333333333";
const workspaceId = "22222222-2222-4222-8222-222222222222";
const agentId = "11111111-1111-4111-8111-111111111111";

Deno.test("Base MCP rate-limit policy uses conservative read-only caps", () => {
  assertEquals(baseMcpStatusMinuteMax, 6);
  assertEquals(baseMcpStatusHourMax, 60);
});

Deno.test("Base MCP rate-limit checker calls exact service-role RPC", async () => {
  const calls: Array<{
    functionName: string;
    args: Record<string, unknown>;
  }> = [];
  const checker = createBaseMcpStatusRateLimitChecker({
    async rpc(functionName, args) {
      calls.push({ functionName, args });
      return {
        data: [{ allowed: true, status: "allowed" }],
        error: null,
      };
    },
  });
  const decision = await checker({ ownerUserId, workspaceId, agentId });

  assertEquals(decision.allowed, true);
  assertEquals(calls.length, 1);
  assertEquals(
    calls[0].functionName,
    "consume_base_mcp_status_rate_limit",
  );
  assertEquals(calls[0].args.p_owner_user_id, ownerUserId);
  assertEquals(calls[0].args.p_workspace_id, workspaceId);
  assertEquals(calls[0].args.p_agent_id, agentId);
  assert(
    !JSON.stringify(calls[0]).includes("requestId"),
    "Rate-limit RPC must not store client request identifiers.",
  );
});

Deno.test("Base MCP rate-limit checker returns one bounded denial", async () => {
  const checker = createBaseMcpStatusRateLimitChecker({
    async rpc() {
      return {
        data: [{ allowed: false, status: "rate_limited" }],
        error: null,
      };
    },
  });
  const decision = await checker({ ownerUserId, workspaceId, agentId });

  assertEquals(decision.allowed, false);
  assertEquals(decision.status, "rate_limited");
});

Deno.test("Base MCP rate-limit checker fails closed on RPC and contract errors", async () => {
  for (
    const result of [
      { data: null, error: null },
      { data: [], error: null },
      {
        data: [{ allowed: true, status: "rate_limited" }],
        error: null,
      },
      {
        data: [{ allowed: true, status: "allowed", count: 1 }],
        error: null,
      },
      { data: null, error: { message: "raw database error" } },
    ]
  ) {
    const checker = createBaseMcpStatusRateLimitChecker({
      async rpc() {
        return result;
      },
    });

    try {
      await checker({ ownerUserId, workspaceId, agentId });
      throw new Error("Invalid limiter response must fail closed.");
    } catch (error) {
      assertEquals(
        (error as Error).message,
        "Base MCP rate limit check failed.",
      );
    }
  }
});

Deno.test("Base MCP rate-limit decision reader rejects unbounded rows", () => {
  for (
    const value of [
      null,
      {},
      [],
      [{ allowed: true }],
      [{ allowed: false, status: "blocked" }],
      [
        { allowed: true, status: "allowed" },
        { allowed: true, status: "allowed" },
      ],
    ]
  ) {
    try {
      readBaseMcpRateLimitDecision(value);
      throw new Error("Invalid rate-limit decision must be rejected.");
    } catch (error) {
      assertEquals(
        (error as Error).message,
        "Base MCP rate limit response is invalid.",
      );
    }
  }
});
