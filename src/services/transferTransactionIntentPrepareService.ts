import { getAddress } from "viem";
import { appConfig } from "../config/appConfig";
import {
  type ReviewedTransferTransaction,
  transferTransactionPolicyVersion,
} from "../config/transferTransactionPolicy";
import { productChainId } from "../types/unsignedTransactionHandoff";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey } from "./supabaseRestClient";

export interface TransferTransactionIntentPrepareInput {
  workspaceId: string;
  agentId: string;
  requestId: string;
  transaction: ReviewedTransferTransaction;
}

export type TransferTransactionIntentPrepareResult =
  | {
    ok: true;
    status: "prepared";
    message: string;
    preparedActionRecordId: string;
    expiresAt: string;
  }
  | {
    ok: false;
    status: "not-configured" | "rate-limited" | "error";
    message: string;
  };

interface PreparedTransferResponse {
  amountAtomic: string;
  assetKind: ReviewedTransferTransaction["assetKind"];
  chainId: typeof productChainId;
  chainKey: "robinhood_mainnet";
  data: `0x${string}`;
  expiresAt: string;
  ok: true;
  policyVersion: typeof transferTransactionPolicyVersion;
  preparedActionId: string;
  preparedActionRecordId: string;
  recipient: `0x${string}`;
  sender: `0x${string}`;
  status: "prepared";
  tokenAddress: `0x${string}` | null;
  tokenDecimals: 18;
  tokenSymbol: "ETH" | "KYRA";
  valueWei: string;
}

const preparedTransferResponseKeys = [
  "amountAtomic",
  "assetKind",
  "chainId",
  "chainKey",
  "data",
  "expiresAt",
  "ok",
  "policyVersion",
  "preparedActionId",
  "preparedActionRecordId",
  "recipient",
  "sender",
  "status",
  "tokenAddress",
  "tokenDecimals",
  "tokenSymbol",
  "valueWei",
].sort().join(",");

export async function prepareTransferTransactionIntent(
  session: KyraAuthSession | null,
  input: TransferTransactionIntentPrepareInput,
): Promise<TransferTransactionIntentPrepareResult> {
  if (appConfig.chain.currentKey !== "robinhood_mainnet") {
    return {
      ok: false,
      status: "not-configured",
      message: "Transfers are available only on the approved Robinhood Chain release.",
    };
  }

  if (!session || !appConfig.functions.transactionIntentPrepareConfigured) {
    return {
      ok: false,
      status: "not-configured",
      message: "Private transfer preparation is unavailable.",
    };
  }

  try {
    const response = await fetch(appConfig.functions.transactionIntentPrepareUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: getSupabaseApiKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        workspaceId: input.workspaceId,
        agentId: input.agentId,
        requestId: input.requestId,
        chainKey: "robinhood_mainnet",
        chainId: productChainId,
        ...input.transaction,
      }),
    });
    const payload = await readResponse(response);

    if (!response.ok || !isPreparedTransferResponse(payload)) {
      return {
        ok: false,
        status: response.status === 429 ? "rate-limited" : "error",
        message: response.status === 429
          ? "The private transfer review limit has been reached. Wait before trying again."
          : "Transfer preparation failed safely.",
      };
    }

    if (!matchesReviewedTransfer(payload, input)) {
      return {
        ok: false,
        status: "error",
        message: "The prepared transfer does not match the reviewed action.",
      };
    }

    return {
      ok: true,
      status: "prepared",
      message: "Transfer details are locked for explicit wallet confirmation.",
      preparedActionRecordId: payload.preparedActionRecordId,
      expiresAt: payload.expiresAt,
    };
  } catch {
    return {
      ok: false,
      status: "error",
      message: "Transfer preparation failed safely.",
    };
  }
}

function isPreparedTransferResponse(
  value: unknown,
): value is PreparedTransferResponse {
  if (!isRecord(value)) return false;

  const expiresAt = typeof value.expiresAt === "string"
    ? Date.parse(value.expiresAt)
    : Number.NaN;
  const now = Date.now();
  const sender = readChecksummedAddress(value.sender);
  const recipient = readChecksummedAddress(value.recipient);
  const tokenAddress = value.tokenAddress === null
    ? null
    : readChecksummedAddress(value.tokenAddress);

  return Object.keys(value).sort().join(",") === preparedTransferResponseKeys &&
    value.ok === true &&
    value.status === "prepared" &&
    typeof value.preparedActionId === "string" &&
    isCanonicalUuid(value.preparedActionRecordId) &&
    Number.isFinite(expiresAt) &&
    expiresAt > now &&
    expiresAt <= now + 10 * 60 * 1000 &&
    value.chainKey === "robinhood_mainnet" &&
    value.chainId === productChainId &&
    sender !== null &&
    recipient !== null &&
    (value.assetKind === "native" || value.assetKind === "erc20") &&
    (value.tokenAddress === null || tokenAddress !== null) &&
    (value.tokenSymbol === "ETH" || value.tokenSymbol === "KYRA") &&
    value.tokenDecimals === 18 &&
    typeof value.amountAtomic === "string" &&
    /^[1-9][0-9]*$/u.test(value.amountAtomic) &&
    typeof value.valueWei === "string" &&
    /^(0|[1-9][0-9]*)$/u.test(value.valueWei) &&
    typeof value.data === "string" &&
    /^0x(?:[0-9a-f]{2})*$/u.test(value.data) &&
    value.policyVersion === transferTransactionPolicyVersion;
}

function matchesReviewedTransfer(
  payload: PreparedTransferResponse,
  input: TransferTransactionIntentPrepareInput,
) {
  const transaction = input.transaction;
  return payload.preparedActionId === input.requestId &&
    payload.sender === transaction.sender &&
    payload.recipient === transaction.recipient &&
    payload.assetKind === transaction.assetKind &&
    payload.tokenAddress === transaction.tokenAddress &&
    payload.tokenSymbol === transaction.tokenSymbol &&
    payload.tokenDecimals === transaction.tokenDecimals &&
    payload.amountAtomic === transaction.amountAtomic &&
    payload.valueWei === transaction.valueWei &&
    payload.data === transaction.data &&
    payload.policyVersion === transaction.policyVersion;
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

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      .test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
