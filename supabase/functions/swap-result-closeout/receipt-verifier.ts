import { decodeEventLog, erc20Abi } from "npm:viem@2.52.2";
import {
  deriveVerifiedSwapExecutionResult,
  HttpError,
  type StoredSwapExecutionIntent,
  type VerifiedSwapExecutionResult,
} from "./core.ts";

const expectedChainId = "0x1237";
const rpcTimeoutMs = 8_000;
const addressPattern = /^0x[0-9a-f]{40}$/iu;
const hashPattern = /^0x[0-9a-f]{64}$/iu;

export interface ReceiptRpcConfig {
  rpcUrl: string;
}

export function readReceiptRpcConfig(
  getEnv: (key: string) => string | undefined,
): ReceiptRpcConfig {
  const rawUrl = getEnv("KYRA_ROBINHOOD_MAINNET_RPC_URL")?.trim();
  const rawAllowedHosts = getEnv("KYRA_ROBINHOOD_MAINNET_RPC_ALLOWED_HOSTS")
    ?.trim();
  if (!rawUrl || !rawAllowedHosts) {
    throw new HttpError(
      503,
      "receipt_rpc_unavailable",
      "Swap verification is unavailable.",
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw invalidRpc();
  }
  const allowedHosts = new Set(
    rawAllowedHosts.split(",").map((host) => host.trim().toLowerCase()).filter(
      Boolean,
    ),
  );
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    throw invalidRpc();
  }
  return { rpcUrl: url.toString() };
}

export async function verifySwapExecutionReceipt(input: {
  rpcUrl: string;
  txHash: string;
  intent: StoredSwapExecutionIntent;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<VerifiedSwapExecutionResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const chainId = await rpcRequest(fetchImpl, input.rpcUrl, "eth_chainId", []);
  if (
    typeof chainId !== "string" || chainId.toLowerCase() !== expectedChainId
  ) {
    throw new HttpError(
      502,
      "receipt_chain_mismatch",
      "The provider is not serving Robinhood Chain mainnet.",
    );
  }

  const transaction = await rpcRequest(
    fetchImpl,
    input.rpcUrl,
    "eth_getTransactionByHash",
    [input.txHash],
  );
  if (!isRecord(transaction)) {
    throw new HttpError(
      409,
      "transaction_not_found",
      "The transaction is not visible on Robinhood Chain yet.",
    );
  }

  const expectedHash = input.txHash.toLowerCase();
  const expectedSender = normalizeAddress(
    input.intent.sender_address,
    "swap_execution_intent_invalid",
  );
  const expectedTarget = normalizeAddress(
    input.intent.transaction_to,
    "swap_execution_intent_invalid",
  );
  const expectedValue = parseDecimalQuantity(
    input.intent.transaction_value_wei,
  );
  if (
    normalizeHash(transaction.hash) !== expectedHash ||
    normalizeAddress(transaction.from, "receipt_scope_mismatch") !==
      expectedSender ||
    normalizeAddress(transaction.to, "receipt_scope_mismatch") !==
      expectedTarget ||
    parseRpcQuantity(transaction.value, "receipt_scope_mismatch") !==
      expectedValue ||
    normalizeCalldata(transaction.input) !==
      input.intent.transaction_data.toLowerCase() ||
    (transaction.chainId !== undefined &&
      String(transaction.chainId).toLowerCase() !== expectedChainId)
  ) {
    throw scopeMismatch();
  }

  const receiptValue = await rpcRequest(
    fetchImpl,
    input.rpcUrl,
    "eth_getTransactionReceipt",
    [input.txHash],
  );
  if (receiptValue !== null && !isRecord(receiptValue)) {
    throw new HttpError(
      502,
      "receipt_invalid",
      "The provider returned an invalid transaction receipt.",
    );
  }

  const checkedAt = (input.now ?? new Date()).toISOString();
  if (!receiptValue) {
    return deriveVerifiedSwapExecutionResult(null, checkedAt);
  }
  if (
    normalizeHash(receiptValue.transactionHash) !== expectedHash ||
    normalizeAddress(receiptValue.from, "receipt_scope_mismatch") !==
      expectedSender ||
    normalizeAddress(receiptValue.to, "receipt_scope_mismatch") !==
      expectedTarget
  ) {
    throw scopeMismatch();
  }

  const derived = deriveVerifiedSwapExecutionResult(receiptValue, checkedAt);
  if (
    derived.status === "confirmed" &&
    input.intent.step !== "swap"
  ) {
    assertExactApprovalReceipt(receiptValue, input.intent);
  }
  return derived;
}

async function rpcRequest(
  fetchImpl: typeof fetch,
  rpcUrl: string,
  method: string,
  params: unknown[],
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), rpcTimeoutMs);
  try {
    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      redirect: "error",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    if (!response.ok) throw rpcFailed();
    const payload = await response.json() as Record<string, unknown>;
    if (payload.error || !("result" in payload)) throw rpcFailed();
    return payload.result;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw rpcFailed();
  } finally {
    clearTimeout(timeout);
  }
}

function assertExactApprovalReceipt(
  receipt: Record<string, unknown>,
  intent: StoredSwapExecutionIntent,
) {
  if (!Array.isArray(receipt.logs)) throw approvalMismatch();
  const expectedToken = normalizeAddress(
    intent.token_address,
    "swap_execution_intent_invalid",
  );
  const expectedOwner = normalizeAddress(
    intent.sender_address,
    "swap_execution_intent_invalid",
  );
  const expectedSpender = normalizeAddress(
    intent.spender_address,
    "swap_execution_intent_invalid",
  );
  const expectedAmount = parseDecimalQuantity(intent.allowance_amount_atomic);

  const matches = receipt.logs.some((candidate) => {
    if (!isRecord(candidate)) return false;
    try {
      if (
        normalizeAddress(candidate.address, "receipt_scope_mismatch") !==
          expectedToken ||
        !Array.isArray(candidate.topics) ||
        typeof candidate.data !== "string"
      ) {
        return false;
      }
      const decoded = decodeEventLog({
        abi: erc20Abi,
        eventName: "Approval",
        topics: candidate.topics as [`0x${string}`, ...`0x${string}`[]],
        data: candidate.data as `0x${string}`,
        strict: true,
      });
      const args = decoded.args as {
        owner?: string;
        spender?: string;
        value?: bigint;
      };
      return normalizeAddress(args.owner, "receipt_scope_mismatch") ===
          expectedOwner &&
        normalizeAddress(args.spender, "receipt_scope_mismatch") ===
          expectedSpender &&
        args.value === expectedAmount;
    } catch {
      return false;
    }
  });
  if (!matches) throw approvalMismatch();
}

function normalizeAddress(value: unknown, code: string) {
  if (typeof value !== "string" || !addressPattern.test(value)) {
    throw new HttpError(
      409,
      code,
      "The transaction address does not match the prepared swap step.",
    );
  }
  return value.toLowerCase();
}

function normalizeHash(value: unknown) {
  if (typeof value !== "string" || !hashPattern.test(value)) {
    throw new HttpError(
      502,
      "receipt_invalid",
      "The provider returned an invalid transaction hash.",
    );
  }
  return value.toLowerCase();
}

function parseRpcQuantity(value: unknown, code: string) {
  if (typeof value !== "string" || !/^0x[0-9a-f]+$/iu.test(value)) {
    throw new HttpError(
      409,
      code,
      "The transaction does not match the prepared swap step.",
    );
  }
  return BigInt(value);
}

function parseDecimalQuantity(value: unknown) {
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/u.test(value)) {
    throw new HttpError(
      409,
      "swap_execution_intent_invalid",
      "The prepared swap transaction amount is invalid.",
    );
  }
  return BigInt(value);
}

function normalizeCalldata(value: unknown) {
  if (typeof value !== "string" || !/^0x(?:[0-9a-f]{2})+$/iu.test(value)) {
    throw new HttpError(
      409,
      "receipt_scope_mismatch",
      "The transaction calldata is invalid.",
    );
  }
  return value.toLowerCase();
}

function scopeMismatch() {
  return new HttpError(
    409,
    "receipt_scope_mismatch",
    "The transaction does not match the prepared swap step.",
  );
}

function approvalMismatch() {
  return new HttpError(
    409,
    "receipt_approval_event_mismatch",
    "The confirmed token approval does not match the reviewed allowance.",
  );
}

function rpcFailed() {
  return new HttpError(
    502,
    "receipt_rpc_failed",
    "Swap verification is temporarily unavailable.",
  );
}

function invalidRpc() {
  return new HttpError(
    503,
    "receipt_rpc_invalid",
    "Swap verification is unavailable.",
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
