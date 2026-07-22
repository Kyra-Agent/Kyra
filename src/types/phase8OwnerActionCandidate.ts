import type { PreparedActionCanonicalInput } from "./preparedAction";
import { currentProductChain } from "../config/productChains";
import { baseChainId } from "./unsignedTransactionHandoff";

const evmAddressPattern = /^0x[0-9a-fA-F]{40}$/u;

function isEvmAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && evmAddressPattern.test(value);
}

export type Phase8OwnerActionCandidateFailure =
  | "owner_required"
  | "workspace_required"
  | "agent_required"
  | "base_account_required"
  | "base_chain_required"
  | "base_account_address_required";

export interface Phase8OwnerActionCandidateInput {
  ownerUserId: string | null | undefined;
  workspaceId: string | null | undefined;
  agentId: string | null | undefined;
  baseAccountConnected: boolean;
  baseAccountAddress: unknown;
  chainId: unknown;
}

export type Phase8OwnerActionCandidateResult =
  | {
      ok: true;
      candidate: PreparedActionCanonicalInput & {
        actionKind: "base_reviewed_transaction";
      };
      reasons: [];
      message: string;
    }
  | {
      ok: false;
      candidate: null;
      reasons: Phase8OwnerActionCandidateFailure[];
      message: string;
    };

export function createPhase8OwnerActionCandidate(
  input: Phase8OwnerActionCandidateInput,
): Phase8OwnerActionCandidateResult {
  const reasons: Phase8OwnerActionCandidateFailure[] = [];

  if (!input.ownerUserId) reasons.push("owner_required");
  if (!input.workspaceId) reasons.push("workspace_required");
  if (!input.agentId) reasons.push("agent_required");
  if (!input.baseAccountConnected) reasons.push("base_account_required");
  if (input.chainId !== baseChainId) reasons.push("base_chain_required");
  if (!isEvmAddress(input.baseAccountAddress)) {
    reasons.push("base_account_address_required");
  }

  if (reasons.length) {
    return {
      ok: false,
      candidate: null,
      reasons,
      message:
        `Owner wallet self-check candidate is locked until owner, agent, ${currentProductChain.name} network, and browser-session address are ready.`,
    };
  }

  return {
    ok: true,
    candidate: {
      actionKind: "base_reviewed_transaction",
      chain: currentProductChain.name,
      routeSummary: "Owner wallet self-check controlled transaction.",
      valueSummary: "Zero ETH, no token spend, no calldata, self-address recipient.",
      risk: "review",
      requiresWallet: true,
      recipient: input.baseAccountAddress as `0x${string}`,
      valueWei: "0",
      data: "0x",
    },
    reasons: [],
    message:
      "Owner wallet self-check candidate is ready for private-dashboard review.",
  };
}
