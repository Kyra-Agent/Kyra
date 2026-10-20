// Monitoring cycle run every five minutes by pg_cron: scans Robinhood Chain
// for new DEX pools, checks watchlists and price alerts, and pushes owner
// notifications to Telegram. Storage, chain access, and delivery are passed
// in so the cycle can be tested without a database or network.

export interface LaunchEvent {
  poolAddress: string;
  dex: "v2" | "v3";
  fee: number | null;
  launchToken: string;
  quoteToken: string;
  symbol: string;
  name: string;
  quoteSymbol: string;
  blockNumber: number;
}

export interface RawPoolLog {
  dex: "v2" | "v3";
  token0: string;
  token1: string;
  pool: string;
  fee: number | null;
  blockNumber: number;
}

export interface TransferLog {
  token: string;
  from: string;
  to: string;
  raw: bigint | null;
  blockNumber: number;
}

export interface WatchItem {
  id: string;
  agentId: string;
  address: string;
  kind: "wallet" | "token";
  label: string;
  lastBlock: number | null;
  lastPriceUsd: number | null;
}

export interface PriceAlert {
  id: string;
  agentId: string;
  tokenAddress: string;
  tokenLabel: string;
  direction: "above" | "below";
  targetUsd: number;
}

export interface LaunchSubscription {
  agentId: string;
  lastDigestAt: string | null;
}

export interface TokenMeta {
  symbol: string;
  name: string;
  decimals: number;
}

export interface MonitorStore {
  getCursor(key: string): Promise<number | null>;
  setCursor(key: string, blockNumber: number): Promise<void>;
  insertLaunchEvents(events: LaunchEvent[]): Promise<void>;
  dueLaunchSubscriptions(olderThan: string): Promise<LaunchSubscription[]>;
  launchEventsSince(since: string | null, limit: number): Promise<{ total: number; events: LaunchEvent[] }>;
  markDigestSent(agentId: string, at: string): Promise<void>;
  markDigestAttempted(agentId: string, at: string): Promise<void>;
  // Least recently checked first.
  listWatchItems(limit: number): Promise<WatchItem[]>;
  markWatchItemsChecked(ids: string[], at: string): Promise<void>;
  updateWatchItem(id: string, patch: { lastBlock?: number; lastPriceUsd?: number }): Promise<void>;
  activeAlerts(limit: number): Promise<PriceAlert[]>;
  claimAlert(id: string, priceUsd: number): Promise<boolean>;
  releaseAlert(id: string): Promise<void>;
}

export interface MonitorChain {
  head(): Promise<number>;
  poolLogs(fromBlock: number, toBlock: number): Promise<RawPoolLog[]>;
  walletTransfers(wallet: string, fromBlock: number, toBlock: number): Promise<TransferLog[] | null>;
  tokenMeta(addresses: string[]): Promise<Map<string, TokenMeta>>;
  pricesUsd(tokens: Array<{ address: string; decimals: number }>): Promise<Map<string, number | null>>;
}

// Sends one message to the agent owner's private chat; false when the agent
// has no linked owner chat or delivery failed.
export type MonitorSend = (agentId: string, kind: "launches" | "watchlist" | "alerts", text: string) =>
  Promise<boolean>;

export interface MonitorCycleOptions {
  now?: Date;
  deadlineMs?: number;
  clock?: () => number;
}

export interface MonitorCycleReport {
  launchesFound: number;
  digestsSent: number;
  watchAlertsSent: number;
  priceAlertsSent: number;
  skipped: string[];
}

export const wethAddress = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
export const usdgAddress = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
const quoteSymbols = new Map([[wethAddress, "WETH"], [usdgAddress, "USDG"]]);
const launchCursorKey = "launch_scan";
const maxScanBlocks = 28_000;
const firstScanBlocks = 3_000;
const walletFirstScanBlocks = 3_000;
const digestIntervalMinutes = 30;
const tokenMoveThreshold = 0.1;
const maxMetaLookups = 40;
const maxWatchItems = 200;
const maxAlerts = 200;
const maxMessagesPerAgent = 5;
// Wallet log checks hit the public chain RPC; spread them across cycles,
// least recently checked first.
const maxWalletChecksPerCycle = 25;

export async function runMonitorCycle(
  store: MonitorStore,
  chain: MonitorChain,
  send: MonitorSend,
  options: MonitorCycleOptions = {},
): Promise<MonitorCycleReport> {
  const now = options.now ?? new Date();
  const clock = options.clock ?? Date.now;
  const deadline = clock() + (options.deadlineMs ?? 40_000);
  const sentPerAgent = new Map<string, number>();
  const report: MonitorCycleReport = {
    launchesFound: 0,
    digestsSent: 0,
    watchAlertsSent: 0,
    priceAlertsSent: 0,
    skipped: [],
  };

  const sendCapped: MonitorSend = async (agentId, kind, text) => {
    const sent = sentPerAgent.get(agentId) ?? 0;
    if (sent >= maxMessagesPerAgent) {
      return false;
    }
    const ok = await send(agentId, kind, text);
    if (ok) {
      sentPerAgent.set(agentId, sent + 1);
    }
    return ok;
  };
  const timeLeft = () => clock() < deadline;

  const head = await chain.head();

  // 1. Launch scan.
  try {
    const cursor = await store.getCursor(launchCursorKey);
    const fromBlock = cursor === null
      ? Math.max(0, head - firstScanBlocks)
      : Math.max(cursor + 1, head - maxScanBlocks);

    if (fromBlock <= head) {
      const logs = await chain.poolLogs(fromBlock, head);
      const events = await buildLaunchEvents(logs, chain);
      if (events.length) {
        await store.insertLaunchEvents(events);
      }
      report.launchesFound = events.length;
      await store.setCursor(launchCursorKey, head);
    }
  } catch {
    report.skipped.push("launch_scan");
  }

  // 2. Launch digests every 30 minutes.
  if (timeLeft()) {
    try {
      const cutoff = new Date(now.getTime() - digestIntervalMinutes * 60_000).toISOString();
      for (const subscription of await store.dueLaunchSubscriptions(cutoff)) {
        if (!timeLeft()) {
          break;
        }
        const { total, events } = await store.launchEventsSince(subscription.lastDigestAt, 5);
        if (total > 0) {
          const ok = await sendCapped(
            subscription.agentId,
            "launches",
            formatLaunchDigest(total, events),
          );
          if (!ok) {
            // Moves to the back of the queue so it cannot block other agents.
            await store.markDigestAttempted(subscription.agentId, now.toISOString());
            continue;
          }
          report.digestsSent += 1;
        }
        await store.markDigestSent(subscription.agentId, now.toISOString());
      }
    } catch {
      report.skipped.push("launch_digest");
    }
  }

  // 3. Watchlists.
  if (timeLeft()) {
    try {
      const items = await store.listWatchItems(maxWatchItems);
      const tokenItems = items.filter((item) => item.kind === "token");
      const meta = tokenItems.length
        ? await chain.tokenMeta(tokenItems.map((item) => item.address))
        : new Map<string, TokenMeta>();
      const prices = tokenItems.length
        ? await chain.pricesUsd(
          tokenItems.map((item) => ({
            address: item.address,
            decimals: meta.get(item.address)?.decimals ?? 18,
          })),
        )
        : new Map<string, number | null>();

      let walletChecks = 0;
      const checked: string[] = [];

      for (const item of items) {
        if (!timeLeft()) {
          break;
        }

        if (item.kind === "wallet" && walletChecks >= maxWalletChecksPerCycle) {
          continue;
        }
        checked.push(item.id);

        if (item.kind === "wallet") {
          walletChecks += 1;
          const fromBlock = item.lastBlock === null
            ? Math.max(0, head - walletFirstScanBlocks)
            : Math.max(item.lastBlock + 1, head - maxScanBlocks);
          if (fromBlock > head) {
            continue;
          }
          const transfers = await chain.walletTransfers(item.address, fromBlock, head);
          if (transfers === null) {
            continue;
          }
          if (item.lastBlock !== null && transfers.length) {
            const tokenMeta = await chain.tokenMeta(
              [...new Set(transfers.map((transfer) => transfer.token))].slice(0, 10),
            );
            const ok = await sendCapped(
              item.agentId,
              "watchlist",
              formatWalletAlert(item, transfers, tokenMeta),
            );
            if (!ok) {
              continue;
            }
            report.watchAlertsSent += 1;
          }
          await store.updateWatchItem(item.id, { lastBlock: head });
          continue;
        }

        const price = prices.get(item.address) ?? null;
        if (price === null) {
          continue;
        }
        if (item.lastPriceUsd === null || item.lastPriceUsd <= 0) {
          await store.updateWatchItem(item.id, { lastPriceUsd: price });
          continue;
        }
        const change = (price - item.lastPriceUsd) / item.lastPriceUsd;
        if (Math.abs(change) >= tokenMoveThreshold) {
          const ok = await sendCapped(
            item.agentId,
            "watchlist",
            formatTokenMoveAlert(item, item.lastPriceUsd, price),
          );
          if (ok) {
            report.watchAlertsSent += 1;
            await store.updateWatchItem(item.id, { lastPriceUsd: price });
          }
        }
      }

      if (checked.length) {
        await store.markWatchItemsChecked(checked, now.toISOString());
      }
    } catch {
      report.skipped.push("watchlist");
    }
  }

  // 4. Price alerts.
  if (timeLeft()) {
    try {
      const alerts = await store.activeAlerts(maxAlerts);
      const tokens = [...new Set(alerts.map((alert) => alert.tokenAddress))];
      const meta = tokens.length ? await chain.tokenMeta(tokens) : new Map<string, TokenMeta>();
      const prices = tokens.length
        ? await chain.pricesUsd(
          tokens.map((address) => ({ address, decimals: meta.get(address)?.decimals ?? 18 })),
        )
        : new Map<string, number | null>();

      for (const alert of alerts) {
        if (!timeLeft()) {
          break;
        }
        const price = prices.get(alert.tokenAddress) ?? null;
        if (price === null || !isAlertCrossed(alert, price)) {
          continue;
        }
        // Claim first so overlapping cycles cannot double-send.
        if (!await store.claimAlert(alert.id, price)) {
          continue;
        }
        const ok = await sendCapped(alert.agentId, "alerts", formatPriceAlert(alert, price));
        if (ok) {
          report.priceAlertsSent += 1;
        } else {
          await store.releaseAlert(alert.id);
        }
      }
    } catch {
      report.skipped.push("price_alerts");
    }
  }

  return report;
}

export function isAlertCrossed(alert: Pick<PriceAlert, "direction" | "targetUsd">, price: number) {
  return alert.direction === "above" ? price >= alert.targetUsd : price <= alert.targetUsd;
}

async function buildLaunchEvents(logs: RawPoolLog[], chain: MonitorChain) {
  const candidates = logs.map((log) => {
    const token0IsQuote = quoteSymbols.has(log.token0);
    const token1IsQuote = quoteSymbols.has(log.token1);
    const launchToken = token0IsQuote && !token1IsQuote ? log.token1 : log.token0;
    const quoteToken = launchToken === log.token0 ? log.token1 : log.token0;
    return { log, launchToken, quoteToken };
  });
  const meta = await chain.tokenMeta(
    [...new Set(candidates.map((candidate) => candidate.launchToken))].slice(0, maxMetaLookups),
  );

  return candidates.map(({ log, launchToken, quoteToken }): LaunchEvent => {
    const tokenMeta = meta.get(launchToken);
    return {
      poolAddress: log.pool,
      dex: log.dex,
      fee: log.fee,
      launchToken,
      quoteToken,
      symbol: tokenMeta?.symbol ?? "",
      name: tokenMeta?.name ?? "",
      quoteSymbol: quoteSymbols.get(quoteToken) ?? "",
      blockNumber: log.blockNumber,
    };
  });
}

export function formatLaunchDigest(total: number, events: LaunchEvent[]) {
  const lines = [
    `Robinhood Chain launches: ${total} new DEX pool${total === 1 ? "" : "s"} since my last update.`,
  ];

  for (const event of events) {
    const symbol = event.symbol || shortAddress(event.launchToken);
    const pair = event.quoteSymbol ? `/${event.quoteSymbol}` : "";
    const name = event.name && event.name !== event.symbol ? ` (${event.name})` : "";
    const venue = event.dex === "v3"
      ? `Uniswap V3${event.fee ? ` ${event.fee / 10_000}%` : ""}`
      : "V2 pool";
    lines.push(`- ${symbol}${pair}${name}, ${venue}, token ${shortAddress(event.launchToken)}`);
  }

  if (total > events.length) {
    lines.push(`...and ${total - events.length} more.`);
  }

  lines.push(
    "New tokens are high risk. Check the contract, liquidity, and holders before trading. Send me a token address for details. /launches off stops these.",
  );
  return lines.join("\n");
}

export function formatWalletAlert(
  item: WatchItem,
  transfers: TransferLog[],
  meta: Map<string, TokenMeta>,
) {
  const sorted = [...transfers].sort((a, b) => b.blockNumber - a.blockNumber);
  const lines = [
    `Watchlist: ${item.label || shortAddress(item.address)} had ${transfers.length} new token transfer${
      transfers.length === 1 ? "" : "s"
    }.`,
  ];

  for (const transfer of sorted.slice(0, 5)) {
    const token = meta.get(transfer.token);
    const amount = transfer.raw === null
      ? "an NFT"
      : `${formatTokenAmount(transfer.raw, token?.decimals ?? 18)} ${token?.symbol ?? shortAddress(transfer.token)}`;
    lines.push(
      transfer.to === item.address
        ? `- In: ${amount} from ${shortAddress(transfer.from)}`
        : `- Out: ${amount} to ${shortAddress(transfer.to)}`,
    );
  }

  if (transfers.length > 5) {
    lines.push(`...and ${transfers.length - 5} more.`);
  }

  return lines.join("\n");
}

export function formatTokenMoveAlert(item: WatchItem, from: number, to: number) {
  const change = ((to - from) / from) * 100;
  return [
    `Watchlist: ${item.label || shortAddress(item.address)} moved ${change >= 0 ? "+" : ""}${change.toFixed(1)}% to ${
      formatUsd(to)
    } (was ${formatUsd(from)}).`,
    "Price from an on-chain Robinhood Chain pool. Not financial advice.",
  ].join("\n");
}

export function formatPriceAlert(alert: PriceAlert, price: number) {
  return [
    `Price alert: ${alert.tokenLabel || shortAddress(alert.tokenAddress)} is ${formatUsd(price)}, ${alert.direction} your ${
      formatUsd(alert.targetUsd)
    } target.`,
    "This alert is now done. Set a new one with /alert. Kyra never trades for you.",
  ].join("\n");
}

function formatTokenAmount(raw: bigint, decimals: number) {
  const scale = 10n ** BigInt(Math.max(0, Math.min(decimals, 36)));
  const whole = raw / scale;
  const fraction = raw % scale;
  const fractionText = fraction === 0n
    ? ""
    : fraction.toString().padStart(decimals, "0").slice(0, whole > 999_999n ? 2 : 6).replace(/0+$/, "");
  const wholeText = whole.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fractionText ? `${wholeText}.${fractionText}` : wholeText;
}

function formatUsd(value: number) {
  if (value >= 1000) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  if (value >= 1) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  return value >= 0.0001 ? `$${value.toPrecision(3)}` : "<$0.0001";
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
