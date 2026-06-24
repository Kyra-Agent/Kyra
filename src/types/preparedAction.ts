import {
  baseChainId,
  isEvmAddress,
  isHexData,
  isSafeValueWei,
} from "./unsignedTransactionHandoff";

export const preparedActionAllowedKinds = [
  "base_mcp_status_check",
  "base_reviewed_transaction",
] as const;

export type PreparedActionKind = (typeof preparedActionAllowedKinds)[number];
export type PreparedActionChain = "Base";
export type PreparedActionRisk = "read-only" | "review" | "blocked";
export type PreparedActionSource =
  | "owner_dashboard"
  | "telegram"
  | "llm"
  | "provider"
  | "plugin"
  | "public_page";
export type PreparedActionStatus =
  | "draft"
  | "preparing"
  | "preview_ready"
  | "review_required"
  | "approved"
  | "rejected"
  | "expired"
  | "failed";

export interface PreparedActionOwnerSummary {
  id: string;
  workspaceId: string;
  agentId: string;
  actionKind: PreparedActionKind;
  chain: PreparedActionChain;
  status: PreparedActionStatus;
  risk: PreparedActionRisk;
  routeSummary: string;
  valueSummary: string;
  approvalRequirement: string;
  expiresAt: string | null;
  createdAt: string;
  safetyNote: string;
}

export interface PreparedActionPrivateStorageDraft extends PreparedActionOwnerSummary {
  requestId: string;
  ownerUserId: string;
  provider: "base_mcp";
  providerPayloadRef: string | null;
  rawProviderPayloadEncrypted?: never;
  walletAddress?: never;
  telegramTokenRef?: never;
}

export interface PreparedActionPublicSummary {
  agentId: string;
  actionKind: PreparedActionKind;
  chain: PreparedActionChain;
  status: "draft" | "preview_ready" | "expired" | "failed";
  risk: PreparedActionRisk;
  routeSummary: string;
  valueSummary: string;
  safetyNote: string;
}

export type PreparedActionAllowlistBlockReason =
  | "unknown_action_kind"
  | "untrusted_source"
  | "schema_mismatch"
  | "base_chain_required"
  | "invalid_recipient"
  | "invalid_value"
  | "invalid_calldata"
  | "calldata_not_allowed"
  | "token_spend_not_allowed"
  | "wallet_execution_disabled";

export interface PreparedActionAllowlistInput {
  source: PreparedActionSource;
  walletExecutionEnabled: boolean;
  actionKind: unknown;
  chainId: unknown;
  recipient?: unknown;
  valueWei?: unknown;
  data?: unknown;
  routeSummary?: unknown;
  valueSummary?: unknown;
}

export interface PreparedActionAllowlistResult {
  allowed: boolean;
  actionKind: PreparedActionKind | null;
  risk: PreparedActionRisk;
  requiresWallet: boolean;
  reasons: PreparedActionAllowlistBlockReason[];
  canonical: PreparedActionCanonicalInput | null;
}

export type PreparedActionCanonicalInput =
  | {
    actionKind: "base_mcp_status_check";
    chain: "Base";
    routeSummary: "Read-only Base capability check.";
    valueSummary: "No token spend, no gas request, no calldata.";
    risk: "read-only";
    requiresWallet: false;
    recipient: null;
    valueWei: "0";
    data: "0x";
  }
  | {
    actionKind: "base_reviewed_transaction";
    chain: "Base";
    routeSummary: string;
    valueSummary: string;
    risk: "review";
    requiresWallet: true;
    recipient: `0x${string}`;
    valueWei: string;
    data: `0x${string}`;
  };

export function isPreparedActionAllowedKind(
  value: unknown,
): value is PreparedActionKind {
  return typeof value === "string" &&
    preparedActionAllowedKinds.includes(value as PreparedActionKind);
}

export function reviewPreparedActionAllowlist(
  input: PreparedActionAllowlistInput,
): PreparedActionAllowlistResult {
  if (!isPreparedActionAllowedKind(input.actionKind)) {
    return blockPreparedActionAllowlist("unknown_action_kind", null);
  }

  if (input.source !== "owner_dashboard") {
    return blockPreparedActionAllowlist("untrusted_source", input.actionKind);
  }

  if (input.actionKind === "base_mcp_status_check") {
    if (input.chainId !== baseChainId) {
      return blockPreparedActionAllowlist("base_chain_required", input.actionKind);
    }

    return {
      allowed: true,
      actionKind: input.actionKind,
      risk: "read-only",
      requiresWallet: false,
      reasons: [],
      canonical: {
        actionKind: "base_mcp_status_check",
        chain: "Base",
        routeSummary: "Read-only Base capability check.",
        valueSummary: "No token spend, no gas request, no calldata.",
        risk: "read-only",
        requiresWallet: false,
        recipient: null,
        valueWei: "0",
        data: "0x",
      },
    };
  }

  if (!input.walletExecutionEnabled) {
    return blockPreparedActionAllowlist(
      "wallet_execution_disabled",
      input.actionKind,
    );
  }

  if (input.chainId !== baseChainId) {
    return blockPreparedActionAllowlist("base_chain_required", input.actionKind);
  }

  if (!isEvmAddress(input.recipient)) {
    return blockPreparedActionAllowlist("invalid_recipient", input.actionKind);
  }

  if (!isSafeValueWei(input.valueWei)) {
    return blockPreparedActionAllowlist("invalid_value", input.actionKind);
  }

  if (!isHexData(input.data)) {
    return blockPreparedActionAllowlist("invalid_calldata", input.actionKind);
  }

  if (input.data !== "0x") {
    return blockPreparedActionAllowlist("calldata_not_allowed", input.actionKind);
  }

  if (input.valueWei !== "0") {
    return blockPreparedActionAllowlist("token_spend_not_allowed", input.actionKind);
  }

  if (
    !isBoundedSummary(input.routeSummary) ||
    !isBoundedSummary(input.valueSummary)
  ) {
    return blockPreparedActionAllowlist("schema_mismatch", input.actionKind);
  }

  return {
    allowed: true,
    actionKind: input.actionKind,
    risk: "review",
    requiresWallet: true,
    reasons: [],
    canonical: {
      actionKind: "base_reviewed_transaction",
      chain: "Base",
      routeSummary: input.routeSummary.trim(),
      valueSummary: input.valueSummary.trim(),
      risk: "review",
      requiresWallet: true,
      recipient: input.recipient,
      valueWei: input.valueWei,
      data: input.data,
    },
  };
}

export function createPreparedActionOwnerSummary(
  input: PreparedActionOwnerSummary,
): PreparedActionOwnerSummary {
  return {
    id: input.id,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    actionKind: input.actionKind,
    chain: input.chain,
    status: input.status,
    risk: input.risk,
    routeSummary: input.routeSummary,
    valueSummary: input.valueSummary,
    approvalRequirement: input.approvalRequirement,
    expiresAt: input.expiresAt,
    createdAt: input.createdAt,
    safetyNote: input.safetyNote,
  };
}

function blockPreparedActionAllowlist(
  reason: PreparedActionAllowlistBlockReason,
  actionKind: PreparedActionKind | null,
): PreparedActionAllowlistResult {
  return {
    allowed: false,
    actionKind,
    risk: "blocked",
    requiresWallet: false,
    reasons: [reason],
    canonical: null,
  };
}

function isBoundedSummary(value: unknown): value is string {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 160 &&
    !/[<>]/u.test(value);
}
