import {
  assertOwnedAgent,
  assertTradeRulesRequest,
  describeRuleChange,
  readTradeRuleRows,
} from "./core.ts";

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function assertThrowsCode(run: () => unknown, code: string) {
  try {
    run();
  } catch (error) {
    assertEquals((error as { code?: string }).code, code);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

const agentId = "F6B9CBAB-A55E-4F4D-B2B2-A1B53D2ACA46";
const ruleId = "0E7C51B2-6D0A-4E8B-9F3C-2A1B5C6D7E8F";

Deno.test("trade rule requests take exactly the fields each action needs", () => {
  const list = assertTradeRulesRequest({ agentId, action: "list" });
  assertEquals(list.agentId, agentId.toLowerCase());
  assertEquals(list.ruleId, null);

  const pause = assertTradeRulesRequest({ agentId, action: "pause", ruleId });
  assertEquals(pause.ruleId, ruleId.toLowerCase());

  for (
    const bad of [
      { agentId, action: "list", ruleId },
      { agentId, action: "delete" },
      { agentId, action: "add", ruleId },
      { agentId: "x", action: "list" },
      { agentId, action: "resume", ruleId: "x" },
      { agentId, action: "pause", ruleId, extra: true },
      null,
    ]
  ) {
    assertThrowsCode(() => assertTradeRulesRequest(bad), "invalid_request");
  }
});

Deno.test("only the workspace owner can manage an agent's rules", () => {
  assertEquals(assertOwnedAgent({ id: "a" }, "owner", "owner").id, "a");
  assertThrowsCode(() => assertOwnedAgent({ id: "a" }, "owner", "someone-else"), "agent_not_found");
  assertThrowsCode(() => assertOwnedAgent(null, undefined, "owner"), "agent_not_found");
});

Deno.test("rule rows are shaped for the dashboard and malformed rows are dropped", () => {
  const rules = readTradeRuleRows([
    {
      id: "r1",
      kind: "stop_loss",
      sell_token_symbol: "ETH",
      buy_token_symbol: "USDG",
      sell_amount_atomic: "100000000000000",
      interval_hours: null,
      trigger_price_usd: 2000,
      next_run_at: null,
      last_triggered_at: null,
      enabled: true,
      created_at: "2026-10-23T00:00:00Z",
    },
    { id: "r2", kind: "market_buy", enabled: true },
  ]);
  assertEquals(rules.length, 1);
  assertEquals(rules[0].triggerPriceUsd, "2000");
  assertEquals(rules[0].intervalHours, null);
});

Deno.test("database answers map to owner messages", () => {
  assertEquals(describeRuleChange("delete", "deleted"), "Rule deleted.");
  assertEquals(describeRuleChange("pause", "unchanged"), "Rule paused.");
  assertThrowsCode(() => describeRuleChange("resume", "limit_reached"), "rule_limit_reached");
  assertThrowsCode(() => describeRuleChange("delete", "not_found"), "rule_not_found");
});
