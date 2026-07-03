import type { FrozenPreparedAction } from "./dualApprovalExecution";
import type {
  Phase8ExecuteIntentSource,
  Phase8LiveWindowPreparationResult,
} from "./phase8LiveWindowPreparation";

export type Phase8WalletPromptOpeningStatus =
  | "blocked"
  | "ready_to_open_prompt"
  | "prompt_opened"
  | "prompt_approved"
  | "prompt_rejected"
  | "prompt_failed";

export type Phase8WalletPromptState =
  | "not_requested"
  | "ready"
  | "opened"
  | "approved"
  | "rejected"
  | "failed";

export type Phase8WalletPromptOpeningBlockReason =
  | "live_window_not_ready"
  | "private_dashboard_source_required"
  | "owner_click_required"
  | "owner_match_required"
  | "workspace_match_required"
  | "selected_agent_match_required"
  | "frozen_action_required"
  | "frozen_action_binding_required"
  | "one_time_prompt_nonce_required"
  | "one_time_prompt_nonce_unused_required"
  | "prompt_state_ready_required"
  | "owner_only_audit_required"
  | "sanitized_audit_required"
  | "telegram_authority_forbidden"
  | "public_visibility_forbidden";

export interface Phase8WalletPromptIntent {
  source: Phase8ExecuteIntentSource;
  ownerClickedOpenPrompt: boolean;
  ownerUserId: string | null;
  workspaceId: string | null;
  agentId: string | null;
  frozenActionFreezeKey: string | null;
  promptNonce: string | null;
  promptNonceUsed: boolean;
  requestedAt: string | null;
}

export interface Phase8WalletPromptAuditEvent {
  type:
    | "prompt_ready"
    | "prompt_opened"
    | "prompt_approved"
    | "prompt_rejected"
    | "prompt_failed";
  ownerOnly: boolean;
  sanitized: boolean;
  message: string;
  createdAt: string;
}

export interface Phase8WalletPromptOpeningInput {
  liveWindowPreparation: Phase8LiveWindowPreparationResult;
  ownerUserId: string;
  workspaceId: string;
  selectedAgentId: string;
  frozenAction: FrozenPreparedAction | null;
  promptIntent: Phase8WalletPromptIntent;
  promptState: Phase8WalletPromptState;
  auditEvents: Phase8WalletPromptAuditEvent[];
  visibleInPublicProfile: boolean;
}

export interface Phase8WalletPromptOpeningResult {
  status: Phase8WalletPromptOpeningStatus;
  ownerOnly: true;
  walletPromptOpenAllowed: boolean;
  walletApprovalRecorded: boolean;
  transactionSubmissionAllowed: false;
  reasons: Phase8WalletPromptOpeningBlockReason[];
  message: string;
}

const blockMessages: Record<Phase8WalletPromptOpeningBlockReason, string> = {
  live_window_not_ready: "Phase 8 live window preparation must be ready before opening a wallet prompt.",
  private_dashboard_source_required: "Wallet prompt opening must originate from the private owner dashboard.",
  owner_click_required: "Wallet prompt opening requires an explicit owner click.",
  owner_match_required: "Wallet prompt owner must match the active owner session.",
  workspace_match_required: "Wallet prompt workspace must match the selected workspace.",
  selected_agent_match_required: "Wallet prompt agent must match the selected agent.",
  frozen_action_required: "Wallet prompt opening requires a frozen prepared action.",
  frozen_action_binding_required: "Wallet prompt nonce must bind to the frozen prepared action.",
  one_time_prompt_nonce_required: "A one-time wallet prompt nonce is required.",
  one_time_prompt_nonce_unused_required: "A wallet prompt nonce can only be used once.",
  prompt_state_ready_required: "Wallet prompt state must be ready, opened, approved, rejected, or failed.",
  owner_only_audit_required: "Wallet prompt opening requires owner-only audit evidence.",
  sanitized_audit_required: "Wallet prompt audit events must be sanitized.",
  telegram_authority_forbidden: "Telegram cannot open or authorize a wallet prompt.",
  public_visibility_forbidden: "Public profiles cannot open or expose wallet prompt state.",
};

function needsAuditForState(state: Phase8WalletPromptState) {
  return state === "opened" || state === "approved" || state === "rejected" || state === "failed";
}

function expectedAuditType(state: Phase8WalletPromptState): Phase8WalletPromptAuditEvent["type"] | null {
  if (state === "opened") {
    return "prompt_opened";
  }

  if (state === "approved") {
    return "prompt_approved";
  }

  if (state === "rejected") {
    return "prompt_rejected";
  }

  if (state === "failed") {
    return "prompt_failed";
  }

  return null;
}

export function evaluatePhase8WalletPromptOpening(
  input: Phase8WalletPromptOpeningInput,
): Phase8WalletPromptOpeningResult {
  const reasons: Phase8WalletPromptOpeningBlockReason[] = [];

  if (
    !input.liveWindowPreparation.walletPromptAllowed ||
    input.liveWindowPreparation.transactionSubmissionAllowed ||
    input.liveWindowPreparation.reasons.length > 0 ||
    (input.liveWindowPreparation.status !== "ready_for_wallet_prompt" &&
      input.liveWindowPreparation.status !== "wallet_prompt_opened" &&
      input.liveWindowPreparation.status !== "wallet_prompt_approved")
  ) {
    reasons.push("live_window_not_ready");
  }

  if (input.promptIntent.source !== "private_dashboard") {
    reasons.push(
      input.promptIntent.source === "telegram"
        ? "telegram_authority_forbidden"
        : input.promptIntent.source === "public_profile"
        ? "public_visibility_forbidden"
        : "private_dashboard_source_required",
    );
  }

  if (!input.promptIntent.ownerClickedOpenPrompt) {
    reasons.push("owner_click_required");
  }

  if (input.promptIntent.ownerUserId !== input.ownerUserId) {
    reasons.push("owner_match_required");
  }

  if (input.promptIntent.workspaceId !== input.workspaceId) {
    reasons.push("workspace_match_required");
  }

  if (input.promptIntent.agentId !== input.selectedAgentId) {
    reasons.push("selected_agent_match_required");
  }

  if (!input.frozenAction) {
    reasons.push("frozen_action_required");
  }

  if (
    input.frozenAction &&
    input.promptIntent.frozenActionFreezeKey !== input.frozenAction.freezeKey
  ) {
    reasons.push("frozen_action_binding_required");
  }

  if (!input.promptIntent.promptNonce) {
    reasons.push("one_time_prompt_nonce_required");
  }

  if (input.promptIntent.promptNonceUsed) {
    reasons.push("one_time_prompt_nonce_unused_required");
  }

  if (input.promptState === "not_requested") {
    reasons.push("prompt_state_ready_required");
  }

  const auditType = expectedAuditType(input.promptState);
  if (needsAuditForState(input.promptState)) {
    const matchingAudit = input.auditEvents.find((event) => event.type === auditType);

    if (!matchingAudit || !matchingAudit.ownerOnly) {
      reasons.push("owner_only_audit_required");
    }

    if (!matchingAudit || !matchingAudit.sanitized) {
      reasons.push("sanitized_audit_required");
    }
  }

  if (input.auditEvents.some((event) => !event.ownerOnly)) {
    reasons.push("owner_only_audit_required");
  }

  if (input.auditEvents.some((event) => !event.sanitized)) {
    reasons.push("sanitized_audit_required");
  }

  if (input.visibleInPublicProfile) {
    reasons.push("public_visibility_forbidden");
  }

  const uniqueReasons = [...new Set(reasons)];

  if (uniqueReasons.length > 0) {
    return {
      status: "blocked",
      ownerOnly: true,
      walletPromptOpenAllowed: false,
      walletApprovalRecorded: false,
      transactionSubmissionAllowed: false,
      reasons: uniqueReasons,
      message: blockMessages[uniqueReasons[0]],
    };
  }

  if (input.promptState === "approved") {
    return {
      status: "prompt_approved",
      ownerOnly: true,
      walletPromptOpenAllowed: false,
      walletApprovalRecorded: true,
      transactionSubmissionAllowed: false,
      reasons: [],
      message: "Wallet prompt approval was recorded owner-only. Batch 3 still does not submit transactions.",
    };
  }

  if (input.promptState === "rejected") {
    return {
      status: "prompt_rejected",
      ownerOnly: true,
      walletPromptOpenAllowed: false,
      walletApprovalRecorded: false,
      transactionSubmissionAllowed: false,
      reasons: [],
      message: "Wallet prompt was rejected and closed without transaction submission.",
    };
  }

  if (input.promptState === "failed") {
    return {
      status: "prompt_failed",
      ownerOnly: true,
      walletPromptOpenAllowed: false,
      walletApprovalRecorded: false,
      transactionSubmissionAllowed: false,
      reasons: [],
      message: "Wallet prompt failed safely without transaction submission.",
    };
  }

  if (input.promptState === "opened") {
    return {
      status: "prompt_opened",
      ownerOnly: true,
      walletPromptOpenAllowed: false,
      walletApprovalRecorded: false,
      transactionSubmissionAllowed: false,
      reasons: [],
      message: "Wallet prompt is open under owner-only audit. Transaction submission remains disabled.",
    };
  }

  return {
    status: "ready_to_open_prompt",
    ownerOnly: true,
    walletPromptOpenAllowed: true,
    walletApprovalRecorded: false,
    transactionSubmissionAllowed: false,
    reasons: [],
    message: "Phase 8 Batch 3 is ready to open one owner-click Base Account prompt.",
  };
}

export function getPhase8WalletPromptOpeningBlockMessage(
  reason: Phase8WalletPromptOpeningBlockReason,
) {
  return blockMessages[reason];
}