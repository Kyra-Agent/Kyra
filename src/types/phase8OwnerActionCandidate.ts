import type { PreparedActionCanonicalInput } from "./preparedAction";
import { currentProductChain } from "../config/productChains";
import { productChainId } from "./unsignedTransactionHandoff";

const evmAddressPattern = /^0x[0-9a-fA-F]{40}$/u;

function isEvmAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && evmAddressPattern.test(value);
}

export type Phase8OwnerActionCandidateFailure =
  | "owner_required"
  | "workspace_required"
  | "agent_required"
  | "owner_wallet_required"
  | "product_chain_required"
  | "owner_wallet_address_required";

export interface Phase8OwnerActionCandidateInput {
  ownerUserId: string | null | undefined;
  workspaceId: string | null | undefined;
  agentId: string | null | undefined;
  ownerWalletConnected: boolean;
  ownerWalletAddress: unknown;
  chainId: unknown;
}

export type Phase8OwnerActionCandidateResult =
  | {
      ok: true;
      candidate: PreparedActionCanonicalInput & {
        actionKind: "robinhood_reviewed_transaction";
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
  if (!input.ownerWalletConnected) reasons.push("owner_wallet_required");
  if (input.chainId !== productChainId) reasons.push("product_chain_required");
  if (!isEvmAddress(input.ownerWalletAddress)) {
    reasons.push("owner_wallet_address_required");
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
      actionKind: "robinhood_reviewed_transaction",
      chain: currentProductChain.name,
      routeSummary: "Owner wallet self-check controlled transaction.",
      valueSummary: "Zero ETH, no token spend, no calldata, self-address recipient.",
      risk: "review",
      requiresWallet: true,
      recipient: input.ownerWalletAddress as `0x${string}`,
      valueWei: "0",
      data: "0x",
    },
    reasons: [],
    message:
      "Owner wallet self-check candidate is ready for private-dashboard review.",
  };
}
