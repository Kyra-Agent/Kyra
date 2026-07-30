import { appConfig } from "../config/appConfig";
import {
  ownerTransactionCalldata,
  ownerTransactionPolicyVersion,
  ownerTransactionValueWei,
} from "../config/ownerTransactionPolicy";
import { productChainId } from "../types/unsignedTransactionHandoff";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey } from "./supabaseRestClient";

export interface TransactionIntentPrepareInput {
  workspaceId: string;
  agentId: string;
  requestId: string;
  recipient: `0x${string}`;
  valueWei: typeof ownerTransactionValueWei;
  data: typeof ownerTransactionCalldata;
}

export interface TransactionIntentPrepareResult {
  ok: boolean;
  status: "prepared" | "not-configured" | "error";
  message: string;
}

interface PrepareResponse {
  ok?: boolean;
  status?: string;
  message?: string;
  preparedActionId?: string;
  preparedActionRecordId?: string;
  expiresAt?: string;
  chainKey?: string;
  chainId?: number;
  recipient?: string;
  valueWei?: string;
  data?: string;
  policyVersion?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      .test(value);
}

function isPreparedResponse(value: unknown): value is Required<PrepareResponse> {
  if (!isRecord(value)) return false;

  const expiresAt = typeof value.expiresAt === "string"
    ? Date.parse(value.expiresAt)
    : Number.NaN;
  const now = Date.now();
  return Object.keys(value).sort().join(",") ===
      "chainId,chainKey,data,expiresAt,ok,policyVersion,preparedActionId,preparedActionRecordId,recipient,status,valueWei" &&
    value.ok === true && value.status === "prepared" &&
    typeof value.preparedActionId === "string" &&
    isCanonicalUuid(value.preparedActionRecordId) &&
    Number.isFinite(expiresAt) && expiresAt > now &&
    expiresAt <= now + 10 * 60 * 1000 &&
    value.chainKey === "robinhood_mainnet" &&
    value.chainId === productChainId &&
    typeof value.recipient === "string" &&
    /^0x[0-9a-fA-F]{40}$/u.test(value.recipient) &&
    typeof value.valueWei === "string" &&
    typeof value.data === "string" &&
    value.policyVersion === ownerTransactionPolicyVersion;
}

export async function prepareTransactionIntent(
  session: KyraAuthSession | null,
  input: TransactionIntentPrepareInput,
): Promise<TransactionIntentPrepareResult> {
  if (appConfig.chain.currentKey !== "robinhood_mainnet") {
    return {
      ok: false,
      status: "not-configured",
      message: "Owner transaction preparation is available only in the approved Robinhood mainnet release.",
    };
  }

  if (!session || !appConfig.functions.transactionIntentPrepareConfigured) {
    return {
      ok: false,
      status: "not-configured",
      message: "Owner transaction preparation is unavailable.",
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
        recipient: input.recipient,
        valueWei: input.valueWei,
        data: input.data,
      }),
    });
    const payload = await readResponse(response);
    if (!response.ok || !isPreparedResponse(payload)) {
      return {
        ok: false,
        status: "error",
        message: "Transaction preparation failed safely.",
      };
    }

    if (
      payload.preparedActionId !== input.requestId ||
      payload.chainKey !== "robinhood_mainnet" ||
      payload.chainId !== productChainId ||
      payload.recipient?.toLowerCase() !== input.recipient.toLowerCase() ||
      payload.valueWei !== input.valueWei ||
      payload.data !== input.data ||
      payload.policyVersion !== ownerTransactionPolicyVersion
    ) {
      return {
        ok: false,
        status: "error",
        message: "Prepared transaction does not match the reviewed owner action.",
      };
    }

    return {
      ok: true,
      status: "prepared",
      message: "Owner transaction intent prepared and bound to this wallet session.",
    };
  } catch {
    return {
      ok: false,
      status: "error",
      message: "Transaction preparation failed safely.",
    };
  }
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
