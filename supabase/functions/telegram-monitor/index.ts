import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decodeAbiParameters, toEventSelector } from "npm:viem@2.57.7";
import {
  createBatchRpc,
  ethCall,
  readAbiString,
  readChainDataRpcConfig,
  readHexBigInt,
  readHexNumber,
  readUint,
  robinhoodChainIdHex,
  selectors,
  toHex,
  transferTopic,
} from "../telegram-webhook/chain-data.ts";
import { readTokenPricesUsd, uniswapV3Factory, v2Factories } from "../telegram-webhook/prices.ts";
import { deliverTelegramReadOnlyResponse } from "../telegram-webhook/response-delivery.ts";
import { logSafeEvent } from "../_shared/safe-log.ts";
import {
  type LaunchEvent,
  type MonitorChain,
  type MonitorSend,
  type MonitorStore,
  type RawPoolLog,
  runMonitorCycle,
  type TokenMeta,
  type TransferLog,
} from "./core.ts";

// Called every five minutes by pg_cron (via pg_net) with a shared secret in
// the x-kyra-monitor-secret header. Not reachable with a user JWT.

const pairCreatedTopic = toEventSelector("PairCreated(address,address,address,uint256)");
const poolCreatedTopic = toEventSelector("PoolCreated(address,address,uint24,int24,address)");

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function secretsMatch(provided: string, expected: string) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  const left = new Uint8Array(a);
  const right = new Uint8Array(b);
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

function topicAddress(topic: unknown) {
  return typeof topic === "string" ? `0x${topic.slice(-40)}`.toLowerCase() : "";
}

function createChain(rpcUrl: string): MonitorChain {
  const rpc = createBatchRpc(rpcUrl, fetch, 8_000);

  return {
    async head() {
      const [chainId, block] = await rpc([
        { method: "eth_chainId", params: [] },
        { method: "eth_blockNumber", params: [] },
      ]);
      const head = readHexNumber(block);
      if (typeof chainId !== "string" || chainId.toLowerCase() !== robinhoodChainIdHex || head === null) {
        throw new Error("Robinhood Chain is unavailable.");
      }
      return head;
    },

    async poolLogs(fromBlock, toBlock) {
      const range = { fromBlock: toHex(fromBlock), toBlock: toHex(toBlock) };
      const results = await rpc([
        ...v2Factories.map((factory) => ({
          method: "eth_getLogs",
          params: [{ ...range, address: factory, topics: [pairCreatedTopic] }],
        })),
        {
          method: "eth_getLogs",
          params: [{ ...range, address: uniswapV3Factory, topics: [poolCreatedTopic] }],
        },
      ]);

      const logs: RawPoolLog[] = [];
      results.forEach((value, index) => {
        if (!Array.isArray(value)) {
          return;
        }
        const isV3 = index === v2Factories.length;
        for (const log of value as Array<Record<string, unknown>>) {
          const topics = Array.isArray(log.topics) ? log.topics : [];
          const data = typeof log.data === "string" ? log.data : "";
          let pool = "";
          try {
            pool = isV3
              ? (decodeAbiParameters([{ type: "int24" }, { type: "address" }], data as `0x${string}`)[1])
                .toLowerCase()
              : (decodeAbiParameters([{ type: "address" }, { type: "uint256" }], data as `0x${string}`)[0])
                .toLowerCase();
          } catch {
            continue;
          }
          logs.push({
            dex: isV3 ? "v3" : "v2",
            token0: topicAddress(topics[1]),
            token1: topicAddress(topics[2]),
            pool,
            fee: isV3 ? readHexNumber(topics[3]) : null,
            blockNumber: readHexNumber(log.blockNumber) ?? toBlock,
          });
        }
      });
      return logs.filter((log) => /^0x[0-9a-f]{40}$/.test(log.pool));
    },

    async walletTransfers(wallet, fromBlock, toBlock) {
      const padded = `0x${wallet.slice(2).padStart(64, "0")}`;
      const range = { fromBlock: toHex(fromBlock), toBlock: toHex(toBlock) };
      const [incoming, outgoing] = await rpc([
        { method: "eth_getLogs", params: [{ ...range, topics: [transferTopic, null, padded] }] },
        { method: "eth_getLogs", params: [{ ...range, topics: [transferTopic, padded] }] },
      ]);
      if (!Array.isArray(incoming) || !Array.isArray(outgoing)) {
        return null;
      }
      return [...incoming, ...outgoing].flatMap((log: Record<string, unknown>): TransferLog[] => {
        const topics = Array.isArray(log.topics) ? log.topics : [];
        if (topics.length < 3) {
          return [];
        }
        return [{
          token: String(log.address ?? "").toLowerCase(),
          from: topicAddress(topics[1]),
          to: topicAddress(topics[2]),
          raw: topics.length === 4 ? null : readHexBigInt(log.data),
          blockNumber: readHexNumber(log.blockNumber) ?? toBlock,
        }];
      });
    },

    async tokenMeta(addresses) {
      const unique = [...new Set(addresses)].slice(0, 40);
      const meta = new Map<string, TokenMeta>();
      if (!unique.length) {
        return meta;
      }
      const values = await rpc(unique.flatMap((address) => [
        ethCall(address, selectors.symbol),
        ethCall(address, selectors.name),
        ethCall(address, selectors.decimals),
      ]));
      unique.forEach((address, index) => {
        const decimals = readUint(values[index * 3 + 2]);
        meta.set(address, {
          symbol: readAbiString(values[index * 3]) ?? "",
          name: readAbiString(values[index * 3 + 1]) ?? "",
          decimals: decimals !== null && decimals <= 36n ? Number(decimals) : 18,
        });
      });
      return meta;
    },

    async pricesUsd(tokens) {
      const prices = await readTokenPricesUsd(rpc, tokens);
      return new Map([...prices.entries()].map(([address, price]) => [address, price?.usd ?? null]));
    },
  };
}

// deno-lint-ignore no-explicit-any
function createStore(client: any): MonitorStore {
  const check = (result: { error: unknown }) => {
    if (result.error) {
      throw new Error("Monitor storage failed.");
    }
  };

  return {
    async getCursor(key) {
      const result = await client.from("monitor_state").select("block_number").eq("key", key).maybeSingle();
      check(result);
      return result.data ? Number(result.data.block_number) : null;
    },
    async setCursor(key, blockNumber) {
      check(await client.from("monitor_state").upsert({
        key,
        block_number: blockNumber,
        updated_at: new Date().toISOString(),
      }));
    },
    async insertLaunchEvents(events: LaunchEvent[]) {
      check(await client.from("chain_launch_events").upsert(
        events.map((event) => ({
          pool_address: event.poolAddress,
          dex: event.dex,
          fee: event.fee,
          launch_token: event.launchToken,
          quote_token: event.quoteToken,
          symbol: event.symbol.slice(0, 40),
          name: event.name.slice(0, 40),
          quote_symbol: event.quoteSymbol,
          block_number: event.blockNumber,
        })),
        { onConflict: "pool_address", ignoreDuplicates: true },
      ));
    },
    async dueLaunchSubscriptions(olderThan) {
      const result = await client.from("agent_launch_subscriptions")
        .select("agent_id,last_digest_at")
        .eq("enabled", true)
        .or(`last_digest_at.is.null,last_digest_at.lt.${olderThan}`)
        .limit(50);
      check(result);
      return (result.data ?? []).map((row: Record<string, unknown>) => ({
        agentId: String(row.agent_id),
        lastDigestAt: row.last_digest_at ? String(row.last_digest_at) : null,
      }));
    },
    async launchEventsSince(since, limit) {
      let query = client.from("chain_launch_events")
        .select("pool_address,dex,fee,launch_token,quote_token,symbol,name,quote_symbol,block_number", {
          count: "exact",
        })
        .order("block_number", { ascending: false })
        .limit(limit);
      if (since) {
        query = query.gt("detected_at", since);
      }
      const result = await query;
      check(result);
      return {
        total: result.count ?? 0,
        events: (result.data ?? []).map((row: Record<string, unknown>) => ({
          poolAddress: String(row.pool_address),
          dex: row.dex === "v3" ? "v3" : "v2",
          fee: typeof row.fee === "number" ? row.fee : null,
          launchToken: String(row.launch_token),
          quoteToken: String(row.quote_token),
          symbol: String(row.symbol ?? ""),
          name: String(row.name ?? ""),
          quoteSymbol: String(row.quote_symbol ?? ""),
          blockNumber: Number(row.block_number),
        } as LaunchEvent)),
      };
    },
    async markDigestSent(agentId, at) {
      check(await client.from("agent_launch_subscriptions").update({ last_digest_at: at }).eq("agent_id", agentId));
    },
    async listWatchItems(limit) {
      const result = await client.from("agent_watch_items")
        .select("id,agent_id,address,kind,label,last_block,last_price_usd")
        .order("created_at", { ascending: true })
        .limit(limit);
      check(result);
      return (result.data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        agentId: String(row.agent_id),
        address: String(row.address),
        kind: row.kind === "token" ? "token" : "wallet",
        label: String(row.label ?? ""),
        lastBlock: row.last_block === null ? null : Number(row.last_block),
        lastPriceUsd: row.last_price_usd === null ? null : Number(row.last_price_usd),
      }));
    },
    async updateWatchItem(id, patch) {
      check(await client.from("agent_watch_items").update({
        ...(patch.lastBlock !== undefined ? { last_block: patch.lastBlock } : {}),
        ...(patch.lastPriceUsd !== undefined ? { last_price_usd: patch.lastPriceUsd } : {}),
      }).eq("id", id));
    },
    async activeAlerts(limit) {
      const result = await client.from("agent_price_alerts")
        .select("id,agent_id,token_address,token_label,direction,target_usd")
        .is("triggered_at", null)
        .limit(limit);
      check(result);
      return (result.data ?? []).map((row: Record<string, unknown>) => ({
        id: String(row.id),
        agentId: String(row.agent_id),
        tokenAddress: String(row.token_address),
        tokenLabel: String(row.token_label ?? ""),
        direction: row.direction === "below" ? "below" : "above",
        targetUsd: Number(row.target_usd),
      }));
    },
    async claimAlert(id, priceUsd) {
      const result = await client.from("agent_price_alerts")
        .update({ triggered_at: new Date().toISOString(), triggered_price_usd: priceUsd })
        .eq("id", id)
        .is("triggered_at", null)
        .select("id");
      check(result);
      return Array.isArray(result.data) && result.data.length === 1;
    },
    async releaseAlert(id) {
      check(await client.from("agent_price_alerts")
        .update({ triggered_at: null, triggered_price_usd: null })
        .eq("id", id));
    },
  };
}

// deno-lint-ignore no-explicit-any
function createSender(client: any): MonitorSend {
  const routes = new Map<string, { sessionId: string; chatId: string; botToken: string } | null>();

  return async (agentId, kind, text) => {
    try {
      if (!routes.has(agentId)) {
        const session = await client.from("telegram_sessions")
          .select("id")
          .eq("agent_id", agentId)
          .eq("webhook_status", "active")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        const owner = await client.from("telegram_chat_authorizations")
          .select("telegram_chat_id")
          .eq("agent_id", agentId)
          .eq("role", "owner")
          .is("revoked_at", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        let route = null;
        if (session.data?.id && owner.data?.telegram_chat_id) {
          const token = await client.rpc("resolve_telegram_delivery_token", {
            p_telegram_session_id: session.data.id,
          });
          if (!token.error && typeof token.data === "string" && token.data) {
            route = {
              sessionId: String(session.data.id),
              chatId: String(owner.data.telegram_chat_id),
              botToken: token.data,
            };
          }
        }
        routes.set(agentId, route);
      }

      const route = routes.get(agentId);
      if (!route) {
        return false;
      }

      await deliverTelegramReadOnlyResponse({
        botToken: route.botToken,
        telegramChatId: route.chatId,
        response: { command: kind, text },
      });
      return true;
    } catch {
      logSafeEvent("telegram_monitor_delivery_failed", kind);
      return false;
    }
  };
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ ok: false, status: "method_not_allowed" }, 405);
  }

  const expected = Deno.env.get("KYRA_MONITOR_SECRET") ?? "";
  const provided = request.headers.get("x-kyra-monitor-secret") ?? "";

  if (expected.length < 32) {
    return jsonResponse({ ok: false, status: "not_configured" }, 503);
  }

  if (!provided || !await secretsMatch(provided, expected)) {
    return jsonResponse({ ok: false, status: "unauthorized" }, 401);
  }

  const rpcConfig = readChainDataRpcConfig((key) => Deno.env.get(key));
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!rpcConfig || !supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ ok: false, status: "not_configured" }, 503);
  }

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const report = await runMonitorCycle(
      createStore(client),
      createChain(rpcConfig.rpcUrl),
      createSender(client),
    );
    for (const step of report.skipped) {
      logSafeEvent("telegram_monitor_step_skipped", step);
    }
    return jsonResponse({ ok: true, status: "done", ...report });
  } catch {
    logSafeEvent("telegram_monitor_failed", "cycle_error");
    return jsonResponse({ ok: false, status: "cycle_failed" }, 500);
  }
});
