import { decodeFunctionData, encodeFunctionResult, parseAbi } from "npm:viem@2.57.7";
import { fetchReviewedUniswapQuote } from "./uniswap-provider.ts";
import {
  nativeSwapTokenAddress,
  type SwapQuoteRequest,
  usdgTokenAddress,
} from "../_shared/swap-quote-policy.ts";
import {
  robinhoodWethAddress,
  swapRouterSelfRecipient,
  uniswapQuoterV2Address,
  uniswapSwapRouter02Address,
} from "../_shared/uniswap-robinhood.ts";

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

async function assertRejectsCode(run: () => Promise<unknown>, code: string) {
  try {
    await run();
  } catch (error) {
    assertEquals((error as { code?: string }).code, code);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

const taker = "0x5eD0A4244eFFfc82ECdC775212a0245D46C8ae0D" as const;
const quoterAbi = parseAbi([
  "function quoteExactInputSingle((address tokenIn,address tokenOut,uint256 amountIn,uint24 fee,uint160 sqrtPriceLimitX96)) returns (uint256 amountOut,uint160 sqrtPriceX96After,uint32 initializedTicksCrossed,uint256 gasEstimate)",
]);
const routerAbi = parseAbi([
  "function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96)) payable returns (uint256 amountOut)",
  "function multicall(uint256 deadline, bytes[] data) payable returns (bytes[] results)",
  "function unwrapWETH9(uint256 amountMinimum, address recipient) payable",
]);

function request(overrides: Partial<SwapQuoteRequest> = {}): SwapQuoteRequest {
  return {
    workspaceId: "bdcd05c0-b169-41c7-a10a-4eeb20572525",
    agentId: "f6b9cbab-a55e-4f4d-b2b2-a1b53d2aca46",
    requestId: "swap-test-0001",
    chainKey: "robinhood_mainnet",
    chainId: 4663,
    taker,
    sellToken: nativeSwapTokenAddress,
    buyToken: usdgTokenAddress,
    sellAmount: "100000000000000",
    slippageBps: 100,
    policyVersion: 2,
    ...overrides,
  };
}

// Answers JSON-RPC batches the way Robinhood Chain would.
function fakeChain(options: {
  quotes?: Record<number, bigint>;
  balance?: bigint;
  allowance?: bigint;
  simulationFails?: boolean;
} = {}) {
  const simulations: Array<Record<string, string>> = [];
  const fetchImpl = (async (_url: string, init?: RequestInit) => {
    const batch = JSON.parse(String(init?.body)) as Array<{ id: number; method: string; params: unknown[] }>;
    const answers = batch.map((call) => {
      if (call.method === "eth_getBalance") {
        return { id: call.id, result: `0x${(options.balance ?? 10n ** 18n).toString(16)}` };
      }
      const tx = call.params[0] as Record<string, string>;
      if (tx.to.toLowerCase() === uniswapQuoterV2Address.toLowerCase()) {
        const decoded = decodeFunctionData({ abi: quoterAbi, data: tx.data as `0x${string}` });
        const fee = Number((decoded.args[0] as { fee: number }).fee);
        const amountOut = options.quotes?.[fee];
        return amountOut === undefined
          ? { id: call.id, error: { code: 3, message: "execution reverted" } }
          : {
            id: call.id,
            result: encodeFunctionResult({
              abi: quoterAbi,
              functionName: "quoteExactInputSingle",
              result: [amountOut, 1n, 1, 90_000n],
            }),
          };
      }
      if (tx.to.toLowerCase() === uniswapSwapRouter02Address.toLowerCase()) {
        simulations.push(tx);
        return options.simulationFails
          ? { id: call.id, error: { code: 3, message: "execution reverted" } }
          : { id: call.id, result: "0x" };
      }
      const selector = tx.data.slice(0, 10);
      const value = selector === "0x70a08231" ? options.balance ?? 10n ** 18n : options.allowance ?? 0n;
      return { id: call.id, result: `0x${value.toString(16).padStart(64, "0")}` };
    });
    return new Response(JSON.stringify(answers), { status: 200 });
  }) as typeof fetch;
  return { fetchImpl, simulations };
}

const config = (fetchImpl: typeof fetch) => ({
  rpcUrl: "https://rpc.example",
  timeoutMs: 1_000,
  fetchImpl,
  now: new Date("2026-10-21T04:00:00.000Z"),
});

Deno.test("uniswap quote picks the best fee tier and builds a simulated ETH to USDG swap", async () => {
  const chain = fakeChain({ quotes: { 100: 244_416n, 500: 244_300n, 3000: 244_000n } });
  const quote = await fetchReviewedUniswapQuote(request(), config(chain.fetchImpl));

  assertEquals(quote.status, "quote_ready");
  assertEquals(quote.buyAmountAtomic, "244416");
  assertEquals(quote.minimumBuyAmountAtomic, "241971", "1% slippage is applied to the best quote.");
  assertEquals(quote.transactionTo, uniswapSwapRouter02Address);
  assertEquals(quote.transactionValueWei, "100000000000000");
  assertEquals(quote.allowanceTarget, null);
  assertEquals(quote.buyTokenDecimals, 6);
  assertEquals(quote.liquiditySources[0], "uniswap_v3_100");
  assertEquals(quote.expiresAt, "2026-10-21T04:01:15.000Z");

  const outer = decodeFunctionData({ abi: routerAbi, data: quote.transactionData });
  assertEquals(outer.functionName, "multicall");
  const [deadline, steps] = outer.args as [bigint, `0x${string}`[]];
  assertEquals(deadline, BigInt(Date.parse("2026-10-21T04:01:15.000Z") / 1000 + 600));
  assertEquals(steps.length, 1);
  const swap = decodeFunctionData({ abi: routerAbi, data: steps[0] });
  const params = swap.args[0] as Record<string, unknown>;
  assertEquals(String(params.tokenIn), robinhoodWethAddress);
  assertEquals(String(params.recipient), taker);
  assertEquals(params.amountOutMinimum, 241_971n);

  assertEquals(chain.simulations.length, 1, "A ready swap is simulated before it is stored.");
  assertEquals(chain.simulations[0].from, taker);
  assertEquals(chain.simulations[0].value, "0x5af3107a4000");
});

Deno.test("uniswap quote for USDG to ETH waits for an exact allowance and unwraps to the owner", async () => {
  const chain = fakeChain({ quotes: { 500: 408_000_000_000_000n }, balance: 2_000_000n, allowance: 0n });
  const quote = await fetchReviewedUniswapQuote(
    request({ sellToken: usdgTokenAddress, buyToken: nativeSwapTokenAddress, sellAmount: "1000000" }),
    config(chain.fetchImpl),
  );

  assertEquals(quote.status, "allowance_required");
  assertEquals(quote.allowanceTarget, uniswapSwapRouter02Address);
  assertEquals(quote.transactionValueWei, "0");
  assertEquals(chain.simulations.length, 0, "An allowance-pending swap cannot be simulated yet.");

  const [, steps] = decodeFunctionData({ abi: routerAbi, data: quote.transactionData }).args as [bigint, `0x${string}`[]];
  assertEquals(steps.length, 2);
  const swap = decodeFunctionData({ abi: routerAbi, data: steps[0] }).args[0] as Record<string, unknown>;
  assertEquals(String(swap.recipient), swapRouterSelfRecipient);
  const unwrap = decodeFunctionData({ abi: routerAbi, data: steps[1] });
  assertEquals(unwrap.functionName, "unwrapWETH9");
  assertEquals(String(unwrap.args[1]), taker);
  assertEquals(unwrap.args[0], swap.amountOutMinimum, "The unwrap minimum matches the swap minimum.");
});

Deno.test("uniswap quote is ready once the USDG allowance covers the sale", async () => {
  const chain = fakeChain({ quotes: { 500: 408_000_000_000_000n }, balance: 2_000_000n, allowance: 1_000_000n });
  const quote = await fetchReviewedUniswapQuote(
    request({ sellToken: usdgTokenAddress, buyToken: nativeSwapTokenAddress, sellAmount: "1000000" }),
    config(chain.fetchImpl),
  );
  assertEquals(quote.status, "quote_ready");
  assertEquals(chain.simulations.length, 1);
  assertEquals(chain.simulations[0].value, "0x0");
});

Deno.test("uniswap quote refuses missing routes, short balances, dust, and failing simulations", async () => {
  await assertRejectsCode(
    () => fetchReviewedUniswapQuote(request(), config(fakeChain({ quotes: {} }).fetchImpl)),
    "swap_route_unavailable",
  );
  await assertRejectsCode(
    () => fetchReviewedUniswapQuote(request(), config(fakeChain({ quotes: { 500: 244_000n }, balance: 1n }).fetchImpl)),
    "insufficient_balance",
  );
  await assertRejectsCode(
    () => fetchReviewedUniswapQuote(request(), config(fakeChain({ quotes: { 500: 1n } }).fetchImpl)),
    "swap_amount_too_small",
  );
  await assertRejectsCode(
    () =>
      fetchReviewedUniswapQuote(
        request(),
        config(fakeChain({ quotes: { 500: 244_000n }, simulationFails: true }).fetchImpl),
      ),
    "swap_simulation_failed",
  );
});

Deno.test("uniswap quote reports an unreachable chain as temporarily unavailable", async () => {
  const failing = (async () => new Response("oops", { status: 502 })) as typeof fetch;
  await assertRejectsCode(
    () => fetchReviewedUniswapQuote(request(), config(failing)),
    "swap_quote_unavailable",
  );
});
