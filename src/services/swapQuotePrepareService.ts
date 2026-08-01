import { getAddress } from "viem";
import { appConfig } from "../config/appConfig";
import {
  getSwapTokenSymbolForAddress,
  type ReviewedSwapQuoteRequest,
  swapQuotePolicyVersion,
} from "../config/swapQuotePolicy";
import { robinhoodChain } from "../config/productChains";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey } from "./supabaseRestClient";

export interface SwapQuoteSummary {
  quoteRecordId: string;
  status: "quote_ready" | "allowance_required";
  sellTokenSymbol: "ETH" | "KYRA";
  buyTokenSymbol: "ETH" | "KYRA";
  sellAmount: string;
  buyAmount: string;
  minimumBuyAmount: string;
  slippageBps: number;
  routeSummary: string;
  expiresAt: string;
  allowanceRequired: boolean;
  executionEnabled: false;
}

export type SwapQuotePrepareResult =
  | {
    ok: true;
    status: "quote-ready" | "allowance-required";
    message: string;
    quote: SwapQuoteSummary;
  }
  | {
    ok: false;
    status: "not-configured" | "rate-limited" | "error";
    message: string;
  };

interface SwapQuotePrepareResponse {
  ok: true;
  status: "quote_ready" | "allowance_required";
  quoteId: string;
  quoteRecordId: string;
  chainKey: "robinhood_mainnet";
  chainId: typeof robinhoodChain.id;
  taker: `0x${string}`;
  sellToken: ReviewedSwapQuoteRequest["sellToken"];
  sellTokenSymbol: "ETH" | "KYRA";
  buyToken: ReviewedSwapQuoteRequest["buyToken"];
  buyTokenSymbol: "ETH" | "KYRA";
  sellAmount: string;
  buyAmount: string;
  minimumBuyAmount: string;
  slippageBps: number;
  routeSummary: string;
  expiresAt: string;
  allowanceRequired: boolean;
  executionEnabled: false;
}

const swapQuoteClientTimeoutMs = 8_000;
const maxResponseBytes = 16 * 1024;

const responseKeys = [
  "allowanceRequired",
  "buyAmount",
  "buyToken",
  "buyTokenSymbol",
  "chainId",
  "chainKey",
  "executionEnabled",
  "expiresAt",
  "minimumBuyAmount",
  "ok",
  "quoteId",
  "quoteRecordId",
  "routeSummary",
  "sellAmount",
  "sellToken",
  "sellTokenSymbol",
  "slippageBps",
  "status",
  "taker",
].sort().join(",");

export async function prepareProtectedSwapQuote(
  session: KyraAuthSession | null,
  request: ReviewedSwapQuoteRequest,
): Promise<SwapQuotePrepareResult> {
  if (
    appConfig.chain.currentKey !== "robinhood_mainnet" ||
    !session ||
    !appConfig.functions.swapQuotePrepareConfigured
  ) {
    return {
      ok: false,
      status: "not-configured",
      message: "Protected Robinhood Chain swap quotes are unavailable.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    swapQuoteClientTimeoutMs,
  );
  try {
    const response = await fetch(appConfig.functions.swapQuotePrepareUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: getSupabaseApiKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(request),
      redirect: "error",
      signal: controller.signal,
    });
    const payload = await readResponse(response);

    if (!response.ok || !isSwapQuotePrepareResponse(payload)) {
      return {
        ok: false,
        status: response.status === 429 ? "rate-limited" : "error",
        message: response.status === 429
          ? "The private swap quote limit has been reached. Wait before retrying."
          : "Swap quote review failed safely.",
      };
    }
    if (!matchesRequest(payload, request)) {
      return {
        ok: false,
        status: "error",
        message: "The reviewed quote does not match the requested swap.",
      };
    }

    return {
      ok: true,
      status: payload.status === "quote_ready"
        ? "quote-ready"
        : "allowance-required",
      message: payload.status === "quote_ready"
        ? "Quote review is ready. Swap execution remains locked."
        : "An exact token allowance would be required. Execution remains locked.",
      quote: {
        quoteRecordId: payload.quoteRecordId,
        status: payload.status,
        sellTokenSymbol: payload.sellTokenSymbol,
        buyTokenSymbol: payload.buyTokenSymbol,
        sellAmount: payload.sellAmount,
        buyAmount: payload.buyAmount,
        minimumBuyAmount: payload.minimumBuyAmount,
        slippageBps: payload.slippageBps,
        routeSummary: payload.routeSummary,
        expiresAt: payload.expiresAt,
        allowanceRequired: payload.allowanceRequired,
        executionEnabled: false,
      },
    };
  } catch {
    return {
      ok: false,
      status: "error",
      message: "Swap quote review failed safely.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function isSwapQuotePrepareResponse(
  value: unknown,
): value is SwapQuotePrepareResponse {
  if (!isRecord(value)) return false;
  const expiresAt = typeof value.expiresAt === "string"
    ? Date.parse(value.expiresAt)
    : Number.NaN;
  const sellTokenSymbol = getSwapTokenSymbolForAddress(value.sellToken);
  const buyTokenSymbol = getSwapTokenSymbolForAddress(value.buyToken);
  const now = Date.now();

  return Object.keys(value).sort().join(",") === responseKeys &&
    value.ok === true &&
    (value.status === "quote_ready" ||
      value.status === "allowance_required") &&
    typeof value.quoteId === "string" &&
    isCanonicalUuid(value.quoteRecordId) &&
    value.chainKey === "robinhood_mainnet" &&
    value.chainId === robinhoodChain.id &&
    readChecksummedAddress(value.taker) !== null &&
    sellTokenSymbol !== null &&
    buyTokenSymbol !== null &&
    sellTokenSymbol !== buyTokenSymbol &&
    value.sellTokenSymbol === sellTokenSymbol &&
    value.buyTokenSymbol === buyTokenSymbol &&
    (sellTokenSymbol !== "ETH" || value.status === "quote_ready") &&
    isPositiveAtomic(value.sellAmount) &&
    isPositiveAtomic(value.buyAmount) &&
    isPositiveAtomic(value.minimumBuyAmount) &&
    BigInt(value.minimumBuyAmount) <= BigInt(value.buyAmount) &&
    Number.isInteger(value.slippageBps) &&
    typeof value.routeSummary === "string" &&
    value.routeSummary.length > 0 &&
    value.routeSummary.length <= 240 &&
    Number.isFinite(expiresAt) &&
    expiresAt > now &&
    expiresAt <= now + 90_000 &&
    value.allowanceRequired === (value.status === "allowance_required") &&
    value.executionEnabled === false;
}

function matchesRequest(
  response: SwapQuotePrepareResponse,
  request: ReviewedSwapQuoteRequest,
) {
  return response.quoteId === request.requestId &&
    response.taker === request.taker &&
    response.sellToken === request.sellToken &&
    response.buyToken === request.buyToken &&
    response.sellAmount === request.sellAmount &&
    response.slippageBps === request.slippageBps;
}

function readChecksummedAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== "string") return null;
  try {
    const checksummed = getAddress(value);
    return checksummed === value ? checksummed : null;
  } catch {
    return null;
  }
}

function isPositiveAtomic(value: unknown): value is string {
  return typeof value === "string" && /^[1-9][0-9]*$/u.test(value);
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      .test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readResponse(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    try {
      await response.body?.cancel("response_too_large");
    } catch {
      // Best-effort cancellation; the response is rejected either way.
    }
    return {};
  }

  const reader = response.body?.getReader();
  if (!reader) return {};

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxResponseBytes) {
        try {
          await reader.cancel("response_too_large");
        } catch {
          // Best-effort cancellation; the response is rejected either way.
        }
        return {};
      }
      try {
        text += decoder.decode(value, { stream: true });
      } catch {
        return {};
      }
    }
    try {
      text += decoder.decode();
    } catch {
      return {};
    }
  } catch {
    return {};
  } finally {
    reader.releaseLock();
  }

  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
