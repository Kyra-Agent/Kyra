import {
  isAllowedOwnerTransactionValueWei,
  ownerTransactionCalldata,
  ownerTransactionPolicyVersion,
  ownerTransactionValueWei,
} from "../_shared/owner-transaction-policy.ts";
import {
  createTransferTransactionShape,
  robinhoodMainnetChainId,
  robinhoodMainnetChainKey,
  type TransferAssetKind,
  transferTransactionPolicyVersion,
} from "../_shared/transfer-transaction-policy.ts";

export interface LegacyTransactionIntentPrepareBody {
  workspaceId: string;
  agentId: string;
  requestId: string;
  chainKey: typeof robinhoodMainnetChainKey;
  chainId: typeof robinhoodMainnetChainId;
  sender: string;
  recipient: string;
  assetKind: "native";
  tokenAddress: null;
  tokenSymbol: "ETH";
  tokenDecimals: 18;
  amountAtomic: typeof ownerTransactionValueWei;
  valueWei: typeof ownerTransactionValueWei;
  data: typeof ownerTransactionCalldata;
  policyVersion: typeof ownerTransactionPolicyVersion;
}

export interface TransferTransactionIntentPrepareBody {
  workspaceId: string;
  agentId: string;
  requestId: string;
  chainKey: typeof robinhoodMainnetChainKey;
  chainId: typeof robinhoodMainnetChainId;
  sender: `0x${string}`;
  recipient: `0x${string}`;
  assetKind: TransferAssetKind;
  tokenAddress: `0x${string}` | null;
  tokenSymbol: "ETH" | "KYRA";
  tokenDecimals: 18;
  amountAtomic: string;
  valueWei: string;
  data: `0x${string}`;
  policyVersion: typeof transferTransactionPolicyVersion;
}

export type TransactionIntentPrepareBody =
  | LegacyTransactionIntentPrepareBody
  | TransferTransactionIntentPrepareBody;

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const requestIdPattern = /^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/u;
const addressPattern = /^0x[0-9a-f]{40}$/iu;
const legacyKeys =
  "agentId,chainId,chainKey,data,recipient,requestId,valueWei,workspaceId";
const transferKeys =
  "agentId,amountAtomic,assetKind,chainId,chainKey,data,policyVersion,recipient,requestId,sender,tokenAddress,tokenDecimals,tokenSymbol,valueWei,workspaceId";

export function assertTransactionIntentPrepareBody(
  value: unknown,
): TransactionIntentPrepareBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(
      400,
      "invalid_body",
      "A valid transaction intent is required.",
    );
  }

  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort().join(",");
  assertScope(body);

  if (keys === legacyKeys) {
    if (
      body.chainKey !== robinhoodMainnetChainKey ||
      body.chainId !== robinhoodMainnetChainId ||
      typeof body.recipient !== "string" ||
      !addressPattern.test(body.recipient) ||
      !isAllowedOwnerTransactionValueWei(body.valueWei) ||
      body.data !== ownerTransactionCalldata
    ) {
      throw invalidIntent();
    }
    const recipient = body.recipient.toLowerCase();
    return {
      workspaceId: String(body.workspaceId).toLowerCase(),
      agentId: String(body.agentId).toLowerCase(),
      requestId: String(body.requestId),
      chainKey: robinhoodMainnetChainKey,
      chainId: robinhoodMainnetChainId,
      sender: recipient,
      recipient,
      assetKind: "native",
      tokenAddress: null,
      tokenSymbol: "ETH",
      tokenDecimals: 18,
      amountAtomic: ownerTransactionValueWei,
      valueWei: ownerTransactionValueWei,
      data: ownerTransactionCalldata,
      policyVersion: ownerTransactionPolicyVersion,
    };
  }

  if (keys !== transferKeys) throw invalidIntent();
  if (
    body.chainKey !== robinhoodMainnetChainKey ||
    body.chainId !== robinhoodMainnetChainId
  ) {
    throw invalidIntent();
  }

  const reviewed = createTransferTransactionShape({
    sender: body.sender,
    recipient: body.recipient,
    assetKind: body.assetKind,
    tokenAddress: body.tokenAddress,
    tokenSymbol: body.tokenSymbol,
    tokenDecimals: body.tokenDecimals,
    amountAtomic: body.amountAtomic,
    valueWei: body.valueWei,
    data: body.data,
    policyVersion: body.policyVersion,
  });
  if (!reviewed.ok) throw invalidIntent(reviewed.error);

  return {
    workspaceId: String(body.workspaceId).toLowerCase(),
    agentId: String(body.agentId).toLowerCase(),
    requestId: String(body.requestId),
    chainKey: robinhoodMainnetChainKey,
    chainId: robinhoodMainnetChainId,
    ...reviewed.transaction,
  };
}

export function matchesExistingIntent(
  existing: Record<string, unknown>,
  body: TransactionIntentPrepareBody,
) {
  return existing.workspace_id === body.workspaceId &&
    existing.agent_id === body.agentId &&
    existing.request_id === body.requestId &&
    existing.action_kind === "robinhood_reviewed_transaction" &&
    existing.chain_key === body.chainKey &&
    existing.chain_id === body.chainId &&
    existing.status === "approved" &&
    existing.risk === "review" &&
    existing.provider === "owner_dashboard" &&
    normalizeAddress(existing.sender_address) === body.sender.toLowerCase() &&
    normalizeAddress(existing.recipient) === body.recipient.toLowerCase() &&
    existing.asset_kind === body.assetKind &&
    normalizeNullableAddress(existing.token_address) ===
      normalizeNullableAddress(body.tokenAddress) &&
    existing.token_symbol === body.tokenSymbol &&
    existing.token_decimals === body.tokenDecimals &&
    existing.amount_atomic === body.amountAtomic &&
    existing.value_wei === body.valueWei &&
    String(existing.calldata).toLowerCase() === body.data.toLowerCase() &&
    existing.policy_version === body.policyVersion;
}

function assertScope(body: Record<string, unknown>) {
  if (
    typeof body.workspaceId !== "string" ||
    !uuidPattern.test(body.workspaceId) ||
    typeof body.agentId !== "string" ||
    !uuidPattern.test(body.agentId) ||
    typeof body.requestId !== "string" ||
    !requestIdPattern.test(body.requestId)
  ) {
    throw invalidIntent();
  }
}

function invalidIntent(detail?: string) {
  return new HttpError(
    400,
    "invalid_transaction_intent",
    detail
      ? `Transaction intent failed the Robinhood Chain transfer policy: ${detail}.`
      : "Transaction intent must match an approved Robinhood Chain transfer policy.",
  );
}

function normalizeAddress(value: unknown) {
  return typeof value === "string" ? value.toLowerCase() : null;
}

function normalizeNullableAddress(value: unknown) {
  return value === null ? null : normalizeAddress(value);
}
