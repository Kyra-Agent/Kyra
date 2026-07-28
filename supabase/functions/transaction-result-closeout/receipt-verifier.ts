import {
  deriveVerifiedResult,
  HttpError,
  type StoredTransactionIntent,
  type VerifiedTransactionResult,
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
      500,
      "receipt_rpc_unavailable",
      "Transaction verification is unavailable.",
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new HttpError(
      500,
      "receipt_rpc_invalid",
      "Transaction verification is unavailable.",
    );
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
    throw new HttpError(
      500,
      "receipt_rpc_invalid",
      "Transaction verification is unavailable.",
    );
  }

  return { rpcUrl: url.toString() };
}

export async function verifyTransactionReceipt(input: {
  rpcUrl: string;
  txHash: string;
  intent: StoredTransactionIntent;
  fetchImpl?: typeof fetch;
  now?: Date;
}): Promise<VerifiedTransactionResult> {
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
  if (
    !transaction || typeof transaction !== "object" ||
    Array.isArray(transaction)
  ) {
    throw new HttpError(
      409,
      "transaction_not_found",
      "The transaction is not visible on Robinhood Chain yet.",
    );
  }

  const tx = transaction as Record<string, unknown>;
  const expectedHash = input.txHash.toLowerCase();
  const expectedRecipient = normalizeAddress(
    input.intent.recipient,
    "transaction_intent_invalid",
  );
  const expectedValue = parseDecimalWei(input.intent.value_wei);
  if (
    normalizeHash(tx.hash) !== expectedHash ||
    normalizeAddress(tx.from, "receipt_scope_mismatch") !== expectedRecipient ||
    normalizeAddress(tx.to, "receipt_scope_mismatch") !== expectedRecipient ||
    parseRpcQuantity(tx.value, "receipt_scope_mismatch") !== expectedValue ||
    normalizeCalldata(tx.input) !== input.intent.calldata ||
    (tx.chainId !== undefined &&
      String(tx.chainId).toLowerCase() !== expectedChainId)
  ) {
    throw new HttpError(
      409,
      "receipt_scope_mismatch",
      "The transaction does not match the prepared owner action.",
    );
  }

  const receiptValue = await rpcRequest(
    fetchImpl,
    input.rpcUrl,
    "eth_getTransactionReceipt",
    [input.txHash],
  );
  if (
    receiptValue !== null &&
    (typeof receiptValue !== "object" || Array.isArray(receiptValue))
  ) {
    throw new HttpError(
      502,
      "receipt_invalid",
      "The provider returned an invalid transaction receipt.",
    );
  }

  if (receiptValue) {
    const receipt = receiptValue as Record<string, unknown>;
    if (
      normalizeHash(receipt.transactionHash) !== expectedHash ||
      normalizeAddress(receipt.from, "receipt_scope_mismatch") !==
        expectedRecipient ||
      normalizeAddress(receipt.to, "receipt_scope_mismatch") !==
        expectedRecipient
    ) {
      throw new HttpError(
        409,
        "receipt_scope_mismatch",
        "The receipt does not match the prepared owner action.",
      );
    }
  }

  return deriveVerifiedResult(
    receiptValue as { status?: unknown; blockNumber?: unknown } | null,
    (input.now ?? new Date()).toISOString(),
  );
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
    if (!response.ok) {
      throw new HttpError(
        502,
        "receipt_rpc_failed",
        "Transaction verification is temporarily unavailable.",
      );
    }
    const payload = await response.json() as Record<string, unknown>;
    if (payload.error || !("result" in payload)) {
      throw new HttpError(
        502,
        "receipt_rpc_failed",
        "Transaction verification is temporarily unavailable.",
      );
    }
    return payload.result;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError(
      502,
      "receipt_rpc_failed",
      "Transaction verification is temporarily unavailable.",
    );
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAddress(value: unknown, code: string) {
  if (typeof value !== "string" || !addressPattern.test(value)) {
    throw new HttpError(
      409,
      code,
      "The transaction address does not match the prepared owner action.",
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
      "The transaction does not match the prepared owner action.",
    );
  }
  return BigInt(value);
}

function parseDecimalWei(value: unknown) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/u.test(value)) {
    throw new HttpError(
      409,
      "transaction_intent_invalid",
      "The prepared transaction value is invalid.",
    );
  }
  return BigInt(value);
}

function normalizeCalldata(value: unknown) {
  if (typeof value !== "string" || !/^0x(?:[0-9a-f]{2})*$/iu.test(value)) {
    throw new HttpError(
      409,
      "receipt_scope_mismatch",
      "The transaction calldata is invalid.",
    );
  }
  return value.toLowerCase();
}
