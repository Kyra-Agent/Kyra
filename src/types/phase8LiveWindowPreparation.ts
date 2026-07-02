import type { FrozenPreparedAction } from "./dualApprovalExecution";
import { baseChainId } from "./unsignedTransactionHandoff";

export type Phase8LiveWindowStatus =
  | "not_requested"
  | "approved"
  | "expired"
  | "revoked";

export type Phase8BaseAccountPromptReadiness =
  | "not_ready"
  | "ready"
  | "opened"
  | "approved"
  | "rejected"
  | "failed";

export type Phase8ExecuteIntentSource =
  | "private_dashboard"
  | "telegram"
  | "public_profile"
  | "automation";

export type Phase8LiveWindowPreparationStatus =
  | "blocked"
  | "ready_for_wallet_prompt"
  | "wallet_prompt_opened"
  | "wallet_prompt_approved"
  | "closed";

export type Phase8LiveWindowPreparationBlockReason =
  | "owner_session_required"
  | "owner_match_required"
  | "workspace_match_required"
  | "selected_agent_required"
  | "selected_agent_match_required"
  | "base_chain_required"
  | "base_account_required"
  | "live_window_approval_required"
  | "live_window_owner_mismatch"
  | "live_window_workspace_mismatch"
  | "live_window_agent_mismatch"
  | "live_window_expired"
  | "live_window_revoked"
  | "private_dashboard_intent_required"
  | "owner_click_required"
  | "frozen_action_required"
  | "frozen_action_owner_mismatch"
  | "frozen_action_workspace_mismatch"
  | "frozen_action_agent_mismatch"
  | "zero_value_action_required"
  | "no_calldata_required"
  | "base_account_prompt_ready_required"
  | "telegram_authority_forbidden"
  | "public_visibility_forbidden";

export interface Phase8LiveWindowApproval {
  status: Phase8LiveWindowStatus;
  approvedByUserId: string | null;
  workspaceId: string | null;
  agentId: string | null;
  approvedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
}

export interface Phase8ExecuteIntent {
  source: Phase8ExecuteIntentSource;
  ownerClickedExecute: boolean;
  ownerUserId: string | null;
  workspaceId: string | null;
  agentId: string | null;
  requestedAt: string | null;
}

export interface Phase8LiveWindowPreparationInput {
  ownerUserId: string;
  sessionUserId: string;
  workspaceId: string;
  selectedWorkspaceId: string;
  selectedAgentId: string;
  chainId: number | null;
  baseAccountConnected: boolean;
  liveWindow: Phase8LiveWindowApproval;
  executeIntent: Phase8ExecuteIntent;
  frozenAction: FrozenPreparedAction | null;
  baseAccountPromptReadiness: Phase8BaseAccountPromptReadiness;
  nowIso: string;
  visibleInPublicProfile: boolean;
}

export interface Phase8LiveWindowPreparationResult {
  status: Phase8LiveWindowPreparationStatus;
  ownerOnly: true;
  walletPromptAllowed: boolean;
  transactionSubmissionAllowed: false;
  reasons: Phase8LiveWindowPreparationBlockReason[];
  message: string;
}

const blockMessages: Record<Phase8LiveWindowPreparationBlockReason, string> = {
  owner_session_required: "Owner session is required before Phase 8 live-window preparation.",
  owner_match_required: "The active owner session must match the Phase 8 owner.",
  workspace_match_required: "The selected workspace must match the owner-approved live window.",
  selected_agent_required: "Select one deployed agent before preparing Phase 8 execution.",
  selected_agent_match_required: "The selected agent must match the owner-approved live window.",
  base_chain_required: "Phase 8 Batch 2 only allows Base mainnet readiness.",
  base_account_required: "Connect the owner's Base Account before preparing the wallet prompt.",
  live_window_approval_required: "An explicit owner-approved live window is required.",
  live_window_owner_mismatch: "The live window must be approved by the same owner session.",
  live_window_workspace_mismatch: "The live window workspace does not match the selected workspace.",
  live_window_agent_mismatch: "The live window agent does not match the selected agent.",
  live_window_expired: "The owner-approved live window has expired.",
  live_window_revoked: "The owner-approved live window was revoked.",
  private_dashboard_intent_required: "Execution intent must come from the private owner dashboard.",
  owner_click_required: "The owner must explicitly click execute for this live window.",
  frozen_action_required: "A frozen reviewed prepared action is required.",
  frozen_action_owner_mismatch: "The frozen action owner does not match the active owner.",
  frozen_action_workspace_mismatch: "The frozen action workspace does not match the selected workspace.",
  frozen_action_agent_mismatch: "The frozen action agent does not match the selected agent.",
  zero_value_action_required: "Batch 2 only prepares a zero-value first transaction.",
  no_calldata_required: "Batch 2 only prepares a no-calldata first transaction.",
  base_account_prompt_ready_required: "Base Account prompt readiness must be ready, opened, or approved.",
  telegram_authority_forbidden: "Telegram cannot request or authorize Phase 8 execution.",
  public_visibility_forbidden: "Public profiles cannot expose or trigger Phase 8 execution state.",
};

function isExpired(expiresAt: string | null, nowIso: string) {
  if (!expiresAt) {
    return true;
  }

  const expires = Date.parse(expiresAt);
  const now = Date.parse(nowIso);

  return !Number.isFinite(expires) || !Number.isFinite(now) || expires <= now;
}

export function evaluatePhase8LiveWindowPreparation(
  input: Phase8LiveWindowPreparationInput,
): Phase8LiveWindowPreparationResult {
  const reasons: Phase8LiveWindowPreparationBlockReason[] = [];

  if (!input.ownerUserId || !input.sessionUserId) {
    reasons.push("owner_session_required");
  }

  if (input.ownerUserId !== input.sessionUserId) {
    reasons.push("owner_match_required");
  }

  if (!input.workspaceId || input.workspaceId !== input.selectedWorkspaceId) {
    reasons.push("workspace_match_required");
  }

  if (!input.selectedAgentId) {
    reasons.push("selected_agent_required");
  }

  if (input.chainId !== baseChainId) {
    reasons.push("base_chain_required");
  }

  if (!input.baseAccountConnected) {
    reasons.push("base_account_required");
  }

  if (input.liveWindow.status !== "approved") {
    reasons.push(
      input.liveWindow.status === "expired"
        ? "live_window_expired"
        : input.liveWindow.status === "revoked"
        ? "live_window_revoked"
        : "live_window_approval_required",
    );
  }

  if (input.liveWindow.approvedByUserId !== input.ownerUserId) {
    reasons.push("live_window_owner_mismatch");
  }

  if (input.liveWindow.workspaceId !== input.workspaceId) {
    reasons.push("live_window_workspace_mismatch");
  }

  if (input.liveWindow.agentId !== input.selectedAgentId) {
    reasons.push("live_window_agent_mismatch");
  }

  if (input.liveWindow.status === "approved" && isExpired(input.liveWindow.expiresAt, input.nowIso)) {
    reasons.push("live_window_expired");
  }

  if (input.liveWindow.revokedAt) {
    reasons.push("live_window_revoked");
  }

  if (input.executeIntent.source !== "private_dashboard") {
    reasons.push(
      input.executeIntent.source === "telegram"
        ? "telegram_authority_forbidden"
        : input.executeIntent.source === "public_profile"
        ? "public_visibility_forbidden"
        : "private_dashboard_intent_required",
    );
  }

  if (!input.executeIntent.ownerClickedExecute) {
    reasons.push("owner_click_required");
  }

  if (input.executeIntent.ownerUserId !== input.ownerUserId) {
    reasons.push("owner_match_required");
  }

  if (input.executeIntent.workspaceId !== input.workspaceId) {
    reasons.push("workspace_match_required");
  }

  if (input.executeIntent.agentId !== input.selectedAgentId) {
    reasons.push("selected_agent_match_required");
  }

  if (!input.frozenAction) {
    reasons.push("frozen_action_required");
  }

  if (input.frozenAction && input.frozenAction.ownerUserId !== input.ownerUserId) {
    reasons.push("frozen_action_owner_mismatch");
  }

  if (input.frozenAction && input.frozenAction.workspaceId !== input.workspaceId) {
    reasons.push("frozen_action_workspace_mismatch");
  }

  if (input.frozenAction && input.frozenAction.agentId !== input.selectedAgentId) {
    reasons.push("frozen_action_agent_mismatch");
  }

  if (input.frozenAction && input.frozenAction.valueWei !== "0") {
    reasons.push("zero_value_action_required");
  }

  if (input.frozenAction && input.frozenAction.data !== "0x") {
    reasons.push("no_calldata_required");
  }

  if (
    input.baseAccountPromptReadiness === "not_ready" ||
    input.baseAccountPromptReadiness === "rejected" ||
    input.baseAccountPromptReadiness === "failed"
  ) {
    reasons.push("base_account_prompt_ready_required");
  }

  if (input.visibleInPublicProfile) {
    reasons.push("public_visibility_forbidden");
  }

  const uniqueReasons = [...new Set(reasons)];

  if (uniqueReasons.length > 0) {
    return {
      status: "blocked",
      ownerOnly: true,
      walletPromptAllowed: false,
      transactionSubmissionAllowed: false,
      reasons: uniqueReasons,
      message: blockMessages[uniqueReasons[0]],
    };
  }

  if (input.baseAccountPromptReadiness === "approved") {
    return {
      status: "wallet_prompt_approved",
      ownerOnly: true,
      walletPromptAllowed: true,
      transactionSubmissionAllowed: false,
      reasons: [],
      message: "Base Account approval readiness is recorded. Batch 2 still does not submit transactions.",
    };
  }

  if (input.baseAccountPromptReadiness === "opened") {
    return {
      status: "wallet_prompt_opened",
      ownerOnly: true,
      walletPromptAllowed: true,
      transactionSubmissionAllowed: false,
      reasons: [],
      message: "Wallet prompt readiness is open and owner-only. Submission remains disabled in Batch 2.",
    };
  }

  return {
    status: "ready_for_wallet_prompt",
    ownerOnly: true,
    walletPromptAllowed: true,
    transactionSubmissionAllowed: false,
    reasons: [],
    message: "Phase 8 live window is prepared for an explicit owner Base Account prompt.",
  };
}

export function getPhase8LiveWindowPreparationBlockMessage(
  reason: Phase8LiveWindowPreparationBlockReason,
) {
  return blockMessages[reason];
}