import { decodeFunctionData, getAddress, isAddress } from "npm:viem@2.52.2";
import {
  getSwapToken,
  swapQuoteLifetimeMs,
  type SwapQuoteRequest,
  type SwapTokenAddress,
  zeroExNativeTokenAddress,
} from "../_shared/swap-quote-policy.ts";
import { HttpError } from "./core.ts";
import { kyraTokenAddress } from "../_shared/transfer-transaction-policy.ts";

const zeroExSwapApiUrl = "https://api.0x.org/swap/allowance-holder/quote";
const maxProviderBodyBytes = 64 * 1024;
const maxLiquiditySources = 16;
const maxRouteSummaryLength = 240;
const maxTransactionDataLength = 32_770;
const maxSettlerActions = 64;
const maxSettlerActionDataLength = 16_386;
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

export interface ZeroExProviderConfig {
  apiKey: string;
  allowedTransactionTargets: ReadonlySet<string>;
  allowedAllowanceTargets: ReadonlySet<string>;
  allowedLiquiditySources: ReadonlySet<string>;
  timeoutMs: number;
}

export interface ReviewedSwapQuote {
  status: "quote_ready" | "allowance_required";
  provider: "0x_swap_api_v2";
  sellTokenAddress: SwapTokenAddress;
  sellTokenSymbol: "ETH" | "KYRA";
  buyTokenAddress: SwapTokenAddress;
  buyTokenSymbol: "ETH" | "KYRA";
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

export async function fetchReviewedZeroExQuote(
  request: SwapQuoteRequest,
  config: ZeroExProviderConfig,
  fetcher: typeof fetch = fetch,
): Promise<ReviewedSwapQuote> {
  const url = new URL(zeroExSwapApiUrl);
  url.searchParams.set("chainId", String(request.chainId));
  url.searchParams.set("sellToken", request.sellToken);
  url.searchParams.set("buyToken", request.buyToken);
  url.searchParams.set("sellAmount", request.sellAmount);
  url.searchParams.set("taker", request.taker);
  url.searchParams.set("slippageBps", String(request.slippageBps));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
  try {
    let response: Response;
    try {
      response = await fetcher(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "0x-api-key": config.apiKey,
          "0x-version": "v2",
        },
        redirect: "error",
        signal: controller.signal,
      });
    } catch {
      throw providerUnavailable();
    }

    const text = await readBoundedProviderBody(response, controller.signal);
    if (!response.ok) throw providerUnavailable();

    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw invalidProviderQuote("invalid_provider_json");
    }
    return reviewZeroExQuote(payload, request, config, new Date());
  } finally {
    clearTimeout(timeout);
  }
}

export async function readBoundedProviderBody(
  response: Response,
  signal?: AbortSignal,
) {
  const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
  if (
    Number.isFinite(declaredLength) && declaredLength > maxProviderBodyBytes
  ) {
    try {
      await response.body?.cancel("provider_body_too_large");
    } catch {
      // Best-effort cancellation; the provider response is rejected either way.
    }
    throw invalidProviderQuote("provider_body_too_large");
  }

  const reader = response.body?.getReader();
  if (!reader) return "";
  const abortReader = () => {
    void reader.cancel("provider_timeout").catch(() => undefined);
  };
  if (signal?.aborted) abortReader();
  signal?.addEventListener("abort", abortReader, { once: true });

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      let chunk: ReadableStreamReadResult<Uint8Array>;
      try {
        chunk = await reader.read();
      } catch {
        throw providerUnavailable();
      }
      if (chunk.done) break;
      if (signal?.aborted) throw providerUnavailable();
      byteLength += chunk.value.byteLength;
      if (byteLength > maxProviderBodyBytes) {
        try {
          await reader.cancel("provider_body_too_large");
        } catch {
          // Best-effort cancellation; the provider response is rejected either way.
        }
        throw invalidProviderQuote("provider_body_too_large");
      }
      try {
        text += decoder.decode(chunk.value, { stream: true });
      } catch {
        try {
          await reader.cancel("invalid_provider_json");
        } catch {
          // Best-effort cancellation; malformed UTF-8 still fails closed.
        }
        throw invalidProviderQuote("invalid_provider_json");
      }
    }
    try {
      text += decoder.decode();
    } catch {
      throw invalidProviderQuote("invalid_provider_json");
    }
    if (signal?.aborted) throw providerUnavailable();
    return text;
  } finally {
    signal?.removeEventListener("abort", abortReader);
    reader.releaseLock();
  }
}

export function reviewZeroExQuote(
  value: unknown,
  request: SwapQuoteRequest,
  config: Pick<
    ZeroExProviderConfig,
    | "allowedTransactionTargets"
    | "allowedAllowanceTargets"
    | "allowedLiquiditySources"
  >,
  now: Date,
): ReviewedSwapQuote {
  if (!isRecord(value)) throw invalidProviderQuote("invalid_quote");
  if (value.liquidityAvailable !== true) {
    throw invalidProviderQuote("liquidity_unavailable");
  }
  if (
    !sameToken(value.sellToken, request.sellToken) ||
    !sameToken(value.buyToken, request.buyToken) ||
    value.sellAmount !== request.sellAmount
  ) {
    throw invalidProviderQuote("quote_request_mismatch");
  }

  const buyAmount = readPositiveAtomicAmount(value.buyAmount);
  const minimumBuyAmount = readPositiveAtomicAmount(value.minBuyAmount);
  if (
    buyAmount === null ||
    minimumBuyAmount === null ||
    minimumBuyAmount > buyAmount
  ) {
    throw invalidProviderQuote("invalid_buy_amount");
  }

  const issues = readIssues(value.issues);
  if (
    issues.balance !== null ||
    issues.simulationIncomplete ||
    issues.invalidSources.length > 0
  ) {
    throw invalidProviderQuote("provider_issues");
  }

  const liquiditySources = readLiquiditySources(value.route);
  if (
    liquiditySources.length === 0 ||
    liquiditySources.length > maxLiquiditySources ||
    liquiditySources.some((source) =>
      !config.allowedLiquiditySources.has(source)
    )
  ) {
    throw invalidProviderQuote("liquidity_source_not_allowed");
  }

  const transaction = readTransaction(value.transaction, request.taker);
  if (!config.allowedTransactionTargets.has(transaction.to.toLowerCase())) {
    throw invalidProviderQuote("transaction_target_not_allowed");
  }
  if (
    request.sellToken === zeroExNativeTokenAddress &&
    transaction.valueWei !== request.sellAmount
  ) {
    throw invalidProviderQuote("native_value_mismatch");
  }
  if (
    request.sellToken === kyraTokenAddress &&
    transaction.valueWei !== "0"
  ) {
    throw invalidProviderQuote("erc20_value_mismatch");
  }

  const allowanceTarget = readNullableAddress(value.allowanceTarget);
  if (request.sellToken === zeroExNativeTokenAddress) {
    if (allowanceTarget !== null || issues.allowance !== null) {
      throw invalidProviderQuote("unexpected_native_allowance");
    }
  } else {
    if (
      allowanceTarget === null ||
      !config.allowedAllowanceTargets.has(allowanceTarget.toLowerCase())
    ) {
      throw invalidProviderQuote("allowance_target_not_allowed");
    }
    if (
      issues.allowance !== null &&
      normalizeAddress(issues.allowance.spender) !==
        allowanceTarget.toLowerCase()
    ) {
      throw invalidProviderQuote("allowance_spender_mismatch");
    }
  }

  reviewTransactionEnvelope(
    transaction,
    request,
    allowanceTarget,
    minimumBuyAmount,
    config,
  );

  const issuedAt = now.toISOString();
  const expiresAt = new Date(now.getTime() + swapQuoteLifetimeMs).toISOString();
  const sellToken = getSwapToken(request.sellToken);
  const buyToken = getSwapToken(request.buyToken);
  const routeSummary = `${sellToken.symbol} to ${buyToken.symbol} via ${
    liquiditySources.join(", ")
  }`;
  if (routeSummary.length > maxRouteSummaryLength) {
    throw invalidProviderQuote("route_summary_too_large");
  }

  return {
    status: issues.allowance === null ? "quote_ready" : "allowance_required",
    provider: "0x_swap_api_v2",
    sellTokenAddress: request.sellToken,
    sellTokenSymbol: sellToken.symbol,
    buyTokenAddress: request.buyToken,
    buyTokenSymbol: buyToken.symbol,
    sellAmountAtomic: request.sellAmount,
    buyAmountAtomic: buyAmount.toString(),
    minimumBuyAmountAtomic: minimumBuyAmount.toString(),
    slippageBps: request.slippageBps,
    allowanceTarget,
    transactionTo: transaction.to,
    transactionData: transaction.data,
    transactionValueWei: transaction.valueWei,
    liquiditySources,
    routeSummary,
    issuedAt,
    expiresAt,
  };
}

function reviewTransactionEnvelope(
  transaction: {
    to: `0x${string}`;
    data: `0x${string}`;
    valueWei: string;
  },
  request: SwapQuoteRequest,
  allowanceTarget: `0x${string}` | null,
  minimumBuyAmount: bigint,
  config: Pick<
    ZeroExProviderConfig,
    "allowedTransactionTargets" | "allowedAllowanceTargets"
  >,
) {
  if (request.sellToken === zeroExNativeTokenAddress) {
    reviewSettlerExecute(
      transaction.data,
      request,
      minimumBuyAmount,
    );
    return;
  }

  if (
    allowanceTarget === null ||
    transaction.to.toLowerCase() !== allowanceTarget.toLowerCase()
  ) {
    throw invalidProviderQuote("allowance_holder_target_mismatch");
  }

  let decoded: ReturnType<typeof decodeFunctionData<typeof allowanceHolderAbi>>;
  try {
    decoded = decodeFunctionData({
      abi: allowanceHolderAbi,
      data: transaction.data,
    });
  } catch {
    throw invalidProviderQuote("invalid_allowance_holder_calldata");
  }
  if (decoded.functionName !== "exec") {
    throw invalidProviderQuote("invalid_allowance_holder_calldata");
  }

  const [operator, token, amount, target, settlerData] = decoded.args;
  const normalizedOperator = operator.toLowerCase();
  const normalizedTarget = target.toLowerCase();
  if (
    normalizedOperator !== normalizedTarget ||
    normalizedTarget === allowanceTarget.toLowerCase() ||
    !config.allowedTransactionTargets.has(normalizedTarget)
  ) {
    throw invalidProviderQuote("settler_target_mismatch");
  }
  if (
    token.toLowerCase() !== request.sellToken.toLowerCase() ||
    amount !== BigInt(request.sellAmount)
  ) {
    throw invalidProviderQuote("allowance_holder_amount_mismatch");
  }

  reviewSettlerExecute(settlerData, request, minimumBuyAmount);
}

function reviewSettlerExecute(
  data: `0x${string}`,
  request: SwapQuoteRequest,
  minimumBuyAmount: bigint,
) {
  let decoded: ReturnType<typeof decodeFunctionData<typeof settlerExecuteAbi>>;
  try {
    decoded = decodeFunctionData({
      abi: settlerExecuteAbi,
      data,
    });
  } catch {
    throw invalidProviderQuote("invalid_settler_calldata");
  }
  if (decoded.functionName !== "execute") {
    throw invalidProviderQuote("invalid_settler_calldata");
  }

  const [slippage, actions] = decoded.args;
  if (
    slippage.recipient.toLowerCase() !== request.taker.toLowerCase() ||
    slippage.buyToken.toLowerCase() !== request.buyToken.toLowerCase() ||
    slippage.minAmountOut !== minimumBuyAmount
  ) {
    throw invalidProviderQuote("settler_slippage_mismatch");
  }
  if (
    actions.length === 0 ||
    actions.length > maxSettlerActions ||
    actions.some((action) =>
      !/^0x(?:[0-9a-f]{2})+$/iu.test(action) ||
      action.length > maxSettlerActionDataLength
    )
  ) {
    throw invalidProviderQuote("invalid_settler_actions");
  }
}

export function readAddressAllowlist(value: string): ReadonlySet<string> {
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (entries.length === 0) {
    throw new Error("Address allowlist is empty.");
  }
  const normalized = entries.map((entry) => {
    if (!isAddress(entry, { strict: true })) {
      throw new Error("Address allowlist contains an invalid address.");
    }
    return getAddress(entry).toLowerCase();
  });
  return new Set(normalized);
}

export function readSourceAllowlist(value: string): ReadonlySet<string> {
  const entries = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (
    entries.length === 0 ||
    entries.some((entry) => !/^[A-Za-z0-9_.:-]{1,64}$/u.test(entry))
  ) {
    throw new Error("Liquidity source allowlist is invalid.");
  }
  return new Set(entries);
}

function readIssues(value: unknown) {
  if (!isRecord(value)) throw invalidProviderQuote("invalid_issues");
  const allowance = value.allowance === null
    ? null
    : readAllowanceIssue(value.allowance);
  if (
    (value.balance !== null && !isRecord(value.balance)) ||
    typeof value.simulationIncomplete !== "boolean" ||
    !Array.isArray(value.invalidSources) ||
    value.invalidSources.some((entry) => typeof entry !== "string")
  ) {
    throw invalidProviderQuote("invalid_issues");
  }
  return {
    allowance,
    balance: value.balance,
    simulationIncomplete: value.simulationIncomplete,
    invalidSources: value.invalidSources as string[],
  };
}

function readAllowanceIssue(value: unknown) {
  if (!isRecord(value)) throw invalidProviderQuote("invalid_allowance_issue");
  const spender = readAddress(value.spender);
  if (!spender) throw invalidProviderQuote("invalid_allowance_issue");
  return { spender };
}

function readLiquiditySources(value: unknown) {
  if (!isRecord(value) || !Array.isArray(value.fills)) {
    throw invalidProviderQuote("invalid_route");
  }
  const sources = value.fills.map((fill) => {
    if (!isRecord(fill) || typeof fill.source !== "string") {
      throw invalidProviderQuote("invalid_route");
    }
    return fill.source;
  });
  return [...new Set(sources)].sort();
}

function readTransaction(value: unknown, expectedTaker: `0x${string}`) {
  if (!isRecord(value)) throw invalidProviderQuote("invalid_transaction");
  const to = readAddress(value.to);
  if (
    !to ||
    typeof value.data !== "string" ||
    !/^0x(?:[0-9a-f]{2})+$/u.test(value.data) ||
    value.data.length > maxTransactionDataLength ||
    typeof value.value !== "string" ||
    !/^(0|[1-9][0-9]*)$/u.test(value.value)
  ) {
    throw invalidProviderQuote("invalid_transaction");
  }
  if (value.from !== undefined) {
    const sender = readAddress(value.from);
    if (!sender || sender.toLowerCase() !== expectedTaker.toLowerCase()) {
      throw invalidProviderQuote("transaction_sender_mismatch");
    }
  }
  return {
    to,
    data: value.data as `0x${string}`,
    valueWei: value.value,
  };
}

function readNullableAddress(value: unknown): `0x${string}` | null {
  if (value === null) return null;
  const address = readAddress(value);
  if (!address) throw invalidProviderQuote("invalid_allowance_target");
  return address;
}

function readAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== "string" || !isAddress(value, { strict: true })) {
    return null;
  }
  try {
    return getAddress(value);
  } catch {
    return null;
  }
}

function sameToken(value: unknown, expected: SwapTokenAddress) {
  return typeof value === "string" &&
    value.toLowerCase() === expected.toLowerCase();
}

function normalizeAddress(value: `0x${string}`) {
  return value.toLowerCase();
}

function readPositiveAtomicAmount(value: unknown) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/u.test(value)) {
    return null;
  }
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function providerUnavailable() {
  return new HttpError(
    503,
    "swap_quote_provider_unavailable",
    "Protected swap quotes are temporarily unavailable.",
  );
}

function invalidProviderQuote(detail: string) {
  return new HttpError(
    422,
    "swap_quote_rejected",
    `The swap provider response failed Kyra policy: ${detail}.`,
  );
}
