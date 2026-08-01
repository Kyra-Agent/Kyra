import {
  assertEquals,
  assertRejects,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { encodeFunctionData } from "npm:viem@2.52.2";
import {
  kyraTokenAddress,
  robinhoodMainnetChainId,
  robinhoodMainnetChainKey,
} from "../_shared/transfer-transaction-policy.ts";
import {
  swapQuotePolicyVersion,
  type SwapQuoteRequest,
  zeroExNativeTokenAddress,
} from "../_shared/swap-quote-policy.ts";
import { HttpError } from "./core.ts";
import {
  fetchReviewedZeroExQuote,
  readBoundedProviderBody,
  reviewZeroExQuote,
} from "./provider.ts";

const taker = "0x2cfB1A2C7F70C2011C837b89d74a25b7bbfd0d2e";
const transactionTarget = "0x111111125421cA6dc452d289314280a0f8842A65";
const allowanceTarget = "0x0000000000001fF3684f28c67538d4D072C22734";
const allowanceHolderAbi = [{
  type: "function",
  name: "exec",
  stateMutability: "payable",
  inputs: [
    { name: "operator", type: "address" },
    { name: "token", type: "address" },
    { name: "amount", type: "uint256" },
    { name: "target", type: "address" },
    { name: "data", type: "bytes" },
  ],
  outputs: [{ name: "result", type: "bytes" }],
}] as const;
const settlerExecuteAbi = [{
  type: "function",
  name: "execute",
  stateMutability: "payable",
  inputs: [
    {
      name: "slippage",
      type: "tuple",
      components: [
        { name: "recipient", type: "address" },
        { name: "buyToken", type: "address" },
        { name: "minAmountOut", type: "uint256" },
      ],
    },
    { name: "actions", type: "bytes[]" },
    { name: "makerPaymentRecipient", type: "bytes32" },
  ],
  outputs: [{ name: "", type: "bool" }],
}] as const;

function request(overrides: Partial<SwapQuoteRequest> = {}): SwapQuoteRequest {
  return {
    workspaceId: "2094f3e1-3657-4754-98b9-470e8d72e14a",
    agentId: "2f538ddd-e2e8-4ba2-89a3-cab4a4a85799",
    requestId: "swap:test:0001",
    chainKey: robinhoodMainnetChainKey,
    chainId: robinhoodMainnetChainId,
    taker,
    sellToken: zeroExNativeTokenAddress,
    buyToken: kyraTokenAddress,
    sellAmount: "1000000000000000",
    slippageBps: 50,
    policyVersion: swapQuotePolicyVersion,
    ...overrides,
  };
}

function settlerData(
  quoteRequest: SwapQuoteRequest,
  minimumBuyAmount = "99500000000000000000",
) {
  return encodeFunctionData({
    abi: settlerExecuteAbi,
    functionName: "execute",
    args: [
      {
        recipient: quoteRequest.taker,
        buyToken: quoteRequest.buyToken,
        minAmountOut: BigInt(minimumBuyAmount),
      },
      ["0x1234"],
      `0x${"00".repeat(32)}`,
    ],
  });
}

function payload(overrides: Record<string, unknown> = {}) {
  return {
    liquidityAvailable: true,
    sellToken: zeroExNativeTokenAddress,
    buyToken: kyraTokenAddress,
    sellAmount: "1000000000000000",
    buyAmount: "100000000000000000000",
    minBuyAmount: "99500000000000000000",
    allowanceTarget: null,
    issues: {
      allowance: null,
      balance: null,
      simulationIncomplete: false,
      invalidSources: [],
    },
    route: { fills: [{ source: "Uniswap_V3" }] },
    transaction: {
      from: taker,
      to: transactionTarget,
      data: settlerData(request()),
      value: "1000000000000000",
    },
    ...overrides,
  };
}

const config = {
  allowedTransactionTargets: new Set([
    transactionTarget.toLowerCase(),
    allowanceTarget.toLowerCase(),
  ]),
  allowedAllowanceTargets: new Set([allowanceTarget.toLowerCase()]),
  allowedLiquiditySources: new Set(["Uniswap_V3"]),
};

Deno.test("accepts a fully allowlisted native quote", () => {
  const quote = reviewZeroExQuote(
    payload(),
    request(),
    config,
    new Date("2026-07-31T00:00:00Z"),
  );
  assertEquals(quote.status, "quote_ready");
  assertEquals(quote.transactionValueWei, "1000000000000000");
  assertEquals(quote.expiresAt, "2026-07-31T00:01:15.000Z");
});

Deno.test("marks a KYRA sell quote as allowance required", () => {
  const quoteRequest = request({
    sellToken: kyraTokenAddress,
    buyToken: zeroExNativeTokenAddress,
    sellAmount: "100000000000000000000",
  });
  const quotePayload = payload({
    sellToken: kyraTokenAddress,
    buyToken: zeroExNativeTokenAddress,
    sellAmount: quoteRequest.sellAmount,
    allowanceTarget,
    issues: {
      allowance: { spender: allowanceTarget },
      balance: null,
      simulationIncomplete: false,
      invalidSources: [],
    },
    transaction: {
      from: taker,
      to: allowanceTarget,
      data: encodeFunctionData({
        abi: allowanceHolderAbi,
        functionName: "exec",
        args: [
          transactionTarget,
          kyraTokenAddress,
          BigInt(quoteRequest.sellAmount),
          transactionTarget,
          settlerData(quoteRequest),
        ],
      }),
      value: "0",
    },
  });
  const quote = reviewZeroExQuote(
    quotePayload,
    quoteRequest,
    config,
    new Date(),
  );
  assertEquals(quote.status, "allowance_required");
});

Deno.test("rejects native calldata with a mismatched recipient or minimum output", () => {
  const mismatchedRecipient = request({
    taker: "0x3333333333333333333333333333333333333333",
  });
  const invalidPayloads = [
    payload({
      transaction: {
        from: taker,
        to: transactionTarget,
        data: settlerData(mismatchedRecipient),
        value: "1000000000000000",
      },
    }),
    payload({
      transaction: {
        from: taker,
        to: transactionTarget,
        data: settlerData(request(), "99499999999999999999"),
        value: "1000000000000000",
      },
    }),
  ];

  for (const value of invalidPayloads) {
    assertThrows(
      () => reviewZeroExQuote(value, request(), config, new Date()),
      HttpError,
    );
  }
});

Deno.test("rejects ERC-20 calldata with a mismatched amount or inner target", () => {
  const quoteRequest = request({
    sellToken: kyraTokenAddress,
    buyToken: zeroExNativeTokenAddress,
    sellAmount: "100000000000000000000",
  });
  const createPayload = (amount: bigint, target: `0x${string}`) =>
    payload({
      sellToken: kyraTokenAddress,
      buyToken: zeroExNativeTokenAddress,
      sellAmount: quoteRequest.sellAmount,
      allowanceTarget,
      issues: {
        allowance: { spender: allowanceTarget },
        balance: null,
        simulationIncomplete: false,
        invalidSources: [],
      },
      transaction: {
        from: taker,
        to: allowanceTarget,
        data: encodeFunctionData({
          abi: allowanceHolderAbi,
          functionName: "exec",
          args: [
            target,
            kyraTokenAddress,
            amount,
            target,
            settlerData(quoteRequest),
          ],
        }),
        value: "0",
      },
    });

  for (
    const value of [
      createPayload(BigInt(quoteRequest.sellAmount) - 1n, transactionTarget),
      createPayload(
        BigInt(quoteRequest.sellAmount),
        "0x2222222222222222222222222222222222222222",
      ),
    ]
  ) {
    assertThrows(
      () => reviewZeroExQuote(value, quoteRequest, config, new Date()),
      HttpError,
    );
  }
});

Deno.test("fails closed on provider issues and untrusted transaction fields", () => {
  const invalidPayloads = [
    payload({
      issues: {
        allowance: null,
        balance: { actual: "0" },
        simulationIncomplete: false,
        invalidSources: [],
      },
    }),
    payload({
      issues: {
        allowance: null,
        balance: null,
        simulationIncomplete: true,
        invalidSources: [],
      },
    }),
    payload({ route: { fills: [{ source: "Untrusted" }] } }),
    payload({
      transaction: {
        from: taker,
        to: "0x2222222222222222222222222222222222222222",
        data: "0x1234",
        value: "1000000000000000",
      },
    }),
    payload({
      transaction: {
        from: taker,
        to: transactionTarget,
        data: "0x1234",
        value: "2",
      },
    }),
    payload({
      transaction: {
        from: "0x3333333333333333333333333333333333333333",
        to: transactionTarget,
        data: "0x1234",
        value: "1000000000000000",
      },
    }),
    payload({ allowanceTarget }),
  ];
  for (const value of invalidPayloads) {
    assertThrows(
      () => reviewZeroExQuote(value, request(), config, new Date()),
      HttpError,
    );
  }
});

Deno.test("rejects routes and calldata that exceed database policy limits", () => {
  const tooManySources = Array.from(
    { length: 17 },
    (_, index) => `Source_${index}`,
  );
  const sourceConfig = {
    ...config,
    allowedLiquiditySources: new Set(tooManySources),
  };
  assertThrows(
    () =>
      reviewZeroExQuote(
        payload({
          route: {
            fills: tooManySources.map((source) => ({ source })),
          },
        }),
        request(),
        sourceConfig,
        new Date(),
      ),
    HttpError,
  );

  assertThrows(
    () =>
      reviewZeroExQuote(
        payload({
          transaction: {
            from: taker,
            to: transactionTarget,
            data: `0x${"ab".repeat(16_385)}`,
            value: "1000000000000000",
          },
        }),
        request(),
        config,
        new Date(),
      ),
    HttpError,
  );
});
Deno.test("rejects malformed UTF-8 provider bodies", async () => {
  const response = new Response(
    new Uint8Array([0xc3, 0x28]),
    { status: 200 },
  );
  await assertRejects(
    () => readBoundedProviderBody(response),
    HttpError,
  );
});

Deno.test("times out while the provider body is still streaming", async () => {
  const providerConfig = {
    ...config,
    apiKey: "test-key",
    timeoutMs: 20,
  };
  const stalledBody = () =>
    Promise.resolve(
      new Response(
        new ReadableStream<Uint8Array>({
          pull: () => new Promise<void>(() => undefined),
        }),
        { status: 200 },
      ),
    );

  const error = await assertRejects(
    () =>
      fetchReviewedZeroExQuote(
        request(),
        providerConfig,
        stalledBody as typeof fetch,
      ),
    HttpError,
  );
  assertEquals(error.code, "swap_quote_provider_unavailable");
});
Deno.test("rejects oversized provider bodies by declared and UTF-8 byte size", async () => {
  const providerConfig = {
    ...config,
    apiKey: "test-key",
    timeoutMs: 1000,
  };
  const oversizedHeader = () =>
    Promise.resolve(
      new Response("{}", {
        status: 200,
        headers: { "Content-Length": String(64 * 1024 + 1) },
      }),
    );
  await assertRejects(
    () =>
      fetchReviewedZeroExQuote(
        request(),
        providerConfig,
        oversizedHeader as typeof fetch,
      ),
    HttpError,
  );

  const oversizedUtf8 = () =>
    Promise.resolve(new Response("é".repeat(33_000), { status: 200 }));
  await assertRejects(
    () =>
      fetchReviewedZeroExQuote(
        request(),
        providerConfig,
        oversizedUtf8 as typeof fetch,
      ),
    HttpError,
  );
});
