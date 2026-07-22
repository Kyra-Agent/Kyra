import { currentProductChain } from "../config/productChains";

export const ownerWalletChainId = currentProductChain.id;
export const ownerWalletConnectorType = "injected" as const;
export const ownerWalletMinimumSessionValiditySeconds = 30;

export type OwnerWalletConnectionFailureCode =
  | "owner_session_required"
  | "agent_binding_required"
  | "provider_unavailable"
  | "user_rejected"
  | "network_mismatch"
  | "binding_changed"
  | "unknown";

export interface OwnerWalletConnectionTarget {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  sessionExpiresAt: number;
}

export interface OwnerWalletConnectionBinding
  extends OwnerWalletConnectionTarget {
  address: `0x${string}`;
  chainId: typeof ownerWalletChainId;
  connectorId: string;
  connectorType: typeof ownerWalletConnectorType;
}

export interface CreateOwnerWalletConnectionBindingInput
  extends OwnerWalletConnectionTarget {
  address: unknown;
  chainId: unknown;
  connectorId: unknown;
  connectorType: unknown;
}

export interface OwnerWalletConnectionSnapshot {
  address: unknown;
  chainId: unknown;
  connectorId: unknown;
  connectorType: unknown;
}

const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const addressPattern = /^0x[0-9a-fA-F]{40}$/u;
const connectorIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

export function isOwnerWalletConnectionTarget(
  value: Partial<OwnerWalletConnectionTarget>,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): value is OwnerWalletConnectionTarget {
  return isCanonicalUuid(value.ownerUserId) &&
    isCanonicalUuid(value.workspaceId) &&
    isCanonicalUuid(value.agentId) &&
    Number.isSafeInteger(value.sessionExpiresAt) &&
    (value.sessionExpiresAt ?? 0) >=
      nowEpochSeconds + ownerWalletMinimumSessionValiditySeconds;
}

export function createOwnerWalletConnectionBinding(
  input: CreateOwnerWalletConnectionBindingInput,
  nowEpochSeconds = Math.floor(Date.now() / 1000),
): OwnerWalletConnectionBinding {
  if (!isOwnerWalletConnectionTarget(input, nowEpochSeconds)) {
    throw new Error("Owner wallet connection target is invalid or expired.");
  }

  if (
    input.connectorType !== ownerWalletConnectorType ||
    typeof input.connectorId !== "string" ||
    !connectorIdPattern.test(input.connectorId) ||
    input.chainId !== ownerWalletChainId ||
    typeof input.address !== "string" ||
    !addressPattern.test(input.address)
  ) {
    throw new Error("Owner wallet connection response is invalid.");
  }

  return {
    ownerUserId: input.ownerUserId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    sessionExpiresAt: input.sessionExpiresAt,
    address: input.address as `0x${string}`,
    chainId: ownerWalletChainId,
    connectorId: input.connectorId,
    connectorType: ownerWalletConnectorType,
  };
}

export function walletBindingMatchesTarget(
  binding: OwnerWalletConnectionBinding,
  target: OwnerWalletConnectionTarget,
) {
  return binding.ownerUserId === target.ownerUserId &&
    binding.workspaceId === target.workspaceId &&
    binding.agentId === target.agentId &&
    binding.sessionExpiresAt === target.sessionExpiresAt;
}

export function walletConnectionMatchesBinding(
  binding: OwnerWalletConnectionBinding,
  snapshot: OwnerWalletConnectionSnapshot,
) {
  return typeof snapshot.address === "string" &&
    snapshot.address.toLowerCase() === binding.address.toLowerCase() &&
    snapshot.chainId === binding.chainId &&
    snapshot.connectorId === binding.connectorId &&
    snapshot.connectorType === binding.connectorType;
}

export function maskOwnerWalletAddress(address: string) {
  if (!addressPattern.test(address)) {
    return "Address unavailable";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getOwnerWalletConnectionFailureMessage(
  code: OwnerWalletConnectionFailureCode,
) {
  return ownerWalletConnectionFailureMessages[code];
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && canonicalUuidPattern.test(value);
}

const ownerWalletConnectionFailureMessages: Record<
  OwnerWalletConnectionFailureCode,
  string
> = {
  owner_session_required:
    "Sign in again before connecting a wallet.",
  agent_binding_required:
    "Select a persisted agent before connecting a wallet.",
  provider_unavailable:
    "No compatible EVM wallet is available in this browser.",
  user_rejected:
    "Wallet connection was cancelled.",
  network_mismatch:
    `Wallet must connect on ${currentProductChain.name}.`,
  binding_changed:
    "The owner, session, agent, account, network, or wallet provider changed. Connect again.",
  unknown:
    "Wallet connection failed safely.",
};
