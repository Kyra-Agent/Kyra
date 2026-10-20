import { HttpError } from "./core.ts";
import {
  createBatchRpc,
  ethCall,
  readAbiString,
  readUint,
  robinhoodChainIdHex,
  selectors,
  shortAddress,
} from "./chain-data.ts";
import { formatUsd, readTokenPricesUsd } from "./prices.ts";
import type { TelegramWebhookParsedCommandName } from "./update-parser.ts";

// Owner-only Telegram commands that set up proactive monitoring. The
// telegram-monitor Edge Function does the watching and sends the alerts.

export type MonitoringCommand =
  | "watch"
  | "unwatch"
  | "watchlist"
  | "alert"
  | "alerts"
  | "alerts_clear"
  | "launches";

export interface MonitoringRpcClient {
  rpc(
    functionName:
      | "add_agent_watch_item"
      | "remove_agent_watch_item"
      | "add_agent_price_alert"
      | "clear_agent_price_alerts"
      | "set_agent_launch_subscription"
      | "list_agent_monitoring",
    args: Record<string, string | number | boolean>,
  ): Promise<{ data?: unknown; error?: unknown | null }> | {
    data?: unknown;
    error?: unknown | null;
  };
}

export interface MonitoringCommandInput {
  command: MonitoringCommand;
  args: string;
  agentId: string;
  rpcClient: MonitoringRpcClient;
  chainRpcUrl: string | null;
  fetchImpl?: typeof fetch;
}

const monitoringCommands = new Set<string>([
  "watch",
  "unwatch",
  "watchlist",
  "alert",
  "alerts",
  "alerts_clear",
  "launches",
]);
const addressPattern = /^0x[0-9a-fA-F]{40}$/;

export const monitoringTexts = {
  ownerOnly: "Monitoring is set up by the agent owner in a private chat with me.",
  watchUsage: "Send /watch followed by a wallet or token address, for example: /watch 0x5fc5...d168",
  unwatchUsage: "Send /unwatch followed by an address on your watchlist.",
  alertUsage:
    "Send /alert, a token address, above or below, and a USD price. Example: /alert 0x0bd7...ad73 above 2500",
  launchesUsage: "Send /launches on or /launches off.",
  chainUnavailable: "I cannot read Robinhood Chain right now, so I could not set that up. Try again in a moment.",
  failed: "I could not update your monitoring right now. Try again in a moment.",
};

export function isMonitoringCommand(
  command: TelegramWebhookParsedCommandName,
): command is MonitoringCommand {
  return monitoringCommands.has(command);
}

export async function handleMonitoringCommand(input: MonitoringCommandInput): Promise<string> {
  switch (input.command) {
    case "watch":
      return await handleWatch(input);
    case "unwatch":
      return await handleUnwatch(input);
    case "watchlist":
    case "alerts":
      return await handleList(input, input.command === "alerts");
    case "alert":
      return await handleAlert(input);
    case "alerts_clear": {
      const removed = await callRpc(input.rpcClient, "clear_agent_price_alerts", {
        p_agent_id: input.agentId,
      });
      const count = typeof removed === "number" ? removed : 0;
      return count
        ? `Cleared ${count} price alert${count === 1 ? "" : "s"}.`
        : "You have no active price alerts.";
    }
    case "launches":
      return await handleLaunches(input);
  }
}

async function handleWatch(input: MonitoringCommandInput) {
  const address = input.args.split(" ")[0] ?? "";

  if (!addressPattern.test(address)) {
    return monitoringTexts.watchUsage;
  }

  const asset = await classifyAddress(input, address.toLowerCase());

  if (!asset) {
    return monitoringTexts.chainUnavailable;
  }

  const result = await callRpc(input.rpcClient, "add_agent_watch_item", {
    p_agent_id: input.agentId,
    p_address: address.toLowerCase(),
    p_kind: asset.kind,
    p_label: asset.label,
  });

  switch (result) {
    case "added":
      return asset.kind === "token"
        ? `Watching ${asset.label} (token). I will message you when its price moves 10% or more.`
        : `Watching wallet ${asset.label}. I will message you when it sends or receives tokens.`;
    case "exists":
      return `${asset.label} is already on your watchlist.`;
    case "limit_reached":
      return "Your watchlist is full (10 items). Remove one with /unwatch first.";
    default:
      return monitoringTexts.failed;
  }
}

async function handleUnwatch(input: MonitoringCommandInput) {
  const address = input.args.split(" ")[0] ?? "";

  if (!addressPattern.test(address)) {
    return monitoringTexts.unwatchUsage;
  }

  const result = await callRpc(input.rpcClient, "remove_agent_watch_item", {
    p_agent_id: input.agentId,
    p_address: address.toLowerCase(),
  });

  return result === "removed"
    ? `Removed ${shortAddress(address.toLowerCase())} from your watchlist.`
    : "That address is not on your watchlist.";
}

async function handleAlert(input: MonitoringCommandInput) {
  const match = /^(0x[0-9a-fA-F]{40})\s+(above|below|>|<)\s+\$?([0-9]+(?:\.[0-9]+)?)$/i
    .exec(input.args);

  if (!match) {
    return monitoringTexts.alertUsage;
  }

  const address = match[1].toLowerCase();
  const direction = match[2] === ">" || match[2].toLowerCase() === "above" ? "above" : "below";
  const target = Number(match[3]);

  if (!Number.isFinite(target) || target <= 0 || target >= 1e12) {
    return monitoringTexts.alertUsage;
  }

  const asset = await classifyAddress(input, address);

  if (!asset) {
    return monitoringTexts.chainUnavailable;
  }

  if (asset.kind !== "token" || asset.decimals === null) {
    return "Price alerts work for token addresses. That address is a wallet or contract.";
  }

  const price = await readPrice(input, address, asset.decimals);

  if (price === undefined) {
    return monitoringTexts.chainUnavailable;
  }

  if (price === null) {
    return `I cannot find a liquid USDG or WETH pool for ${asset.label}, so I cannot track its price.`;
  }

  const result = await callRpc(input.rpcClient, "add_agent_price_alert", {
    p_agent_id: input.agentId,
    p_token_address: address,
    p_token_label: asset.label,
    p_direction: direction,
    p_target_usd: target,
  });

  if (result === "limit_reached") {
    return "You already have 10 active price alerts. Clear them with /alerts_clear first.";
  }

  if (result !== "added") {
    return monitoringTexts.failed;
  }

  const alreadyMet = direction === "above" ? price >= target : price <= target;
  return [
    `Alert set: ${asset.label} ${direction} ${formatUsd(target)}. It is ${formatUsd(price)} now.`,
    alreadyMet
      ? "That level is already reached, so you will get the alert within about 5 minutes."
      : "I check every 5 minutes and message you once when it crosses.",
  ].join("\n");
}

async function handleLaunches(input: MonitoringCommandInput) {
  const choice = input.args.toLowerCase();

  if (choice !== "on" && choice !== "off") {
    return monitoringTexts.launchesUsage;
  }

  const result = await callRpc(input.rpcClient, "set_agent_launch_subscription", {
    p_agent_id: input.agentId,
    p_enabled: choice === "on",
  });

  if (result === "on") {
    return [
      "Launch monitor is on.",
      "Every 30 minutes I will send the new Robinhood Chain DEX pools I found, newest first.",
      "New tokens are high risk. Check the contract, liquidity, and holders before trading.",
    ].join("\n");
  }

  return result === "off" ? "Launch monitor is off." : monitoringTexts.failed;
}

async function handleList(input: MonitoringCommandInput, alertsOnly: boolean) {
  const data = await callRpc(input.rpcClient, "list_agent_monitoring", {
    p_agent_id: input.agentId,
  });

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return monitoringTexts.failed;
  }

  const record = data as Record<string, unknown>;
  const watch = Array.isArray(record.watch) ? record.watch as Array<Record<string, unknown>> : [];
  const alerts = Array.isArray(record.alerts) ? record.alerts as Array<Record<string, unknown>> : [];
  const lines: string[] = [];

  if (!alertsOnly) {
    lines.push(watch.length ? `Watchlist (${watch.length}/10):` : "Your watchlist is empty. Add with /watch 0x...");
    for (const item of watch) {
      const address = shortAddress(String(item.address));
      const label = String(item.label || "");
      lines.push(
        label && label !== address
          ? `- ${label} (${String(item.kind)}) ${address}`
          : `- ${address} (${String(item.kind)})`,
      );
    }
  }

  lines.push(alerts.length ? `Price alerts (${alerts.length}/10):` : "No active price alerts. Add with /alert.");
  for (const alert of alerts) {
    lines.push(`- ${String(alert.label || shortAddress(String(alert.token)))} ${String(alert.direction)} ${formatUsd(Number(alert.target))}`);
  }

  if (!alertsOnly) {
    lines.push(`Launch monitor: ${record.launches === true ? "on" : "off"}`);
  }

  return lines.join("\n");
}

interface ClassifiedAddress {
  kind: "wallet" | "token";
  label: string;
  decimals: number | null;
}

async function classifyAddress(
  input: MonitoringCommandInput,
  address: string,
): Promise<ClassifiedAddress | null> {
  if (!input.chainRpcUrl) {
    return null;
  }

  try {
    const rpc = createBatchRpc(input.chainRpcUrl, input.fetchImpl ?? fetch, 6_000);
    const [chainId, code, symbol, decimals] = await rpc([
      { method: "eth_chainId", params: [] },
      { method: "eth_getCode", params: [address, "latest"] },
      ethCall(address, selectors.symbol),
      ethCall(address, selectors.decimals),
    ]);

    if (typeof chainId !== "string" || chainId.toLowerCase() !== robinhoodChainIdHex) {
      return null;
    }

    const isContract = typeof code === "string" && code !== "0x" && code !== "0x0";
    const parsedDecimals = readUint(decimals);

    if (isContract && parsedDecimals !== null && parsedDecimals <= 36n) {
      return {
        kind: "token",
        label: readAbiString(symbol) ?? shortAddress(address),
        decimals: Number(parsedDecimals),
      };
    }

    return { kind: "wallet", label: shortAddress(address), decimals: null };
  } catch {
    return null;
  }
}

// undefined: chain unreadable; null: no liquid pool.
async function readPrice(input: MonitoringCommandInput, address: string, decimals: number) {
  if (!input.chainRpcUrl) {
    return undefined;
  }

  try {
    const rpc = createBatchRpc(input.chainRpcUrl, input.fetchImpl ?? fetch, 6_000);
    const prices = await readTokenPricesUsd(rpc, [{ address, decimals }]);
    return prices.get(address)?.usd ?? null;
  } catch {
    return undefined;
  }
}

async function callRpc(
  client: MonitoringRpcClient,
  functionName: Parameters<MonitoringRpcClient["rpc"]>[0],
  args: Record<string, string | number | boolean>,
) {
  try {
    const result = await client.rpc(functionName, args);

    if (!result || result.error) {
      throw new Error("Monitoring RPC failed.");
    }

    return result.data;
  } catch {
    throw new HttpError(500, "telegram_monitoring_failed", "Telegram monitoring is unavailable.");
  }
}
