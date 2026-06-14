export const preparedActionAllowedKinds = ["base_mcp_status_check"] as const;

export type PreparedActionKind = (typeof preparedActionAllowedKinds)[number];
export type PreparedActionChain = "Base";
export type PreparedActionRisk = "read-only" | "review" | "blocked";
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

export function isPreparedActionAllowedKind(
  value: unknown,
): value is PreparedActionKind {
  return typeof value === "string" &&
    preparedActionAllowedKinds.includes(value as PreparedActionKind);
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
