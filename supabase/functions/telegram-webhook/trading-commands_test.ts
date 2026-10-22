import { handleTradingCommand, type TradingRpcClient } from "./trading-commands.ts";
import { readMiniAppButton } from "./response-delivery.ts";

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const agentId = "f6b9cbab-a55e-4f4d-b2b2-a1b53d2aca46";
const miniAppUrl = "https://kyraagent.xyz/tg";

function rpc(responses: Record<string, unknown> = {}) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client: TradingRpcClient = {
    rpc(name, args) {
      calls.push({ name, args });
      return { data: responses[name] ?? null, error: null };
    },
  };
  return { client, calls };
}

Deno.test("/swap replies with a Mini App button carrying the exact atomic amount", async () => {
  const { client, calls } = rpc();
  const reply = await handleTradingCommand({ command: "swap", args: "0.0005 eth", agentId, rpcClient: client, miniAppUrl });

  assertEquals(calls.length, 0, "/swap stores nothing.");
  assert(reply.text.startsWith("Swap 0.0005 ETH to USDG"), reply.text);
  const url = new URL(reply.button!.url);
  assertEquals(url.pathname, "/tg");
  assertEquals(url.searchParams.get("agent"), agentId);
  assertEquals(url.searchParams.get("sell"), "ETH");
  assertEquals(url.searchParams.get("amount"), "500000000000000");
  assertEquals(reply.button!.text, "Review & swap");
});

Deno.test("/swap refuses amounts over the cap, extra decimals, and unknown tokens", async () => {
  const { client } = rpc();
  const over = await handleTradingCommand({ command: "swap", args: "0.006 ETH", agentId, rpcClient: client, miniAppUrl });
  assertEquals(over.button, undefined);
  assert(over.text.includes("0.005 ETH"), over.text);

  const precise = await handleTradingCommand({ command: "swap", args: "1.0000001 USDG", agentId, rpcClient: client, miniAppUrl });
  assert(precise.text.includes("6 decimal places"), precise.text);

  const unknown = await handleTradingCommand({ command: "swap", args: "5 DOGE", agentId, rpcClient: client, miniAppUrl });
  assert(unknown.text.startsWith("Send /swap"), unknown.text);
});

Deno.test("/dca stores a daily or weekly rule and never trades", async () => {
  const { client, calls } = rpc({ add_agent_trade_rule: "added" });
  const reply = await handleTradingCommand({ command: "dca", args: "1 USDG weekly", agentId, rpcClient: client, miniAppUrl });

  assertEquals(calls[0].name, "add_agent_trade_rule");
  assertEquals(calls[0].args.p_kind, "dca");
  assertEquals(calls[0].args.p_sell_token_symbol, "USDG");
  assertEquals(calls[0].args.p_buy_token_symbol, "ETH");
  assertEquals(calls[0].args.p_sell_amount_atomic, "1000000");
  assertEquals(calls[0].args.p_interval_hours, 168);
  assert(reply.text.includes("Nothing trades without you"), reply.text);
  assertEquals(reply.button, undefined);

  const bad = await handleTradingCommand({ command: "dca", args: "1 USDG hourly", agentId, rpcClient: client, miniAppUrl });
  assert(bad.text.startsWith("Send /dca"), bad.text);
});

Deno.test("/stoploss and /takeprofit store ETH price triggers", async () => {
  const { client, calls } = rpc({ add_agent_trade_rule: "added" });
  const stop = await handleTradingCommand({ command: "stoploss", args: "2300 0.002", agentId, rpcClient: client, miniAppUrl });
  assertEquals(calls[0].args.p_kind, "stop_loss");
  assertEquals(calls[0].args.p_trigger_price_usd, 2300);
  assertEquals(calls[0].args.p_sell_amount_atomic, "2000000000000000");
  assert(stop.text.includes("falls to $2,300"), stop.text);

  await handleTradingCommand({ command: "takeprofit", args: "3000 0.001", agentId, rpcClient: client, miniAppUrl });
  assertEquals(calls[1].args.p_kind, "take_profit");

  const bad = await handleTradingCommand({ command: "stoploss", args: "abc", agentId, rpcClient: client, miniAppUrl });
  assert(bad.text.startsWith("Send /stoploss"), bad.text);
});

Deno.test("trade rules report the five-rule limit and list what is set", async () => {
  const limited = rpc({ add_agent_trade_rule: "limit_reached" });
  const reply = await handleTradingCommand({ command: "dca", args: "0.001 ETH daily", agentId, rpcClient: limited.client, miniAppUrl });
  assert(reply.text.includes("5 swap rules"), reply.text);

  const listed = rpc({
    list_agent_trade_rules: [
      { kind: "dca", sell: "ETH", buy: "USDG", amount: "500000000000000", interval_hours: 24 },
      { kind: "stop_loss", sell: "ETH", buy: "USDG", amount: "2000000000000000", trigger_price_usd: 2300 },
    ],
  });
  const list = await handleTradingCommand({ command: "rules", args: "", agentId, rpcClient: listed.client, miniAppUrl });
  assert(list.text.includes("- DCA 0.0005 ETH to USDG daily"), list.text);
  assert(list.text.includes("- Stop-loss: sell 0.002 ETH to USDG if ETH falls to $2,300"), list.text);
});

Deno.test("Mini App buttons may only open the Kyra Mini App over https", () => {
  assertEquals(readMiniAppButton(undefined), null);
  assertEquals(
    readMiniAppButton({ text: "Review & swap", url: "https://kyraagent.xyz/tg?agent=x" })?.url,
    "https://kyraagent.xyz/tg?agent=x",
  );
  for (
    const url of [
      "http://kyraagent.xyz/tg",
      "https://evil.example/tg",
      "https://kyraagent.xyz/dashboard",
      "https://user:pass@kyraagent.xyz/tg",
      "javascript:alert(1)",
    ]
  ) {
    let refused = false;
    try {
      readMiniAppButton({ text: "Open", url });
    } catch {
      refused = true;
    }
    assert(refused, `${url} must be refused`);
  }
});
