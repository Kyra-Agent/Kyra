import assert from "node:assert/strict";
import { encodeFunctionData } from "viem";
import {
  buildZeroExQualificationUrl,
  createQualificationRequests,
  qualificationKyraTokenAddress,
  qualificationNativeTokenAddress,
  qualifyZeroExProvider,
  readBoundedQualificationBody,
  reviewQualificationQuote,
  robinhoodQualificationChainId,
  zeroExQualificationEndpoint,
} from "./protected-swap-provider-qualification.mjs";

const taker = "0x2cfB1A2C7F70C2011C837b89d74a25b7bbfd0d2e";
const transactionTarget = "0x111111125421cA6dc452d289314280a0f8842A65";
const allowanceTarget = "0x0000000000001fF3684f28c67538d4D072C22734";
const allowanceHolderNativeTokenAddress =
  "0x0000000000000000000000000000000000000000";
const secret = "qualification-secret-that-must-never-be-printed";
const requests = createQualificationRequests({ taker });
const nativeRequest = requests[0];
const erc20Request = requests[1];

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
}];
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
}];

function settlerData(request, minimumBuyAmount = "995000000000000000") {
  return encodeFunctionData({
    abi: settlerExecuteAbi,
    functionName: "execute",
    args: [
      {
        recipient: request.taker,
        buyToken: request.buyToken,
        minAmountOut: BigInt(minimumBuyAmount),
      },
      ["0x1234"],
      `0x${"00".repeat(32)}`,
    ],
  });
}

function nativePayload(overrides = {}) {
  return {
    liquidityAvailable: true,
    sellToken: qualificationNativeTokenAddress,
    buyToken: qualificationKyraTokenAddress,
    sellAmount: nativeRequest.sellAmount,
    buyAmount: "1000000000000000000",
    minBuyAmount: "995000000000000000",
    allowanceTarget: null,
    issues: {
      allowance: null,
      balance: null,
      simulationIncomplete: false,
      invalidSourcesPassed: [],
    },
    route: { fills: [{ source: "Uniswap_V3" }] },
    transaction: {
      from: taker,
      to: transactionTarget,
      data: settlerData(nativeRequest),
      value: nativeRequest.sellAmount,
    },
    ...overrides,
  };
}

function wrappedNativePayload(overrides = {}) {
  return nativePayload({
    allowanceTarget,
    transaction: {
      from: taker,
      to: allowanceTarget,
      data: encodeFunctionData({
        abi: allowanceHolderAbi,
        functionName: "exec",
        args: [
          transactionTarget,
          allowanceHolderNativeTokenAddress,
          BigInt(nativeRequest.sellAmount),
          transactionTarget,
          settlerData(nativeRequest),
        ],
      }),
      value: nativeRequest.sellAmount,
    },
    ...overrides,
  });
}

function erc20Payload(overrides = {}) {
  const innerData = settlerData(erc20Request, "995000000000");
  return {
    liquidityAvailable: true,
    sellToken: qualificationKyraTokenAddress,
    buyToken: qualificationNativeTokenAddress,
    sellAmount: erc20Request.sellAmount,
    buyAmount: "1000000000000",
    minBuyAmount: "995000000000",
    allowanceTarget,
    issues: {
      allowance: { spender: allowanceTarget },
      balance: { actual: "0", expected: erc20Request.sellAmount },
      simulationIncomplete: false,
      invalidSourcesPassed: [],
    },
    route: {
      fills: [{ source: "Uniswap_V3" }, { source: "Uniswap_V3" }],
    },
    transaction: {
      from: taker,
      to: allowanceTarget,
      data: encodeFunctionData({
        abi: allowanceHolderAbi,
        functionName: "exec",
        args: [
          transactionTarget,
          qualificationKyraTokenAddress,
          BigInt(erc20Request.sellAmount),
          transactionTarget,
          innerData,
        ],
      }),
      value: "0",
    },
    ...overrides,
  };
}

{
  const url = buildZeroExQualificationUrl(nativeRequest);
  assert.equal(`${url.origin}${url.pathname}`, zeroExQualificationEndpoint);
  assert.equal(url.searchParams.get("chainId"), String(robinhoodQualificationChainId));
  assert.equal(url.searchParams.get("sellToken"), qualificationNativeTokenAddress);
  assert.equal(url.searchParams.get("buyToken"), qualificationKyraTokenAddress);
  assert.equal(url.searchParams.get("taker"), taker);
  assert.equal(url.searchParams.get("slippageBps"), "50");
}

{
  const native = reviewQualificationQuote(nativePayload(), nativeRequest);
  assert.equal(native.outcome, "observed");
  assert.equal(native.allowlistReview, "candidate");
  assert.equal(native.transactionTarget, transactionTarget);
  assert.equal(native.allowanceTarget, null);
  assert.deepEqual(native.liquiditySources, ["Uniswap_V3"]);

  const wrappedNative = reviewQualificationQuote(
    wrappedNativePayload(),
    nativeRequest,
  );
  assert.equal(wrappedNative.transactionTarget, transactionTarget);
  assert.equal(wrappedNative.allowanceTarget, allowanceTarget);
  assert.deepEqual(wrappedNative.issueCodes, []);

  const erc20 = reviewQualificationQuote(erc20Payload(), erc20Request);
  assert.equal(erc20.transactionTarget, transactionTarget);
  assert.equal(erc20.allowanceTarget, allowanceTarget);
  assert.deepEqual(erc20.issueCodes, ["allowance", "balance"]);
  assert.deepEqual(erc20.liquiditySources, ["Uniswap_V3"]);
}

{
  let calls = 0;
  const fetcher = async (_input, init) => {
    calls += 1;
    const headers = new Headers(init.headers);
    assert.equal(headers.get("0x-api-key"), secret);
    assert.equal(headers.get("0x-version"), "v2");
    assert.equal(init.redirect, "error");
    return new Response(
      JSON.stringify(calls === 1 ? nativePayload() : erc20Payload()),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
  const report = await qualifyZeroExProvider({
    apiKey: secret,
    requests,
    fetcher,
    now: new Date("2026-08-02T00:00:00Z"),
  });
  assert.equal(report.complete, true);
  assert.equal(report.executionEnabled, false);
  assert.equal(report.generatedAt, "2026-08-02T00:00:00.000Z");
  const serialized = JSON.stringify(report);
  assert.equal(serialized.includes(secret), false);
  assert.equal(serialized.toLowerCase().includes(taker.toLowerCase()), false);
  assert.equal(serialized.includes(nativePayload().transaction.data), false);
  assert.equal(serialized.includes(erc20Payload().transaction.data), false);
  assert.equal(serialized.includes("actual"), false);
  assert.equal(serialized.includes("expected"), false);
}

{
  const rawProviderSecret = "raw-provider-body-must-not-escape";
  let calls = 0;
  const report = await qualifyZeroExProvider({
    apiKey: secret,
    requests,
    fetcher: async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(rawProviderSecret, { status: 403 });
      }
      return new Response(JSON.stringify(nativePayload()), { status: 200 });
    },
  });
  assert.equal(report.complete, false);
  assert.equal(report.observations[0].rejectionCode, "provider_http_error");
  assert.equal(JSON.stringify(report).includes(rawProviderSecret), false);
}

for (const value of [
  nativePayload({ transaction: { ...nativePayload().transaction, from: allowanceTarget } }),
  nativePayload({ allowanceTarget }),
  wrappedNativePayload({
    issues: {
      allowance: { spender: allowanceTarget },
      balance: null,
      simulationIncomplete: false,
      invalidSourcesPassed: [],
    },
  }),
  wrappedNativePayload({
    transaction: {
      ...wrappedNativePayload().transaction,
      to: transactionTarget,
    },
  }),
  wrappedNativePayload({
    transaction: {
      ...wrappedNativePayload().transaction,
      data: encodeFunctionData({
        abi: allowanceHolderAbi,
        functionName: "exec",
        args: [
          transactionTarget,
          allowanceHolderNativeTokenAddress,
          BigInt(nativeRequest.sellAmount) - 1n,
          transactionTarget,
          settlerData(nativeRequest),
        ],
      }),
    },
  }),
  wrappedNativePayload({
    transaction: {
      ...wrappedNativePayload().transaction,
      data: encodeFunctionData({
        abi: allowanceHolderAbi,
        functionName: "exec",
        args: [
          transactionTarget,
          qualificationNativeTokenAddress,
          BigInt(nativeRequest.sellAmount),
          transactionTarget,
          settlerData(nativeRequest),
        ],
      }),
    },
  }),
  nativePayload({ route: { fills: [{ source: "invalid source" }] } }),
  nativePayload({
    issues: {
      allowance: null,
      balance: null,
      simulationIncomplete: false,
      invalidSources: [],
    },
  }),
]) {
  assert.throws(() => reviewQualificationQuote(value, nativeRequest));
}

assert.throws(() =>
  reviewQualificationQuote(
    erc20Payload({
      issues: {
        allowance: { spender: transactionTarget },
        balance: null,
        simulationIncomplete: false,
        invalidSourcesPassed: [],
      },
    }),
    erc20Request,
  )
);

{
  const blocked = reviewQualificationQuote(
    nativePayload({
      issues: {
        allowance: null,
        balance: null,
        simulationIncomplete: true,
        invalidSourcesPassed: [],
      },
    }),
    nativeRequest,
  );
  assert.equal(blocked.outcome, "observed");
  assert.equal(blocked.allowlistReview, "blocked");

  let call = 0;
  const report = await qualifyZeroExProvider({
    apiKey: secret,
    requests,
    fetcher: async () => {
      call += 1;
      return new Response(
        JSON.stringify(call === 1
          ? nativePayload({
            issues: {
              allowance: null,
              balance: null,
              simulationIncomplete: true,
              invalidSourcesPassed: [],
            },
          })
          : erc20Payload()),
        { status: 200 },
      );
    },
  });
  assert.equal(report.complete, false);
}

await assert.rejects(
  () => readBoundedQualificationBody(
    new Response("{}", {
      headers: { "Content-Length": String(64 * 1024 + 1) },
    }),
  ),
  /provider_body_too_large/u,
);

console.log("Protected swap provider qualification harness tests passed.");
