import type { Phase8ControlledSubmissionResult } from "./phase8ControlledSubmission";
import type { Phase8OwnerLiveWindowActivationResult } from "./phase8OwnerLiveWindowActivation";

export type Phase8RuntimeEnablementPreflightStatus = "locked" | "ready";

export type Phase8RuntimeEnablementPreflightBlockReason =
  | "runtime_flag_required"
  | "owner_session_required"
  | "selected_agent_required"
  | "owner_wallet_required"
  | "controlled_submission_required"
  | "live_window_activation_required"
  | "result_already_recorded"
  | "private_dashboard_required"
  | "telegram_authority_forbidden"
  | "public_visibility_forbidden";

export interface Phase8RuntimeEnablementPreflightInput {
  runtimeFlagEnabled: boolean;
  ownerSignedIn: boolean;
  selectedAgent: boolean;
  ownerWalletConnected: boolean;
  controlledSubmission: Phase8ControlledSubmissionResult;
  liveWindowActivation: Phase8OwnerLiveWindowActivationResult;
  resultCloseoutRecorded: boolean;
  privateDashboardSource: boolean;
  telegramCanAuthorize: boolean;
  visibleInPublicProfile: boolean;
}

export interface Phase8RuntimeEnablementPreflightResult {
  status: Phase8RuntimeEnablementPreflightStatus;
  ownerOnly: true;
  ownerWalletPrimaryLane: true;
  runtimeSubmitterEnabled: boolean;
  reasons: Phase8RuntimeEnablementPreflightBlockReason[];
  message: string;
}

const blockMessages: Record<Phase8RuntimeEnablementPreflightBlockReason, string> = {
  runtime_flag_required:
    "Controlled submission must be explicitly enabled for the owner window.",
  owner_session_required:
    "The signed-in owner session is required before runtime submission can open.",
  selected_agent_required:
    "Select one deployed agent before runtime submission can open.",
  owner_wallet_required:
    "Connect the owner wallet before runtime submission can open.",
  controlled_submission_required:
    "Controlled submission must be ready before runtime submission can open.",
  live_window_activation_required:
    "Owner live-window activation must be ready before runtime submission can open.",
  result_already_recorded:
    "Runtime submission is locked after an owner-only result has already been recorded.",
  private_dashboard_required:
    "Runtime submission can open only from the private owner dashboard.",
  telegram_authority_forbidden:
    "Telegram cannot authorize or open runtime submission.",
  public_visibility_forbidden:
    "Public profiles cannot expose or open runtime submission.",
};

export function evaluatePhase8RuntimeEnablementPreflight(
  input: Phase8RuntimeEnablementPreflightInput,
): Phase8RuntimeEnablementPreflightResult {
  const reasons: Phase8RuntimeEnablementPreflightBlockReason[] = [];

  if (!input.runtimeFlagEnabled) {
    reasons.push("runtime_flag_required");
  }

  if (!input.ownerSignedIn) {
    reasons.push("owner_session_required");
  }

  if (!input.selectedAgent) {
    reasons.push("selected_agent_required");
  }

  if (!input.ownerWalletConnected) {
    reasons.push("owner_wallet_required");
  }

  if (
    input.controlledSubmission.status !== "ready_to_submit" ||
    !input.controlledSubmission.transactionSubmissionAllowed ||
    input.controlledSubmission.reasons.length > 0
  ) {
    reasons.push("controlled_submission_required");
  }

  if (
    input.liveWindowActivation.status !== "ready" ||
    !input.liveWindowActivation.transactionSubmissionAllowed ||
    input.liveWindowActivation.reasons.length > 0
  ) {
    reasons.push("live_window_activation_required");
  }

  if (input.resultCloseoutRecorded || input.controlledSubmission.resultCloseoutRecorded) {
    reasons.push("result_already_recorded");
  }

  if (!input.privateDashboardSource) {
    reasons.push("private_dashboard_required");
  }

  if (input.telegramCanAuthorize) {
    reasons.push("telegram_authority_forbidden");
  }

  if (input.visibleInPublicProfile) {
    reasons.push("public_visibility_forbidden");
  }

  const uniqueReasons = [...new Set(reasons)];

  if (uniqueReasons.length > 0) {
    return {
      status: "locked",
      ownerOnly: true,
      ownerWalletPrimaryLane: true,
      runtimeSubmitterEnabled: false,
      reasons: uniqueReasons,
      message: blockMessages[uniqueReasons[0]],
    };
  }

  return {
    status: "ready",
    ownerOnly: true,
    ownerWalletPrimaryLane: true,
    runtimeSubmitterEnabled: true,
    reasons: [],
    message:
      "Gas readiness is complete for one owner-controlled network submission.",
  };
}

export function getPhase8RuntimeEnablementPreflightBlockMessage(
  reason: Phase8RuntimeEnablementPreflightBlockReason,
) {
  return blockMessages[reason];
}
