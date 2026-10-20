import {
  formatLaunchDigest,
  isAlertCrossed,
  type LaunchEvent,
  type MonitorChain,
  type MonitorStore,
  type PriceAlert,
  runMonitorCycle,
  type WatchItem,
  wethAddress,
} from "./core.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

const agent = "agent-1";
const wallet = "0x" + "a".repeat(40);
const token = "0x" + "b".repeat(40);
const launch = "0x" + "c".repeat(40);

function createStore(options: {
  cursor?: number | null;
  watch?: WatchItem[];
  alerts?: PriceAlert[];
  subscriptions?: Array<{ agentId: string; lastDigestAt: string | null }>;
} = {}) {
  const state = {
    cursor: options.cursor ?? null as number | null,
    launches: [] as LaunchEvent[],
    watch: options.watch ?? [],
    alerts: options.alerts ?? [],
    claimed: new Set<string>(),
    released: [] as string[],
    digestMarked: [] as string[],
  };

  const store: MonitorStore = {
    async getCursor() {
      return state.cursor;
    },
    async setCursor(_key, block) {
      state.cursor = block;
    },
    async insertLaunchEvents(events) {
      state.launches.push(...events);
    },
    async dueLaunchSubscriptions() {
      return options.subscriptions ?? [];
    },
    async launchEventsSince(_since, limit) {
      return { total: state.launches.length, events: state.launches.slice(0, limit) };
    },
    async markDigestSent(agentId) {
      state.digestMarked.push(agentId);
    },
    async listWatchItems() {
      return state.watch;
    },
    async updateWatchItem(id, patch) {
      state.watch = state.watch.map((item) =>
        item.id === id
          ? {
            ...item,
            ...(patch.lastBlock !== undefined ? { lastBlock: patch.lastBlock } : {}),
            ...(patch.lastPriceUsd !== undefined ? { lastPriceUsd: patch.lastPriceUsd } : {}),
          }
          : item
      );
    },
    async activeAlerts() {
      return state.alerts.filter((alert) => !state.claimed.has(alert.id));
    },
    async claimAlert(id) {
      if (state.claimed.has(id)) return false;
      state.claimed.add(id);
      return true;
    },
    async releaseAlert(id) {
      state.claimed.delete(id);
      state.released.push(id);
    },
  };

  return { store, state };
}

function createChain(options: { prices?: Record<string, number | null>; transfers?: number } = {}): MonitorChain {
  return {
    async head() {
      return 1_000_000;
    },
    async poolLogs(fromBlock, toBlock) {
      assert(toBlock - fromBlock <= 28_000, "Scan windows must respect the RPC range limit.");
      return [{ dex: "v3", token0: wethAddress, token1: launch, pool: "0x" + "d".repeat(40), fee: 3000, blockNumber: toBlock }];
    },
    async walletTransfers() {
      return Array.from({ length: options.transfers ?? 0 }, (_, index) => ({
        token: token,
        from: "0x" + "e".repeat(40),
        to: wallet,
        raw: 1_500_000_000_000_000_000n,
        blockNumber: 999_000 + index,
      }));
    },
    async tokenMeta(addresses) {
      return new Map(addresses.map((address) => [address, { symbol: address === launch ? "NEW" : "TKN", name: "Token", decimals: 18 }]));
    },
    async pricesUsd(tokens) {
      return new Map(tokens.map((item) => [item.address, options.prices?.[item.address] ?? null]));
    },
  };
}

Deno.test("monitor scans launches from the cursor and sends a digest", async () => {
  const { store, state } = createStore({ cursor: 990_000, subscriptions: [{ agentId: agent, lastDigestAt: null }] });
  const sent: string[] = [];

  const report = await runMonitorCycle(store, createChain(), async (_agent, kind, text) => {
    sent.push(`${kind}:${text}`);
    return true;
  });

  assertEquals(report.launchesFound, 1);
  assertEquals(state.cursor, 1_000_000);
  assertEquals(state.launches[0].launchToken, launch);
  assertEquals(state.launches[0].quoteSymbol, "WETH");
  assertEquals(report.digestsSent, 1);
  assert(sent[0].includes("- NEW/WETH (Token), Uniswap V3 0.3%"), sent[0]);
  assert(sent[0].includes("high risk"), "Digest must warn about risk.");
  assertEquals(state.digestMarked[0], agent);
});

Deno.test("monitor sets a wallet baseline first, then alerts on new transfers", async () => {
  const item: WatchItem = { id: "w1", agentId: agent, address: wallet, kind: "wallet", label: "Main", lastBlock: null, lastPriceUsd: null };
  const first = createStore({ cursor: 1_000_000, watch: [item] });
  const sent: string[] = [];
  const send = async (_agent: string, _kind: string, text: string) => {
    sent.push(text);
    return true;
  };

  await runMonitorCycle(first.store, createChain({ transfers: 2 }), send);
  assertEquals(sent.length, 0, "The first check only records a baseline.");
  assertEquals(first.state.watch[0].lastBlock, 1_000_000);

  const second = createStore({ cursor: 1_000_000, watch: [{ ...item, lastBlock: 999_000 }] });
  const report = await runMonitorCycle(second.store, createChain({ transfers: 2 }), send);
  assertEquals(report.watchAlertsSent, 1);
  assert(sent[0].startsWith("Watchlist: Main had 2 new token transfers."), sent[0]);
  assert(sent[0].includes("- In: 1.5 TKN"), sent[0]);
});

Deno.test("monitor alerts on token moves of 10 percent or more", async () => {
  const item: WatchItem = { id: "t1", agentId: agent, address: token, kind: "token", label: "TKN", lastBlock: null, lastPriceUsd: 100 };
  const sent: string[] = [];
  const send = async (_agent: string, _kind: string, text: string) => {
    sent.push(text);
    return true;
  };

  const small = createStore({ cursor: 1_000_000, watch: [item] });
  await runMonitorCycle(small.store, createChain({ prices: { [token]: 105 } }), send);
  assertEquals(sent.length, 0, "A 5% move must not alert.");

  const big = createStore({ cursor: 1_000_000, watch: [item] });
  await runMonitorCycle(big.store, createChain({ prices: { [token]: 89 } }), send);
  assert(sent[0]?.includes("moved -11.0% to $89"), String(sent[0]));
  assertEquals(big.state.watch[0].lastPriceUsd, 89);
});

Deno.test("monitor sends each price alert once and releases it when delivery fails", async () => {
  const alert: PriceAlert = { id: "a1", agentId: agent, tokenAddress: token, tokenLabel: "TKN", direction: "above", targetUsd: 2 };

  const delivered = createStore({ cursor: 1_000_000, alerts: [alert] });
  const sent: string[] = [];
  const report = await runMonitorCycle(delivered.store, createChain({ prices: { [token]: 2.5 } }), async (_a, _k, text) => {
    sent.push(text);
    return true;
  });
  assertEquals(report.priceAlertsSent, 1);
  assert(sent[0].startsWith("Price alert: TKN is $2.5, above your $2 target."), sent[0]);
  assert(delivered.state.claimed.has("a1"), "A sent alert stays claimed.");

  const failing = createStore({ cursor: 1_000_000, alerts: [alert] });
  await runMonitorCycle(failing.store, createChain({ prices: { [token]: 2.5 } }), async () => false);
  assertEquals(failing.state.released[0], "a1");
  assert(!failing.state.claimed.has("a1"), "A failed alert must be retried later.");

  const notYet = createStore({ cursor: 1_000_000, alerts: [alert] });
  const quiet = await runMonitorCycle(notYet.store, createChain({ prices: { [token]: 1.9 } }), async () => true);
  assertEquals(quiet.priceAlertsSent, 0);
});

Deno.test("monitor caps messages per agent and keeps going when a step fails", async () => {
  const alerts = Array.from({ length: 8 }, (_, index): PriceAlert => ({
    id: `a${index}`,
    agentId: agent,
    tokenAddress: token,
    tokenLabel: "TKN",
    direction: "below",
    targetUsd: 10,
  }));
  const { store } = createStore({ cursor: 990_000, alerts });
  const failingChain = createChain({ prices: { [token]: 5 } });
  failingChain.poolLogs = async () => {
    throw new Error("rpc down");
  };
  let sent = 0;

  const report = await runMonitorCycle(store, failingChain, async () => {
    sent += 1;
    return true;
  });

  assertEquals(sent, 5);
  assert(report.skipped.includes("launch_scan"), "A failed scan must be reported, not fatal.");
});

Deno.test("monitor alert crossing and digest wording", () => {
  assert(isAlertCrossed({ direction: "above", targetUsd: 2 }, 2), "Equal counts as crossed above.");
  assert(!isAlertCrossed({ direction: "below", targetUsd: 2 }, 2.1), "Below needs a lower price.");
  const text = formatLaunchDigest(7, [{
    poolAddress: "0x" + "1".repeat(40),
    dex: "v2",
    fee: null,
    launchToken: launch,
    quoteToken: wethAddress,
    symbol: "",
    name: "",
    quoteSymbol: "WETH",
    blockNumber: 1,
  }]);
  assert(text.includes("7 new DEX pools"), text);
  assert(text.includes("...and 6 more."), text);
  assert(text.includes("/launches off"), text);
});
