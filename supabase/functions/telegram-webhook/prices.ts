import { decodeAbiParameters, encodeFunctionData, parseAbi } from "npm:viem@2.57.7";
import { ethCall, readHexBigInt, type RpcCall } from "./chain-data.ts";

// USD prices read straight from Robinhood Chain DEX pools, with USDG as the
// dollar. Uniswap V3 pools are preferred (deepest liquidity wins); the large
// V2-style launchpad factories are a fallback with a minimum-liquidity guard.
// No third-party price API is involved.

export interface PriceToken {
  address: string;
  decimals: number;
}

export interface TokenPrice {
  usd: number;
  source: "usdg" | "uniswap_v3" | "v2_pool";
}

type BatchRpc = (calls: RpcCall[]) => Promise<unknown[]>;

export const wethAddress = "0x0bd7d308f8e1639fab988df18a8011f41eacad73";
export const usdgAddress = "0x5fc5360d0400a0fd4f2af552add042d716f1d168";
export const uniswapV3Factory = "0x1f7d7550b1b028f7571e69a784071f0205fd2efa";
export const v2Factories = [
  "0x8bceaa40b9acdfaedf85adf4ff01f5ad6517937f",
  "0x0d1ebb179cdbca88d74c923c4255cb2b17474afd",
  "0xfc2e4da3edb2e18100473339c763705d263d20a9",
] as const;

const v3Fees = [100, 500, 3000, 10000] as const;
const minV2QuoteUsd = 500;
const abi = parseAbi([
  "function getPool(address,address,uint24) view returns (address)",
  "function getPair(address,address) view returns (address)",
  "function slot0() view returns (uint160,int24,uint16,uint16,uint16,uint8,bool)",
  "function liquidity() view returns (uint128)",
  "function token0() view returns (address)",
  "function getReserves() view returns (uint112,uint112,uint32)",
]);

interface PoolRef {
  kind: "v3" | "v2";
  pool: string;
  token: string;
  quote: string;
}

// Returns a USD price per token address (lowercase), or null when no pool
// with usable liquidity exists.
export async function readTokenPricesUsd(
  rpc: BatchRpc,
  tokens: readonly PriceToken[],
): Promise<Map<string, TokenPrice | null>> {
  const result = new Map<string, TokenPrice | null>();
  const decimals = new Map<string, number>([
    [wethAddress, 18],
    [usdgAddress, 6],
  ]);
  const wanted = [...new Map(tokens.map((token) => [token.address.toLowerCase(), token])).values()];

  for (const token of wanted) {
    decimals.set(token.address.toLowerCase(), token.decimals);
  }

  // Step 1: find pools. WETH/USDG is always needed to price WETH pairs.
  const lookups: Array<{ ref: Omit<PoolRef, "pool">; call: RpcCall }> = [];
  const pairs: Array<[string, string]> = [[wethAddress, usdgAddress]];

  for (const token of wanted) {
    const address = token.address.toLowerCase();
    if (address === usdgAddress) {
      continue;
    }
    pairs.push([address, usdgAddress]);
    if (address !== wethAddress) {
      pairs.push([address, wethAddress]);
    }
  }

  for (const [token, quote] of pairs) {
    for (const fee of v3Fees) {
      lookups.push({
        ref: { kind: "v3", token, quote },
        call: ethCall(
          uniswapV3Factory,
          encodeFunctionData({ abi, functionName: "getPool", args: [token as `0x${string}`, quote as `0x${string}`, fee] }),
        ),
      });
    }
    for (const factory of v2Factories) {
      lookups.push({
        ref: { kind: "v2", token, quote },
        call: ethCall(
          factory,
          encodeFunctionData({ abi, functionName: "getPair", args: [token as `0x${string}`, quote as `0x${string}`] }),
        ),
      });
    }
  }

  const found = await rpc(lookups.map((lookup) => lookup.call));
  const pools: PoolRef[] = [];

  found.forEach((value, index) => {
    const pool = readAddress(value);
    if (pool) {
      pools.push({ ...lookups[index].ref, pool });
    }
  });

  // Step 2: read pool state. V3 pools need slot0, liquidity, token0; V2
  // pairs need getReserves and token0.
  const offsets: number[] = [];
  const stateCalls: RpcCall[] = [];

  for (const pool of pools) {
    offsets.push(stateCalls.length);
    if (pool.kind === "v3") {
      stateCalls.push(
        ethCall(pool.pool, encodeFunctionData({ abi, functionName: "slot0" })),
        ethCall(pool.pool, encodeFunctionData({ abi, functionName: "liquidity" })),
        ethCall(pool.pool, encodeFunctionData({ abi, functionName: "token0" })),
      );
    } else {
      stateCalls.push(
        ethCall(pool.pool, encodeFunctionData({ abi, functionName: "getReserves" })),
        ethCall(pool.pool, encodeFunctionData({ abi, functionName: "token0" })),
      );
    }
  }

  const states = stateCalls.length ? await rpc(stateCalls) : [];

  interface Quote {
    priceInQuote: number;
    depth: number;
    quote: string;
    kind: "v3" | "v2";
    quoteReserve: number;
  }
  const quotes = new Map<string, Quote[]>();

  pools.forEach((pool, index) => {
    const base = offsets[index];
    const token0 = readAddress(states[pool.kind === "v3" ? base + 2 : base + 1]);
    const tokenDecimals = decimals.get(pool.token) ?? 18;
    const quoteDecimals = decimals.get(pool.quote) ?? 18;

    if (!token0) {
      return;
    }

    const tokenIs0 = token0 === pool.token;
    let priceInQuote: number | null = null;
    let depth = 0;
    let quoteReserve = Number.POSITIVE_INFINITY;

    if (pool.kind === "v3") {
      const sqrt = readHexBigInt(typeof states[base] === "string" ? (states[base] as string).slice(0, 66) : null);
      const liquidity = readHexBigInt(states[base + 1]);
      if (!sqrt || sqrt === 0n || !liquidity || liquidity === 0n) {
        return;
      }
      const raw = (Number(sqrt) / 2 ** 96) ** 2; // token1 per token0, raw units
      const rawQuotePerToken = tokenIs0 ? raw : 1 / raw;
      priceInQuote = rawQuotePerToken * 10 ** (tokenDecimals - quoteDecimals);
      depth = Number(liquidity);
    } else {
      const reserves = decodeReserves(states[base]);
      if (!reserves) {
        return;
      }
      const [r0, r1] = reserves;
      const tokenReserve = Number(tokenIs0 ? r0 : r1) / 10 ** tokenDecimals;
      quoteReserve = Number(tokenIs0 ? r1 : r0) / 10 ** quoteDecimals;
      if (tokenReserve <= 0 || quoteReserve <= 0) {
        return;
      }
      priceInQuote = quoteReserve / tokenReserve;
      depth = quoteReserve;
    }

    if (priceInQuote === null || !Number.isFinite(priceInQuote) || priceInQuote <= 0) {
      return;
    }

    const list = quotes.get(pool.token) ?? [];
    list.push({ priceInQuote, depth, quote: pool.quote, kind: pool.kind, quoteReserve });
    quotes.set(pool.token, list);
  });

  const ethUsd = pickBest(quotes.get(wethAddress), usdgAddress)?.priceInQuote ?? null;

  for (const token of wanted) {
    const address = token.address.toLowerCase();

    if (address === usdgAddress) {
      result.set(address, { usd: 1, source: "usdg" });
      continue;
    }

    const list = quotes.get(address) ?? [];
    const priced = list
      .map((quote) => {
        const quoteUsd = quote.quote === usdgAddress ? 1 : ethUsd;
        if (quoteUsd === null) {
          return null;
        }
        if (quote.kind === "v2" && quote.quoteReserve * quoteUsd < minV2QuoteUsd) {
          return null;
        }
        return { ...quote, usd: quote.priceInQuote * quoteUsd };
      })
      .filter((quote): quote is NonNullable<typeof quote> => quote !== null);

    const v3 = priced.filter((quote) => quote.kind === "v3").sort((a, b) => b.depth - a.depth)[0];
    const v2 = priced.filter((quote) => quote.kind === "v2")
      .sort((a, b) => b.quoteReserve - a.quoteReserve)[0];
    const best = v3 ?? v2;

    result.set(
      address,
      best ? { usd: best.usd, source: best.kind === "v3" ? "uniswap_v3" : "v2_pool" } : null,
    );
  }

  return result;
}

export function formatUsd(value: number) {
  if (!Number.isFinite(value)) {
    return "?";
  }
  if (value >= 1000) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  }
  if (value >= 1) {
    return `$${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
  }
  if (value >= 0.0001) {
    return `$${value.toPrecision(3)}`;
  }
  return value > 0 ? "<$0.0001" : "$0";
}

function pickBest(list: readonly { priceInQuote: number; depth: number; quote: string; kind: "v3" | "v2" }[] | undefined, quote: string) {
  return (list ?? [])
    .filter((item) => item.quote === quote && item.kind === "v3")
    .sort((a, b) => b.depth - a.depth)[0];
}

function readAddress(value: unknown) {
  if (typeof value !== "string" || value.length < 66) {
    return null;
  }

  try {
    const [address] = decodeAbiParameters([{ type: "address" }], value as `0x${string}`);
    const lower = address.toLowerCase();
    return /^0x0{40}$/.test(lower) ? null : lower;
  } catch {
    return null;
  }
}

function decodeReserves(value: unknown) {
  if (typeof value !== "string" || value.length < 194) {
    return null;
  }

  try {
    const [r0, r1] = decodeAbiParameters(
      [{ type: "uint112" }, { type: "uint112" }, { type: "uint32" }],
      value as `0x${string}`,
    );
    return [r0, r1] as const;
  } catch {
    return null;
  }
}
