import { decodeFunctionData, getAddress, isAddress } from "viem";

export const zeroExQualificationEndpoint =
  "https://api.0x.org/swap/allowance-holder/quote";
export const robinhoodQualificationChainId = 4663;
export const qualificationNativeTokenAddress =
  "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";
export const qualificationKyraTokenAddress =
  "0xa2D99dB0593fFd57AE9b92103515bbA061fa5EC1";

const maxProviderBodyBytes = 64 * 1024;
const maxTransactionDataLength = 32_770;
const maxLiquiditySources = 16;
const maxSettlerActions = 64;
const maxSettlerActionDataLength = 16_386;
const sourcePattern = /^[A-Za-z0-9_.:-]{1,64}$/u;
const atomicAmountPattern = /^(0|[1-9][0-9]*)$/u;
const positiveAtomicAmountPattern = /^[1-9][0-9]*$/u;
const hexDataPattern = /^0x(?:[0-9a-f]{2})+$/iu;

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

export class QualificationError extends Error {
  constructor(code) {
    super(code);
    this.name = "QualificationError";
    this.code = code;
  }
}

export function createQualificationRequests({
  taker,
  ethSellAmountAtomic = "100000000000000",
  kyraSellAmountAtomic = "1000000000000000000",
  slippageBps = 50,
}) {
  const normalizedTaker = readAddress(taker);
  if (!normalizedTaker) throw reject("invalid_qualification_taker");
  if (!positiveAtomicAmountPattern.test(ethSellAmountAtomic)) {
    throw reject("invalid_eth_qualification_amount");
  }
  if (!positiveAtomicAmountPattern.test(kyraSellAmountAtomic)) {
    throw reject("invalid_kyra_qualification_amount");
  }
  if (!Number.isInteger(slippageBps) || slippageBps < 10 || slippageBps > 300) {
    throw reject("invalid_qualification_slippage");
  }

  return [
    {
      direction: "ETH_TO_KYRA",
      taker: normalizedTaker,
      sellToken: qualificationNativeTokenAddress,
      buyToken: qualificationKyraTokenAddress,
      sellAmount: ethSellAmountAtomic,
      slippageBps,
    },
    {
      direction: "KYRA_TO_ETH",
      taker: normalizedTaker,
      sellToken: qualificationKyraTokenAddress,
      buyToken: qualificationNativeTokenAddress,
      sellAmount: kyraSellAmountAtomic,
      slippageBps,
    },
  ];
}

export function buildZeroExQualificationUrl(request) {
  const url = new URL(zeroExQualificationEndpoint);
  url.searchParams.set("chainId", String(robinhoodQualificationChainId));
  url.searchParams.set("sellToken", request.sellToken);
  url.searchParams.set("buyToken", request.buyToken);
  url.searchParams.set("sellAmount", request.sellAmount);
  url.searchParams.set("taker", request.taker);
  url.searchParams.set("slippageBps", String(request.slippageBps));
  return url;
}

export async function qualifyZeroExProvider({
  apiKey,
  requests,
  timeoutMs = 3500,
  fetcher = fetch,
  now = new Date(),
}) {
  if (typeof apiKey !== "string" || apiKey.trim().length < 8) {
    throw reject("invalid_provider_credential");
  }
  if (!Array.isArray(requests) || requests.length !== 2) {
    throw reject("invalid_qualification_plan");
  }
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 5000) {
    throw reject("invalid_qualification_timeout");
  }

  const observations = [];
  for (const request of requests) {
    try {
      observations.push(
        await fetchQualificationObservation({
          apiKey,
          request,
          timeoutMs,
          fetcher,
        }),
      );
    } catch (error) {
      observations.push({
        direction: request.direction,
        outcome: "rejected",
        rejectionCode: error instanceof QualificationError
          ? error.code
          : "provider_unavailable",
      });
    }
  }

  return {
    schemaVersion: 1,
    purpose: "protected_swap_allowlist_candidate_observation",
    provider: "0x_swap_api_v2",
    chainId: robinhoodQualificationChainId,
    generatedAt: now.toISOString(),
    executionEnabled: false,
    complete: observations.every((entry) =>
      entry.outcome === "observed" && entry.allowlistReview === "candidate"
    ),
    observations,
  };
}

async function fetchQualificationObservation({
  apiKey,
  request,
  timeoutMs,
  fetcher,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    let response;
    try {
      response = await fetcher(buildZeroExQualificationUrl(request), {
        method: "GET",
        headers: {
          Accept: "application/json",
          "0x-api-key": apiKey,
          "0x-version": "v2",
        },
        redirect: "error",
        signal: controller.signal,
      });
    } catch {
      throw reject("provider_unavailable");
    }

    const text = await readBoundedQualificationBody(response, controller.signal);
    if (!response.ok) throw reject("provider_http_error");

    let payload;
    try {
      payload = JSON.parse(text);
    } catch {
      throw reject("invalid_provider_json");
    }
    return reviewQualificationQuote(payload, request);
  } finally {
    clearTimeout(timeout);
  }
}

export function reviewQualificationQuote(value, request) {
  if (!isRecord(value)) throw reject("invalid_quote");
  if (value.liquidityAvailable !== true) throw reject("liquidity_unavailable");
  if (
    !sameAddress(value.sellToken, request.sellToken) ||
    !sameAddress(value.buyToken, request.buyToken) ||
    value.sellAmount !== request.sellAmount
  ) {
    throw reject("quote_request_mismatch");
  }

  const buyAmount = readPositiveAtomicAmount(value.buyAmount);
  const minimumBuyAmount = readPositiveAtomicAmount(value.minBuyAmount);
  if (
    buyAmount === null ||
    minimumBuyAmount === null ||
    minimumBuyAmount > buyAmount
  ) {
    throw reject("invalid_buy_amount");
  }

  const issues = readIssues(value.issues);
  const liquiditySources = readLiquiditySources(value.route);
  const transaction = readTransaction(value.transaction, request.taker);
  const allowanceTarget = readNullableAddress(value.allowanceTarget);
  let transactionTarget = transaction.to;

  if (request.sellToken === qualificationNativeTokenAddress) {
    if (transaction.valueWei !== request.sellAmount) {
      throw reject("native_value_mismatch");
    }
    if (allowanceTarget !== null || issues.allowance !== null) {
      throw reject("unexpected_native_allowance");
    }
    reviewSettlerExecute(
      transaction.data,
      request,
      minimumBuyAmount,
    );
  } else {
    if (transaction.valueWei !== "0") throw reject("erc20_value_mismatch");
    if (
      allowanceTarget === null ||
      transaction.to.toLowerCase() !== allowanceTarget.toLowerCase()
    ) {
      throw reject("allowance_holder_target_mismatch");
    }
    if (
      issues.allowance !== null &&
      issues.allowance.spender.toLowerCase() !== allowanceTarget.toLowerCase()
    ) {
      throw reject("allowance_spender_mismatch");
    }
    transactionTarget = reviewAllowanceHolderEnvelope(
      transaction.data,
      request,
      allowanceTarget,
      minimumBuyAmount,
    );
  }

  const issueCodes = [];
  if (issues.allowance !== null) issueCodes.push("allowance");
  if (issues.balance !== null) issueCodes.push("balance");
  if (issues.simulationIncomplete) issueCodes.push("simulation_incomplete");
  if (issues.invalidSources.length > 0) issueCodes.push("invalid_sources");

  return {
    direction: request.direction,
    outcome: "observed",
    allowlistReview: issues.simulationIncomplete || issues.invalidSources.length > 0
      ? "blocked"
      : "candidate",
    transactionTarget,
    allowanceTarget,
    liquiditySources,
    issueCodes,
  };
}

function reviewAllowanceHolderEnvelope(
  data,
  request,
  allowanceTarget,
  minimumBuyAmount,
) {
  let decoded;
  try {
    decoded = decodeFunctionData({ abi: allowanceHolderAbi, data });
  } catch {
    throw reject("invalid_allowance_holder_calldata");
  }
  if (decoded.functionName !== "exec") {
    throw reject("invalid_allowance_holder_calldata");
  }

  const [operator, token, amount, target, settlerData] = decoded.args;
  if (
    operator.toLowerCase() !== target.toLowerCase() ||
    target.toLowerCase() === allowanceTarget.toLowerCase()
  ) {
    throw reject("settler_target_mismatch");
  }
  if (
    token.toLowerCase() !== request.sellToken.toLowerCase() ||
    amount !== BigInt(request.sellAmount)
  ) {
    throw reject("allowance_holder_amount_mismatch");
  }
  reviewSettlerExecute(settlerData, request, minimumBuyAmount);
  return getAddress(target);
}

function reviewSettlerExecute(data, request, minimumBuyAmount) {
  let decoded;
  try {
    decoded = decodeFunctionData({ abi: settlerExecuteAbi, data });
  } catch {
    throw reject("invalid_settler_calldata");
  }
  if (decoded.functionName !== "execute") {
    throw reject("invalid_settler_calldata");
  }

  const [slippage, actions] = decoded.args;
  if (
    slippage.recipient.toLowerCase() !== request.taker.toLowerCase() ||
    slippage.buyToken.toLowerCase() !== request.buyToken.toLowerCase() ||
    slippage.minAmountOut !== minimumBuyAmount
  ) {
    throw reject("settler_slippage_mismatch");
  }
  if (
    actions.length === 0 ||
    actions.length > maxSettlerActions ||
    actions.some((action) =>
      !hexDataPattern.test(action) ||
      action.length > maxSettlerActionDataLength
    )
  ) {
    throw reject("invalid_settler_actions");
  }
}

function readIssues(value) {
  if (!isRecord(value)) throw reject("invalid_issues");
  const allowance = value.allowance === null
    ? null
    : readAllowanceIssue(value.allowance);
  if (
    (value.balance !== null && !isRecord(value.balance)) ||
    typeof value.simulationIncomplete !== "boolean" ||
    !Array.isArray(value.invalidSources) ||
    value.invalidSources.some((entry) => typeof entry !== "string")
  ) {
    throw reject("invalid_issues");
  }
  return {
    allowance,
    balance: value.balance,
    simulationIncomplete: value.simulationIncomplete,
    invalidSources: value.invalidSources,
  };
}

function readAllowanceIssue(value) {
  if (!isRecord(value)) throw reject("invalid_allowance_issue");
  const spender = readAddress(value.spender);
  if (!spender) throw reject("invalid_allowance_issue");
  return { spender };
}

function readLiquiditySources(value) {
  if (!isRecord(value) || !Array.isArray(value.fills)) {
    throw reject("invalid_route");
  }
  const sources = value.fills.map((fill) => {
    if (
      !isRecord(fill) ||
      typeof fill.source !== "string" ||
      !sourcePattern.test(fill.source)
    ) {
      throw reject("invalid_route");
    }
    return fill.source;
  });
  const uniqueSources = [...new Set(sources)].sort();
  if (uniqueSources.length === 0 || uniqueSources.length > maxLiquiditySources) {
    throw reject("invalid_route");
  }
  return uniqueSources;
}

function readTransaction(value, expectedTaker) {
  if (!isRecord(value)) throw reject("invalid_transaction");
  const to = readAddress(value.to);
  if (
    !to ||
    typeof value.data !== "string" ||
    !hexDataPattern.test(value.data) ||
    value.data.length > maxTransactionDataLength ||
    typeof value.value !== "string" ||
    !atomicAmountPattern.test(value.value)
  ) {
    throw reject("invalid_transaction");
  }
  if (value.from !== undefined) {
    const sender = readAddress(value.from);
    if (!sender || sender.toLowerCase() !== expectedTaker.toLowerCase()) {
      throw reject("transaction_sender_mismatch");
    }
  }
  return { to, data: value.data, valueWei: value.value };
}

export async function readBoundedQualificationBody(response, signal) {
  const declaredLength = Number(response.headers.get("content-length") ?? 0);
  if (
    !Number.isFinite(declaredLength) ||
    declaredLength < 0 ||
    declaredLength > maxProviderBodyBytes
  ) {
    throw reject("provider_body_too_large");
  }
  if (!response.body) return "";

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  const abortReader = () => void reader.cancel();
  signal?.addEventListener("abort", abortReader, { once: true });
  try {
    while (true) {
      let result;
      try {
        result = await reader.read();
      } catch {
        throw reject("provider_unavailable");
      }
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxProviderBodyBytes) {
        throw reject("provider_body_too_large");
      }
      chunks.push(result.value);
    }
    if (signal?.aborted) throw reject("provider_unavailable");
    const body = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      body.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return new TextDecoder("utf-8", { fatal: true }).decode(body);
    } catch {
      throw reject("invalid_provider_encoding");
    }
  } finally {
    signal?.removeEventListener("abort", abortReader);
    reader.releaseLock();
  }
}

function readNullableAddress(value) {
  if (value === null) return null;
  const address = readAddress(value);
  if (!address) throw reject("invalid_allowance_target");
  return address;
}

function readAddress(value) {
  if (typeof value !== "string" || !isAddress(value, { strict: true })) {
    return null;
  }
  try {
    const address = getAddress(value);
    return address === "0x0000000000000000000000000000000000000000"
      ? null
      : address;
  } catch {
    return null;
  }
}

function readPositiveAtomicAmount(value) {
  if (typeof value !== "string" || !positiveAtomicAmountPattern.test(value)) {
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function sameAddress(value, expected) {
  const address = readAddress(value);
  return address !== null && address.toLowerCase() === expected.toLowerCase();
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function reject(code) {
  return new QualificationError(code);
}
