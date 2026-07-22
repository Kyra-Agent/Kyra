import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  chainActionHourMax,
  chainActionMinuteMax,
  createChainActionRateLimitChecker,
  readChainActionRateLimitDecision,
} from "./rate-limit.ts";

const scope = {
  ownerUserId: "33333333-3333-4333-8333-333333333333",
  workspaceId: "22222222-2222-4222-8222-222222222222",
  agentId: "11111111-1111-4111-8111-111111111111",
  chainKey: "robinhood_testnet",
};

Deno.test("chain action limiter uses conservative caps and exact scope", async () => {
  assertEquals(chainActionMinuteMax, 6);
  assertEquals(chainActionHourMax, 60);
  let call: unknown;
  const checker = createChainActionRateLimitChecker({
    async rpc(functionName, args) {
      call = { functionName, args };
      return { data: [{ allowed: true, status: "allowed" }], error: null };
    },
  });
  assertEquals((await checker(scope)).allowed, true);
  assertEquals(call, {
    functionName: "consume_chain_action_rate_limit",
    args: {
      p_owner_user_id: scope.ownerUserId,
      p_workspace_id: scope.workspaceId,
      p_agent_id: scope.agentId,
      p_chain_key: scope.chainKey,
    },
  });
});

Deno.test("chain action limiter fails closed on malformed RPC results", async () => {
  for (const value of [null, [], [{ allowed: true }], [{ allowed: true, status: "rate_limited" }]]) {
    assertRejects(
      () => createChainActionRateLimitChecker({
        async rpc() {
          return { data: value, error: null };
        },
      })(scope),
      Error,
      "Chain action rate limit check failed.",
    );
  }
  assertEquals(
    readChainActionRateLimitDecision([{ allowed: false, status: "rate_limited" }]),
    { allowed: false, status: "rate_limited" },
  );
});
