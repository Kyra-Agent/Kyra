import {
  decodeFunctionResult,
  encodeFunctionData,
  erc20Abi,
  parseAbi,
} from "npm:viem@2.57.7";
import {
  getSwapToken,
  nativeSwapTokenAddress,
  swapQuoteLifetimeMs,
  type SwapQuoteRequest,
  type SwapTokenAddress,
  type SwapTokenSymbol,
} from "../_shared/swap-quote-policy.ts";
import {
  robinhoodWethAddress,
  swapRouterSelfRecipient,
  uniswapQuoterV2Address,
  uniswapSwapRouter02Address,
  uniswapV3FeeTiers,
} from "../_shared/uniswap-robinhood.ts";
import { HttpError } from "./core.ts";

// Quotes and builds Uniswap V3 swaps on Robinhood Chain straight from the
// chain: QuoterV2 prices every fee tier, the best one wins, and the exact
// SwapRouter02 call is simulated from the owner's wallet before the quote is
// stored. No third-party quote API or key is involved.

export const uniswapSwapProvider = "uniswap_v3_robinhood" as const;

export interface ReviewedSwapQuote {
  status: "quote_ready" | "allowance_required";
  provider: typeof uniswapSwapProvider;
  sellTokenAddress: SwapTokenAddress;
  sellTokenSymbol: SwapTokenSymbol;
  sellTokenDecimals: 18 | 6;
  buyTokenAddress: SwapTokenAddress;
  buyTokenSymbol: SwapTokenSymbol;
  buyTokenDecimals: 18 | 6;
  sellAmountAtomic: string;
  buyAmountAtomic: string;
  minimumBuyAmountAtomic: string;
  slippageBps: number;
  allowanceTarget: `0x${string}` | null;
  transactionTo: `0x${string}`;
  transactionData: `0x${string}`;
  transactionValueWei: string;
  liquiditySources: string[];
  routeSummary: string;
  issuedAt: string;
  expiresAt: string;
}

export interface UniswapQuoteConfig {
  rpcUrl: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
  now?: Date;
}

const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);
const routerAbi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
  "function unwrapWETH9(uint256 amountMinimum, address recipient) payable",
]);
// The router call stays valid a little longer than the quote, so a wallet
// prompt confirmed near the end of the quote window still lands.
const deadlineGraceSeconds = 600;

interface RpcCall {
  method: string;
  params: unknown[];
}

type RpcOutcome = { ok: true; result: unknown } | { ok: false };

export async function fetchReviewedUniswapQuote(
  request: SwapQuoteRequest,
  config: UniswapQuoteConfig,
): Promise<ReviewedSwapQuote> {
  const sell = getSwapToken(request.sellToken);
  const buy = getSwapToken(request.buyToken);
  const sellsNative = sell.address === nativeSwapTokenAddress;
  const buysNative = buy.address === nativeSwapTokenAddress;
  const tokenIn = sellsNative ? robinhoodWethAddress : sell.address;
  const tokenOut = buysNative ? robinhoodWethAddress : buy.address;
  const amountIn = BigInt(request.sellAmount);
  const rpc = createRpc(config);

  const quoteCalls = uniswapV3FeeTiers.map((fee): RpcCall => ({
    method: "eth_call",
    params: [{
      to: uniswapQuoterV2Address,
      data: encodeFunctionData({
        abi: quoterAbi,
        functionName: "quoteExactInputSingle",
        args: [{ tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0n }],
      }),
    }, "latest"],
  }));
  const balanceCall: RpcCall = sellsNative
    ? { method: "eth_getBalance", params: [request.taker, "latest"] }
    : {
      method: "eth_call",
      params: [{
        to: sell.address,
        data: encodeFunctionData({ abi: erc20Abi, functionName: "balanceOf", args: [request.taker] }),
      }, "latest"],
    };
  const allowanceCalls: RpcCall[] = sellsNative ? [] : [{
    method: "eth_call",
    params: [{
      to: sell.address,
      data: encodeFunctionData({
        abi: erc20Abi,
        functionName: "allowance",
        args: [request.taker, uniswapSwapRouter02Address],
      }),
    }, "latest"],
  }];

  const outcomes = await rpc([...quoteCalls, balanceCall, ...allowanceCalls]);

  let best: { fee: number; amountOut: bigint } | null = null;
  uniswapV3FeeTiers.forEach((fee, index) => {
    const amountOut = readQuoteAmountOut(outcomes[index]);
    if (amountOut !== null && amountOut > 0n && (!best || amountOut > best.amountOut)) {
      best = { fee, amountOut };
    }
  });
  const route = best as { fee: number; amountOut: bigint } | null;
  if (!route) {
    throw new HttpError(
      409,
      "swap_route_unavailable",
      "No Uniswap pool on Robinhood Chain can fill this swap right now.",
    );
  }

  const balance = readUint(outcomes[quoteCalls.length]);
  if (balance === null) throw providerUnavailable();
  if (balance < amountIn) {
    throw new HttpError(
      409,
      "insufficient_balance",
      `Your wallet holds less ${sell.symbol} than this swap sells.`,
    );
  }

  const minimumOut = route.amountOut * BigInt(10_000 - request.slippageBps) / 10_000n;
  if (minimumOut <= 0n) {
    throw new HttpError(
      409,
      "swap_amount_too_small",
      "This amount is too small to swap. Try a larger amount.",
    );
  }

  let status: ReviewedSwapQuote["status"] = "quote_ready";
  if (!sellsNative) {
    const allowance = readUint(outcomes[quoteCalls.length + 1]);
    if (allowance === null) throw providerUnavailable();
    if (allowance < amountIn) status = "allowance_required";
  }

  const issuedAtMs = (config.now ?? new Date()).getTime();
  const issuedAt = new Date(issuedAtMs).toISOString();
  const expiresAt = new Date(issuedAtMs + swapQuoteLifetimeMs).toISOString();
  const deadline = BigInt(Math.floor((issuedAtMs + swapQuoteLifetimeMs) / 1000) + deadlineGraceSeconds);

  const swapCall = encodeFunctionData({
    abi: routerAbi,
    functionName: "exactInputSingle",
    args: [{
      tokenIn,
      tokenOut,
      fee: route.fee,
      recipient: buysNative ? swapRouterSelfRecipient : request.taker,
      amountIn,
      amountOutMinimum: minimumOut,
      sqrtPriceLimitX96: 0n,
    }],
  });
  const steps = buysNative
    ? [
      swapCall,
      encodeFunctionData({
        abi: routerAbi,
        functionName: "unwrapWETH9",
        args: [minimumOut, request.taker],
      }),
    ]
    : [swapCall];
  const transactionData = encodeFunctionData({
    abi: routerAbi,
    functionName: "multicall",
    args: [deadline, steps],
  }).toLowerCase() as `0x${string}`;
  const transactionValueWei = sellsNative ? amountIn.toString() : "0";

  // A swap the owner can sign right away must succeed when simulated from
  // their wallet. Allowance-pending swaps are simulated on the fresh quote
  // after the allowance confirms.
  if (status === "quote_ready") {
    const [simulation] = await rpc([{
      method: "eth_call",
      params: [{
        from: request.taker,
        to: uniswapSwapRouter02Address,
        data: transactionData,
        value: `0x${BigInt(transactionValueWei).toString(16)}`,
      }, "latest"],
    }]);
    if (!simulation?.ok) {
      throw new HttpError(
        409,
        "swap_simulation_failed",
        "This swap would fail on Robinhood Chain right now. Try a smaller amount or a fresh quote.",
      );
    }
  }

  return {
    status,
    provider: uniswapSwapProvider,
    sellTokenAddress: sell.address,
    sellTokenSymbol: sell.symbol,
    sellTokenDecimals: sell.decimals,
    buyTokenAddress: buy.address,
    buyTokenSymbol: buy.symbol,
    buyTokenDecimals: buy.decimals,
    sellAmountAtomic: amountIn.toString(),
    buyAmountAtomic: route.amountOut.toString(),
    minimumBuyAmountAtomic: minimumOut.toString(),
    slippageBps: request.slippageBps,
    allowanceTarget: sellsNative ? null : uniswapSwapRouter02Address,
    transactionTo: uniswapSwapRouter02Address,
    transactionData,
    transactionValueWei,
    liquiditySources: [`uniswap_v3_${route.fee}`],
    routeSummary: `${sell.symbol} to ${buy.symbol} through the Uniswap V3 ${
      route.fee / 10_000
    }% pool on Robinhood Chain.`,
    issuedAt,
    expiresAt,
  };
}

function readQuoteAmountOut(outcome: RpcOutcome | undefined) {
  if (!outcome?.ok || typeof outcome.result !== "string" || outcome.result === "0x") {
    return null;
  }
  try {
    const [amountOut] = decodeFunctionResult({
      abi: quoterAbi,
      functionName: "quoteExactInputSingle",
      data: outcome.result as `0x${string}`,
    });
    return amountOut;
  } catch {
    return null;
  }
}

function readUint(outcome: RpcOutcome | undefined) {
  if (!outcome?.ok || typeof outcome.result !== "string" || !/^0x[0-9a-f]+$/iu.test(outcome.result)) {
    return null;
  }
  try {
    return BigInt(outcome.result);
  } catch {
    return null;
  }
}

function createRpc(config: UniswapQuoteConfig) {
  const fetchImpl = config.fetchImpl ?? fetch;

  return async (calls: RpcCall[]): Promise<RpcOutcome[]> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const response = await fetchImpl(config.rpcUrl, {
        method: "POST",
        redirect: "error",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(calls.map((call, id) => ({ jsonrpc: "2.0", id, ...call }))),
        signal: controller.signal,
      });
      if (!response.ok) throw providerUnavailable();
      const payload = await response.json();
      if (!Array.isArray(payload)) throw providerUnavailable();

      const outcomes: RpcOutcome[] = calls.map(() => ({ ok: false }));
      for (const item of payload) {
        if (
          typeof item === "object" && item !== null &&
          typeof item.id === "number" && item.id >= 0 && item.id < calls.length
        ) {
          outcomes[item.id] = "result" in item && !item.error
            ? { ok: true, result: item.result }
            : { ok: false };
        }
      }
      return outcomes;
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw providerUnavailable();
    } finally {
      clearTimeout(timer);
    }
  };
}

function providerUnavailable() {
  return new HttpError(
    503,
    "swap_quote_unavailable",
    "Robinhood Chain quotes are temporarily unavailable. Try again shortly.",
  );
}
