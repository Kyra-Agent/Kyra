import { HttpError } from "./core.ts";
import { formatUsd } from "./prices.ts";
import type { TelegramWebhookParsedCommandName } from "./update-parser.ts";

// Owner-only Telegram commands for swaps. Nothing here trades: /swap and
// due rules reply with a button that opens the Kyra Mini App, where the
// owner reviews a live Uniswap quote and signs in their own wallet.

export type TradingCommand =
  | "swap"
  | "dca"
  | "stoploss"
  | "takeprofit"
  | "rules"
  | "rules_clear";

export interface MiniAppButton {
  text: string;
  url: string;
}

export interface TradingCommandReply {
  text: string;
  button?: MiniAppButton;
}

export interface TradingRpcClient {
  rpc(
    functionName: "add_agent_trade_rule" | "clear_agent_trade_rules" | "list_agent_trade_rules",
    args: Record<string, string | number | null>,
  ): Promise<{ data?: unknown; error?: unknown | null }> | {
    data?: unknown;
    error?: unknown | null;
  };
}

export interface TradingCommandInput {
  command: TradingCommand;
  args: string;
  agentId: string;
  rpcClient: TradingRpcClient;
  miniAppUrl: string;
  // The live ETH price the monitor triggers on; null or a failure when the
  // chain cannot be read, in which case the rule is stored unchecked.
  ethPriceUsd?: () => Promise<number | null>;
}

type SwapSymbol = "ETH" | "USDG";

const tradingCommands = new Set<string>([
  "swap",
  "dca",
  "stoploss",
  "takeprofit",
  "rules",
  "rules_clear",
]);
const tokens: Record<SwapSymbol, { decimals: number; max: bigint; maxLabel: string }> = {
  ETH: { decimals: 18, max: 5_000_000_000_000_000n, maxLabel: "0.005 ETH" },
  USDG: { decimals: 6, max: 12_500_000n, maxLabel: "12.5 USDG" },
};
export const defaultMiniAppUrl = "https://kyraagent.xyz/tg";

export const tradingTexts = {
  swapUsage: "Send /swap, an amount, and ETH or USDG. Example: /swap 0.0005 ETH",
  dcaUsage: "Send /dca, an amount, ETH or USDG, and daily or weekly. Example: /dca 0.0005 ETH daily",
  stopLossUsage: "Send /stoploss, an ETH price in USD, and how much ETH to sell. Example: /stoploss 2300 0.002",
  takeProfitUsage:
    "Send /takeprofit, an ETH price in USD, and how much ETH to sell. Example: /takeprofit 3000 0.002",
  failed: "I could not update your swap rules right now. Try again in a moment.",
  ownerOnly: "Swaps are set up by the agent owner in a private chat with me.",
};

export function isTradingCommand(
  command: TelegramWebhookParsedCommandName,
): command is TradingCommand {
  return tradingCommands.has(command);
}

// The Mini App reads the agent and the swap from the link; the backend
// still re-checks the owner, the amount caps, and the quote.
export function buildMiniAppUrl(
  base: string,
  params: { agentId: string; sell: SwapSymbol; amountAtomic: string; ruleId?: string },
) {
  const url = new URL(base);
  url.searchParams.set("agent", params.agentId);
  url.searchParams.set("sell", params.sell);
  url.searchParams.set("amount", params.amountAtomic);
  if (params.ruleId) url.searchParams.set("rule", params.ruleId);
  return url.toString();
}

export function formatAtomic(amountAtomic: string, symbol: SwapSymbol) {
  const decimals = tokens[symbol].decimals;
  const padded = amountAtomic.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals);
  const fraction = padded.slice(-decimals).replace(/0+$/u, "");
  return fraction ? `${whole}.${fraction}` : whole;
}

async function readEthPrice(input: TradingCommandInput) {
  if (!input.ethPriceUsd) return null;
  try {
    const price = await input.ethPriceUsd();
    return typeof price === "number" && Number.isFinite(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

export async function handleTradingCommand(input: TradingCommandInput): Promise<TradingCommandReply> {
  const parts = input.args.trim().split(/\s+/u).filter(Boolean);

  switch (input.command) {
    case "swap": {
      const amount = readAmount(parts[0], parts[1]);
      if (typeof amount === "string") return { text: amount || tradingTexts.swapUsage };
      const buy = amount.symbol === "ETH" ? "USDG" : "ETH";
      return {
        text: `Swap ${formatAtomic(amount.atomic, amount.symbol)} ${amount.symbol} to ${buy} on Uniswap. ` +
          "Tap Review & swap for a live quote, then confirm it in your own wallet.",
        button: {
          text: "Review & swap",
          url: buildMiniAppUrl(input.miniAppUrl, {
            agentId: input.agentId,
            sell: amount.symbol,
            amountAtomic: amount.atomic,
          }),
        },
      };
    }
    case "dca": {
      const amount = readAmount(parts[0], parts[1]);
      const interval = parts[2]?.toLowerCase();
      if (typeof amount === "string" || (interval !== "daily" && interval !== "weekly")) {
        return { text: typeof amount === "string" && amount ? amount : tradingTexts.dcaUsage };
      }
      const buy = amount.symbol === "ETH" ? "USDG" : "ETH";
      const result = await addRule(input, {
        kind: "dca",
        sell: amount.symbol,
        buy,
        amountAtomic: amount.atomic,
        intervalHours: interval === "daily" ? 24 : 168,
        triggerPriceUsd: null,
      });
      return {
        text: result ?? `DCA set: ${formatAtomic(amount.atomic, amount.symbol)} ${amount.symbol} to ${buy} ${interval}. ` +
          "Each time it comes due I'll send you a button to review the live quote and confirm it in your wallet. Nothing trades without you.",
      };
    }
    case "stoploss":
    case "takeprofit": {
      const usage = input.command === "stoploss" ? tradingTexts.stopLossUsage : tradingTexts.takeProfitUsage;
      const price = Number(parts[0]);
      const amount = readAmount(parts[1], "ETH");
      if (!Number.isFinite(price) || price <= 0 || price >= 1_000_000 || typeof amount === "string") {
        return { text: typeof amount === "string" && amount && parts[1] ? amount : usage };
      }
      // A trigger the price has already crossed would send a sell prompt on
      // the next monitor run, so it is refused like an exchange would.
      const current = await readEthPrice(input);
      if (current !== null) {
        if (input.command === "stoploss" && current <= price) {
          return {
            text: `ETH is at ${formatUsd(current)} now, already at or below $${price.toLocaleString("en-US")}. ` +
              "Set a stop-loss below the current price.",
          };
        }
        if (input.command === "takeprofit" && current >= price) {
          return {
            text: `ETH is at ${formatUsd(current)} now, already at or above $${price.toLocaleString("en-US")}. ` +
              "Set a take-profit above the current price.",
          };
        }
      }
      const result = await addRule(input, {
        kind: input.command === "stoploss" ? "stop_loss" : "take_profit",
        sell: "ETH",
        buy: "USDG",
        amountAtomic: amount.atomic,
        intervalHours: null,
        triggerPriceUsd: price,
      });
      const direction = input.command === "stoploss" ? "falls to" : "rises to";
      return {
        text: result ?? `${input.command === "stoploss" ? "Stop-loss" : "Take-profit"} set: when ETH ${direction} ` +
          `$${price.toLocaleString("en-US")}, I'll send you a button to sell ${formatAtomic(amount.atomic, "ETH")} ETH for USDG. ` +
          "You confirm it in your wallet; nothing trades on its own.",
      };
    }
    case "rules":
      return { text: await listRules(input) };
    case "rules_clear": {
      const removed = await callRpc(input.rpcClient, "clear_agent_trade_rules", { p_agent_id: input.agentId });
      const count = typeof removed === "number" ? removed : 0;
      return {
        text: count ? `Cleared ${count} swap rule${count === 1 ? "" : "s"}.` : "You have no swap rules.",
      };
    }
  }
}

function readAmount(rawAmount: string | undefined, rawSymbol: string | undefined):
  | { atomic: string; symbol: SwapSymbol }
  | string {
  const symbol = rawSymbol?.toUpperCase();
  if (!rawAmount || (symbol !== "ETH" && symbol !== "USDG")) return "";
  const token = tokens[symbol];
  const match = /^(\d+)(?:\.(\d+))?$/u.exec(rawAmount);
  if (!match) return "";
  const fraction = match[2] ?? "";
  if (fraction.length > token.decimals) {
    return `${symbol} supports up to ${token.decimals} decimal places.`;
  }
  const atomic = BigInt(match[1] + fraction.padEnd(token.decimals, "0"));
  if (atomic <= 0n) return "";
  if (atomic > token.max) {
    return `The most one swap can sell is ${token.maxLabel}.`;
  }
  return { atomic: atomic.toString(), symbol };
}

async function addRule(
  input: TradingCommandInput,
  rule: {
    kind: "dca" | "stop_loss" | "take_profit";
    sell: SwapSymbol;
    buy: SwapSymbol;
    amountAtomic: string;
    intervalHours: number | null;
    triggerPriceUsd: number | null;
  },
) {
  const result = await callRpc(input.rpcClient, "add_agent_trade_rule", {
    p_agent_id: input.agentId,
    p_kind: rule.kind,
    p_sell_token_symbol: rule.sell,
    p_buy_token_symbol: rule.buy,
    p_sell_amount_atomic: rule.amountAtomic,
    p_interval_hours: rule.intervalHours,
    p_trigger_price_usd: rule.triggerPriceUsd,
  });
  if (result === "added") return null;
  if (result === "limit_reached") {
    return "You already have 5 swap rules. Send /rules_clear to start over.";
  }
  return tradingTexts.failed;
}

async function listRules(input: TradingCommandInput) {
  const data = await callRpc(input.rpcClient, "list_agent_trade_rules", { p_agent_id: input.agentId });
  const rules = Array.isArray(data) ? data as Array<Record<string, unknown>> : [];
  if (!rules.length) {
    return "You have no swap rules. Try /dca 0.0005 ETH daily or /stoploss 2300 0.002.";
  }
  const lines = rules.map((rule) => {
    const sell = rule.sell === "USDG" ? "USDG" : "ETH";
    const amount = `${formatAtomic(String(rule.amount), sell)} ${sell} to ${rule.buy}`;
    if (rule.kind === "dca") {
      return `- DCA ${amount} ${rule.interval_hours === 24 ? "daily" : "weekly"}`;
    }
    const price = Number(rule.trigger_price_usd).toLocaleString("en-US");
    return rule.kind === "stop_loss"
      ? `- Stop-loss: sell ${amount} if ETH falls to $${price}`
      : `- Take-profit: sell ${amount} if ETH rises to $${price}`;
  });
  return ["Your swap rules:", ...lines, "Each one sends you a button to confirm in your wallet. /rules_clear removes them."]
    .join("\n");
}

async function callRpc(
  client: TradingRpcClient,
  functionName: "add_agent_trade_rule" | "clear_agent_trade_rules" | "list_agent_trade_rules",
  args: Record<string, string | number | null>,
) {
  try {
    const result = await client.rpc(functionName, args);
    if (!result || result.error) throw new Error("rpc failed");
    return result.data;
  } catch {
    throw new HttpError(500, "telegram_trading_failed", tradingTexts.failed);
  }
}
