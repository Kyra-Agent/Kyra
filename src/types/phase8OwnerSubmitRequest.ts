import type { FrozenPreparedAction } from "./dualApprovalExecution";
import { baseChainId, isEvmAddress, isHexData } from "./unsignedTransactionHandoff";

export type Phase8OwnerSubmitRequestFailure =
  | "frozen_action_required"
  | "base_chain_required"
  | "zero_value_required"
  | "no_calldata_required"
  | "recipient_required";

export interface Phase8OwnerSubmitRequest {
  to: `0x${string}`;
  value: 0n;
  data: "0x";
  chainId: typeof baseChainId;
}

export type Phase8OwnerSubmitRequestResult =
  | {
      ok: true;
      request: Phase8OwnerSubmitRequest;
      reason: null;
    }
  | {
      ok: false;
      request: null;
      reason: Phase8OwnerSubmitRequestFailure;
    };

export function createPhase8OwnerSubmitRequest(
  frozenAction: FrozenPreparedAction | null,
): Phase8OwnerSubmitRequestResult {
  if (!frozenAction) {
    return reject("frozen_action_required");
  }

  if (frozenAction.chain !== "Base") {
    return reject("base_chain_required");
  }

  if (frozenAction.valueWei !== "0") {
    return reject("zero_value_required");
  }

  if (frozenAction.data !== "0x" || !isHexData(frozenAction.data)) {
    return reject("no_calldata_required");
  }

  if (!isEvmAddress(frozenAction.recipient)) {
    return reject("recipient_required");
  }

  return {
    ok: true,
    request: {
      to: frozenAction.recipient,
      value: 0n,
      data: "0x",
      chainId: baseChainId,
    },
    reason: null,
  };
}

function reject(reason: Phase8OwnerSubmitRequestFailure): Phase8OwnerSubmitRequestResult {
  return { ok: false, request: null, reason };
}
