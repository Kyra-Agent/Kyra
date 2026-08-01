import { decodeFunctionData, erc20Abi, getAddress } from "viem";
import { appConfig } from "../config/appConfig";
import { kyraTokenAddress } from "../config/transferTransactionPolicy";
import { robinhoodChain } from "../config/productChains";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey } from "./supabaseRestClient";

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

interface PrepareInput {
  workspaceId: string;
  agentId: string;
  quoteRecordId: string;
  requestId: string;
  step: SwapExecutionStep;
  sender: `0x${string}`;
}

interface CloseoutInput {
  workspaceId: string;
  agentId: string;
  intentRecordId: string;
  requestId: string;
  txHash: `0x${string}`;
}

const clientTimeoutMs = 8_000;
const maxResponseBytes = 16 * 1024;
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
  input: PrepareInput,
): Promise<SwapExecutionPrepareResult> {
  if (
    appConfig.chain.currentKey !== "robinhood_mainnet" ||
    !session ||
    !appConfig.functions.swapExecutionPrepareConfigured
  ) {
    return { ok: false, message: "Protected swap execution is unavailable." };
  }

  const payload = await postPrivateJson(
    appConfig.functions.swapExecutionPrepareUrl,
    session,
    {
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      quoteRecordId: input.quoteRecordId,
      requestId: input.requestId,
      step: input.step,
    },
  );
  if (!payload.ok || !isPreparedResponse(payload.value, input)) {
    return {
      ok: false,
      message: payload.rateLimited
        ? "The private swap execution limit was reached. Wait before retrying."
        : "Protected swap preparation failed safely.",
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
  input: CloseoutInput,
): Promise<SwapExecutionCloseoutResult> {
  if (!session || !appConfig.functions.swapResultCloseoutConfigured) {
    return {
      ok: false,
      message: "Private swap receipt verification is unavailable.",
    };
  }
  const payload = await postPrivateJson(
    appConfig.functions.swapResultCloseoutUrl,
    session,
    input,
  );
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
  policyVersion: 1;
  executionScope: "private_account_wallet";
}

function isPreparedResponse(
  value: unknown,
  input: PrepareInput,
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
    !Number.isFinite(expiresAt) || expiresAt <= now ||
    expiresAt > now + 10 * 60 * 1000 ||
    value.policyVersion !== 1 ||
    value.executionScope !== "private_account_wallet"
  ) return false;

  if (input.step === "swap") return value.allowance === null;
  if (
    !isRecord(value.allowance) ||
    Object.keys(value.allowance).sort().join(",") !== allowanceKeys
  ) return false;
  const token = readChecksummedAddress(value.allowance.token);
  const spender = readChecksummedAddress(value.allowance.spender);
  const amount = value.allowance.amountAtomic;
  if (
    token?.toLowerCase() !== kyraTokenAddress.toLowerCase() ||
    to.toLowerCase() !== kyraTokenAddress.toLowerCase() || !spender ||
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

async function postPrivateJson(
  url: string,
  session: KyraAuthSession,
  body: unknown,
): Promise<
  { ok: true; value: unknown; rateLimited: false } | {
    ok: false;
    value: unknown;
    rateLimited: boolean;
  }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), clientTimeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: getSupabaseApiKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify(body),
      redirect: "error",
      signal: controller.signal,
    });
    const value = await readResponse(response);
    return response.ok
      ? { ok: true, value, rateLimited: false }
      : { ok: false, value, rateLimited: response.status === 429 };
  } catch {
    return { ok: false, value: {}, rateLimited: false };
  } finally {
    clearTimeout(timeout);
  }
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

async function readResponse(response: Response): Promise<unknown> {
  const declared = Number(response.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declared) && declared > maxResponseBytes) {
    await response.body?.cancel().catch(() => undefined);
    return {};
  }
  const reader = response.body?.getReader();
  if (!reader) return {};
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxResponseBytes) {
        await reader.cancel().catch(() => undefined);
        return {};
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return text ? JSON.parse(text) as unknown : {};
  } catch {
    return {};
  } finally {
    reader.releaseLock();
  }
}
