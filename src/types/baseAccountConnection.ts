import { currentProductChain } from "../config/productChains";

export const baseAccountChainId = currentProductChain.id;
export const baseAccountConnectorId = "baseAccount" as const;

export type BaseAccountConnectionFailureCode =
  | "owner_session_required"
  | "agent_binding_required"
  | "provider_unavailable"
  | "user_rejected"
  | "network_mismatch"
  | "binding_changed"
  | "unknown";

export interface BaseAccountConnectionTarget {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
}

export interface BaseAccountConnectionBinding
  extends BaseAccountConnectionTarget {
  address: `0x${string}`;
  chainId: typeof baseAccountChainId;
  connectorId: typeof baseAccountConnectorId;
}

export interface CreateBaseAccountConnectionBindingInput
  extends BaseAccountConnectionTarget {
  address: unknown;
  chainId: unknown;
  connectorId: unknown;
}

export interface BaseAccountConnectionSnapshot {
  address: unknown;
  chainId: unknown;
  connectorId: unknown;
}

const canonicalUuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const addressPattern = /^0x[0-9a-fA-F]{40}$/u;

export function isBaseAccountConnectionTarget(
  value: Partial<BaseAccountConnectionTarget>,
): value is BaseAccountConnectionTarget {
  return isCanonicalUuid(value.ownerUserId) &&
    isCanonicalUuid(value.workspaceId) &&
    isCanonicalUuid(value.agentId);
}

export function createBaseAccountConnectionBinding(
  input: CreateBaseAccountConnectionBindingInput,
): BaseAccountConnectionBinding {
  if (!isBaseAccountConnectionTarget(input)) {
    throw new Error("Base Account connection target is invalid.");
  }

  if (
    input.connectorId !== baseAccountConnectorId ||
    input.chainId !== baseAccountChainId ||
    typeof input.address !== "string" ||
    !addressPattern.test(input.address)
  ) {
    throw new Error("Base Account connection response is invalid.");
  }

  return {
    ownerUserId: input.ownerUserId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
    address: input.address as `0x${string}`,
    chainId: baseAccountChainId,
    connectorId: baseAccountConnectorId,
  };
}

export function bindingMatchesTarget(
  binding: BaseAccountConnectionBinding,
  target: BaseAccountConnectionTarget,
) {
  return binding.ownerUserId === target.ownerUserId &&
    binding.workspaceId === target.workspaceId &&
    binding.agentId === target.agentId;
}

export function connectionMatchesBinding(
  binding: BaseAccountConnectionBinding,
  snapshot: BaseAccountConnectionSnapshot,
) {
  return typeof snapshot.address === "string" &&
    snapshot.address.toLowerCase() === binding.address.toLowerCase() &&
    snapshot.chainId === binding.chainId &&
    snapshot.connectorId === binding.connectorId;
}

export function maskBaseAccountAddress(address: string) {
  if (!addressPattern.test(address)) {
    return "Address unavailable";
  }

  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function getBaseAccountConnectionFailureMessage(
  code: BaseAccountConnectionFailureCode,
) {
  return baseAccountConnectionFailureMessages[code];
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" && canonicalUuidPattern.test(value);
}

const baseAccountConnectionFailureMessages: Record<
  BaseAccountConnectionFailureCode,
  string
> = {
  owner_session_required:
    "Sign in again before connecting a Base Account.",
  agent_binding_required:
    "Select a persisted agent before connecting a Base Account.",
  provider_unavailable:
    "Base Account is unavailable in this browser.",
  user_rejected:
    "Base Account connection was cancelled.",
  network_mismatch:
    "Base Account must connect on Base.",
  binding_changed:
    "The selected owner or agent changed. Connect again for the new target.",
  unknown:
    "Base Account connection failed safely.",
};
