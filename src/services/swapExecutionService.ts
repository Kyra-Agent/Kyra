import { decodeFunctionData, erc20Abi, getAddress } from "viem";
import { appConfig } from "../config/appConfig";
import {
  uniswapSwapRouter02Address,
  usdgTokenAddress,
} from "../config/swapQuotePolicy";
import { robinhoodChain } from "../config/productChains";
import type { KyraAuthSession } from "./supabaseAuthService";
import { createSessionSwapPost, type SwapPost } from "./swapTransport";
import { isServerExpiryWithinLifetime } from "./serverExpiry";
import { readServerMessage } from "./serverMessage";

export type SwapExecutionStep = "allowance_set" | "swap" | "allowance_revoke";
export type SwapExecutionResultStatus = "submitted" | "confirmed" | "failed";
export type SwapExecutionNextAction =
  | "wait_for_receipt"
  | "request_fresh_quote"
  | "retry_allowance"
  | "retry_swap"
  | "revoke_allowance"
  | "retry_revoke"
  | "complete";

export interface PreparedSwapExecution {
  intentRecordId: string;
  requestId: string;
  quoteRecordId: string;
  step: SwapExecutionStep;
  sender: `0x${string}`;
  transaction: {
    to: `0x${string}`;
    data: `0x${string}`;
    valueWei: string;
  };
  allowance: null | {
    token: `0x${string}`;
    spender: `0x${string}`;
    amountAtomic: string;
  };
  expiresAt: string;
}

export type SwapExecutionPrepareResult =
  | { ok: true; prepared: PreparedSwapExecution }
  | { ok: false; message: string };

export type SwapExecutionCloseoutResult =
  | {
    ok: true;
    status: SwapExecutionResultStatus;
    step: SwapExecutionStep;
    nextAction: SwapExecutionNextAction;
    txHashLabel: string;
  }
  | { ok: false; message: string };

export interface SwapExecutionPrepareInput {
  workspaceId: string;
  agentId: string;
  quoteRecordId: string;
  requestId: string;
  step: SwapExecutionStep;
  sender: `0x${string}`;
}

export interface SwapCloseoutInput {
  workspaceId: string;
  agentId: string;
  intentRecordId: string;
  requestId: string;
  txHash: `0x${string}`;
}

const clientTimeoutMs = 8_000;
const prepareKeys = [
  "allowance",
  "chainId",
  "chainKey",
  "executionScope",
  "expiresAt",
  "intentId",
  "intentRecordId",
  "ok",
  "policyVersion",
  "quoteRecordId",
  "sender",
  "status",
  "step",
  "transaction",
].sort().join(",");
const transactionKeys = ["data", "to", "valueWei"].sort().join(",");
const allowanceKeys = ["amountAtomic", "spender", "token"].sort().join(",");
const closeoutKeys = [
  "chainKey",
  "nextAction",
  "ok",
  "status",
  "step",
  "txHashLabel",
  "visibility",
].sort().join(",");
const steps: readonly SwapExecutionStep[] = [
  "allowance_set",
  "swap",
  "allowance_revoke",
];
const statuses: readonly SwapExecutionResultStatus[] = [
  "submitted",
  "confirmed",
  "failed",
];
const nextActions: readonly SwapExecutionNextAction[] = [
  "wait_for_receipt",
  "request_fresh_quote",
  "retry_allowance",
  "retry_swap",
  "revoke_allowance",
  "retry_revoke",
  "complete",
];

export async function prepareProtectedSwapExecution(
  session: KyraAuthSession | null,
  input: SwapExecutionPrepareInput,
): Promise<SwapExecutionPrepareResult> {
  if (
    appConfig.chain.currentKey !== "robinhood_mainnet" ||
    !session ||
    !appConfig.functions.swapExecutionPrepareConfigured
  ) {
    return { ok: false, message: "Protected swap execution is unavailable." };
  }
  return await requestSwapExecutionStep(
    createSessionSwapPost(
      appConfig.functions.swapExecutionPrepareUrl,
      session,
      clientTimeoutMs,
    ),
    input,
  );
}

// Asks the backend to lock one swap step over any transport and accepts only
// a transaction that matches the reviewed router and token rules.
export async function requestSwapExecutionStep(
  post: SwapPost,
  input: SwapExecutionPrepareInput,
): Promise<SwapExecutionPrepareResult> {
  const payload = await post({
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    quoteRecordId: input.quoteRecordId,
    requestId: input.requestId,
    step: input.step,
  });
  if (!payload.ok || !isPreparedResponse(payload.value, input)) {
    return {
      ok: false,
      message: !payload.ok
        ? readServerMessage(payload.value) ?? (payload.status === 429
          ? "The private swap execution limit was reached. Wait before retrying."
          : "Protected swap preparation failed safely.")
        : "Kyra could not verify the locked swap step. Review it again.",
    };
  }

  return {
    ok: true,
    prepared: {
      intentRecordId: payload.value.intentRecordId,
      requestId: payload.value.intentId,
      quoteRecordId: payload.value.quoteRecordId,
      step: payload.value.step,
      sender: payload.value.sender,
      transaction: payload.value.transaction,
      allowance: payload.value.allowance,
      expiresAt: payload.value.expiresAt,
    },
  };
}

export async function closeProtectedSwapResult(
  session: KyraAuthSession | null,
  input: SwapCloseoutInput,
): Promise<SwapExecutionCloseoutResult> {
  if (!session || !appConfig.functions.swapResultCloseoutConfigured) {
    return {
      ok: false,
      message: "Private swap receipt verification is unavailable.",
    };
  }
  return await requestSwapCloseout(
    createSessionSwapPost(
      appConfig.functions.swapResultCloseoutUrl,
      session,
      clientTimeoutMs,
    ),
    input,
  );
}

export async function requestSwapCloseout(
  post: SwapPost,
  input: SwapCloseoutInput,
): Promise<SwapExecutionCloseoutResult> {
  const payload = await post({ ...input });
  if (!payload.ok || !isCloseoutResponse(payload.value)) {
    return {
      ok: false,
      message: "Private swap receipt verification failed safely.",
    };
  }
  return {
    ok: true,
    status: payload.value.status,
    step: payload.value.step,
    nextAction: payload.value.nextAction,
    txHashLabel: payload.value.txHashLabel,
  };
}

interface PreparedResponse extends Omit<PreparedSwapExecution, "requestId"> {
  ok: true;
  status: "prepared";
  intentId: string;
  chainKey: "robinhood_mainnet";
  chainId: typeof robinhoodChain.id;
  policyVersion: 2;
  executionScope: "private_account_wallet";
}

function isPreparedResponse(
  value: unknown,
  input: SwapExecutionPrepareInput,
): value is PreparedResponse {
  if (!isRecord(value) || Object.keys(value).sort().join(",") !== prepareKeys) {
    return false;
  }
  if (
    !isRecord(value.transaction) ||
    Object.keys(value.transaction).sort().join(",") !== transactionKeys
  ) return false;
  const sender = readChecksummedAddress(value.sender);
  const to = readChecksummedAddress(value.transaction.to);
  const expiresAt = typeof value.expiresAt === "string"
    ? Date.parse(value.expiresAt)
    : Number.NaN;
  const now = Date.now();
  if (
    value.ok !== true || value.status !== "prepared" ||
    value.intentId !== input.requestId ||
    value.quoteRecordId !== input.quoteRecordId ||
    !isCanonicalUuid(value.intentRecordId) ||
    value.step !== input.step || value.chainKey !== "robinhood_mainnet" ||
    value.chainId !== robinhoodChain.id || sender !== input.sender || !to ||
    typeof value.transaction.data !== "string" ||
    !/^0x(?:[0-9a-f]{2})+$/u.test(value.transaction.data) ||
    typeof value.transaction.valueWei !== "string" ||
    !/^(?:0|[1-9][0-9]*)$/u.test(value.transaction.valueWei) ||
    !isServerExpiryWithinLifetime(expiresAt, 10 * 60 * 1000, now) ||
    value.policyVersion !== 2 ||
    value.executionScope !== "private_account_wallet"
  ) return false;

  // Swaps only ever call the Uniswap router; allowances only ever let that
  // router spend USDG.
  if (input.step === "swap") {
    return value.allowance === null &&
      to.toLowerCase() === uniswapSwapRouter02Address.toLowerCase();
  }
  if (
    !isRecord(value.allowance) ||
    Object.keys(value.allowance).sort().join(",") !== allowanceKeys
  ) return false;
  const token = readChecksummedAddress(value.allowance.token);
  const spender = readChecksummedAddress(value.allowance.spender);
  const amount = value.allowance.amountAtomic;
  if (
    token?.toLowerCase() !== usdgTokenAddress.toLowerCase() ||
    to.toLowerCase() !== usdgTokenAddress.toLowerCase() || !spender ||
    spender.toLowerCase() !== uniswapSwapRouter02Address.toLowerCase() ||
    typeof amount !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(amount) ||
    (input.step === "allowance_set" ? BigInt(amount) <= 0n : amount !== "0")
  ) return false;
  try {
    const decoded = decodeFunctionData({
      abi: erc20Abi,
      data: value.transaction.data as `0x${string}`,
    });
    return decoded.functionName === "approve" &&
      decoded.args[0].toLowerCase() === spender.toLowerCase() &&
      decoded.args[1].toString() === amount &&
      value.transaction.valueWei === "0";
  } catch {
    return false;
  }
}

interface CloseoutResponse {
  ok: true;
  status: SwapExecutionResultStatus;
  step: SwapExecutionStep;
  chainKey: "robinhood_mainnet";
  txHashLabel: string;
  nextAction: SwapExecutionNextAction;
  visibility: "owner-only";
}

function isCloseoutResponse(value: unknown): value is CloseoutResponse {
  return isRecord(value) &&
    Object.keys(value).sort().join(",") === closeoutKeys &&
    value.ok === true &&
    statuses.includes(value.status as SwapExecutionResultStatus) &&
    steps.includes(value.step as SwapExecutionStep) &&
    value.chainKey === "robinhood_mainnet" &&
    typeof value.txHashLabel === "string" &&
    /^0x[0-9a-f]{8}\.\.\.[0-9a-f]{8}$/iu.test(value.txHashLabel) &&
    nextActions.includes(value.nextAction as SwapExecutionNextAction) &&
    value.visibility === "owner-only";
}

function readChecksummedAddress(value: unknown): `0x${string}` | null {
  if (typeof value !== "string") return null;
  try {
    const address = getAddress(value);
    return address === value ? address : null;
  } catch {
    return null;
  }
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      .test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
