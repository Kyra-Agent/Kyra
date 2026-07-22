
import { baseChainId, isEvmAddress, isHexData } from "./unsignedTransactionHandoff";

export type Phase8LowValueSubmitRequestFailure =
  | "owner_scope_required"
  | "private_dashboard_required"
  | "base_account_required"
  | "base_chain_required"
  | "prepared_action_required"
  | "owner_approval_required"
  | "recipient_required"
  | "value_required"
  | "value_cap_exceeded"
  | "no_calldata_required"
  | "token_approval_forbidden"
  | "swap_forbidden"
  | "telegram_forbidden"
  | "public_profile_forbidden";

export interface Phase8LowValueSubmitRequestInput {
  ownerUserId: string | null | undefined;
  workspaceId: string | null | undefined;
  agentId: string | null | undefined;
  privateDashboard: boolean;
  baseAccountConnected: boolean;
  chainId: number | null | undefined;
  preparedActionId: string | null | undefined;
  ownerApprovalRecorded: boolean;
  recipient: string | null | undefined;
  valueWei: string | null | undefined;
  data: string | null | undefined;
  includesTokenApproval: boolean;
  includesSwap: boolean;
  requestedFromTelegram: boolean;
  visibleInPublicProfile: boolean;
}

export interface Phase8LowValueSubmitRequest {
  to: `0x${string}`;
  value: bigint;
  data: "0x";
  chainId: typeof baseChainId;
  maxValueWei: "100000000000000";
  ownerOnly: true;
}

export type Phase8LowValueSubmitRequestResult =
  | {
      ok: true;
      request: Phase8LowValueSubmitRequest;
      reasons: [];
      message: string;
    }
  | {
      ok: false;
      request: null;
      reasons: Phase8LowValueSubmitRequestFailure[];
      message: string;
    };

const maxLowValueWei = 100_000_000_000_000n;

const failureMessages: Record<Phase8LowValueSubmitRequestFailure, string> = {
  owner_scope_required:
    "Low-value submit request requires owner, workspace, and selected agent scope.",
  private_dashboard_required:
    "Low-value submit request can only be created from the private owner dashboard.",
  base_account_required:
    "Low-value submit request requires a connected owner wallet.",
  base_chain_required:
    "Low-value submit request is restricted to the selected runtime network.",
  prepared_action_required:
    "Low-value submit request requires a reviewed prepared action.",
  owner_approval_required:
    "Low-value submit request requires explicit owner approval.",
  recipient_required:
    "Low-value submit request requires a valid EVM recipient.",
  value_required:
    "Low-value submit request requires a positive value.",
  value_cap_exceeded:
    "Low-value submit request exceeds the Phase 8 cap.",
  no_calldata_required:
    "Low-value submit request does not allow calldata.",
  token_approval_forbidden:
    "Low-value submit request cannot include token approvals.",
  swap_forbidden:
    "Low-value submit request cannot include swaps.",
  telegram_forbidden:
    "Telegram cannot request, approve, or create low-value submit requests.",
  public_profile_forbidden:
    "Public profiles cannot expose or create low-value submit requests.",
};

export function createPhase8LowValueSubmitRequest(
  input: Phase8LowValueSubmitRequestInput,
): Phase8LowValueSubmitRequestResult {
  const reasons: Phase8LowValueSubmitRequestFailure[] = [];
  const value = parsePositiveWei(input.valueWei);

  if (!input.ownerUserId?.trim() || !input.workspaceId?.trim() || !input.agentId?.trim()) {
    reasons.push("owner_scope_required");
  }
  if (!input.privateDashboard) reasons.push("private_dashboard_required");
  if (!input.baseAccountConnected) reasons.push("base_account_required");
  if (input.chainId !== baseChainId) reasons.push("base_chain_required");
  if (!input.preparedActionId?.trim()) reasons.push("prepared_action_required");
  if (!input.ownerApprovalRecorded) reasons.push("owner_approval_required");
  if (!isEvmAddress(input.recipient)) reasons.push("recipient_required");
  if (value === null) reasons.push("value_required");
  if (value !== null && value > maxLowValueWei) reasons.push("value_cap_exceeded");
  if (input.data !== "0x" || !isHexData(input.data)) reasons.push("no_calldata_required");
  if (input.includesTokenApproval) reasons.push("token_approval_forbidden");
  if (input.includesSwap) reasons.push("swap_forbidden");
  if (input.requestedFromTelegram) reasons.push("telegram_forbidden");
  if (input.visibleInPublicProfile) reasons.push("public_profile_forbidden");

  const uniqueReasons = [...new Set(reasons)];

  if (uniqueReasons.length || value === null || !isEvmAddress(input.recipient)) {
    return {
      ok: false,
      request: null,
      reasons: uniqueReasons,
      message: failureMessages[uniqueReasons[0] ?? "value_required"],
    };
  }

  return {
    ok: true,
    request: {
      to: input.recipient,
      value,
      data: "0x",
      chainId: baseChainId,
      maxValueWei: "100000000000000",
      ownerOnly: true,
    },
    reasons: [],
    message:
      "Low-value submit request skeleton is ready for owner-controlled review. Execution remains separately gated.",
  };
}

export function getPhase8LowValueSubmitRequestFailureMessage(
  reason: Phase8LowValueSubmitRequestFailure,
) {
  return failureMessages[reason];
}

function parsePositiveWei(value: string | null | undefined) {
  if (!value || !/^\d+$/u.test(value)) return null;

  try {
    const parsed = BigInt(value);
    return parsed > 0n ? parsed : null;
  } catch {
    return null;
  }
}
