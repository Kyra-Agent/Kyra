export type Phase9PublicPrivacyReleaseStatus =
  | "blocked"
  | "ready_for_runtime"
  | "release_ready";

export type Phase9PublicPrivacyReleaseReason =
  | "monitoring_support_required"
  | "runtime_disabled"
  | "landing_audit_required"
  | "public_profile_audit_required"
  | "telegram_response_audit_required"
  | "dashboard_copy_audit_required"
  | "log_audit_required"
  | "docs_audit_required"
  | "edge_error_audit_required"
  | "wallet_address_exposure_forbidden"
  | "token_ref_exposure_forbidden"
  | "session_id_exposure_forbidden"
  | "internal_id_exposure_forbidden"
  | "provider_payload_exposure_forbidden"
  | "transaction_intent_internal_exposure_forbidden"
  | "raw_error_detail_exposure_forbidden"
  | "release_decision_required";

export interface Phase9PublicPrivacyReleaseInput {
  monitoringSupportCanProceed: boolean;
  phase9RuntimeEnabled: boolean;
  landingPageAudited: boolean;
  publicAgentProfilesAudited: boolean;
  telegramResponsesAudited: boolean;
  dashboardCopyAudited: boolean;
  logsAudited: boolean;
  docsAudited: boolean;
  edgeFunctionErrorsAudited: boolean;
  walletAddressesHiddenUnlessOwnerApproved: boolean;
  tokenRefsHidden: boolean;
  sessionIdsHidden: boolean;
  internalIdsHidden: boolean;
  providerPayloadRefsHidden: boolean;
  transactionIntentInternalsHidden: boolean;
  rawErrorDetailsHidden: boolean;
  releaseDecisionRecorded: boolean;
}

export interface Phase9PublicPrivacyReleaseItem {
  label: string;
  status: "pass" | "pending" | "blocked";
  detail: string;
}

export interface Phase9PublicPrivacyReleaseResult {
  status: Phase9PublicPrivacyReleaseStatus;
  ownerOnly: true;
  phase9CanClose: boolean;
  canProceedToPhase10: boolean;
  publicExecutionAllowed: boolean;
  surfacesAudited: boolean;
  sensitiveDataHidden: boolean;
  reasons: Phase9PublicPrivacyReleaseReason[];
  controls: Phase9PublicPrivacyReleaseItem[];
  message: string;
}

export function evaluatePhase9PublicPrivacyRelease(
  input: Phase9PublicPrivacyReleaseInput,
): Phase9PublicPrivacyReleaseResult {
  const reasons: Phase9PublicPrivacyReleaseReason[] = [];

  if (!input.monitoringSupportCanProceed) reasons.push("monitoring_support_required");
  if (!input.phase9RuntimeEnabled) reasons.push("runtime_disabled");
  if (!input.landingPageAudited) reasons.push("landing_audit_required");
  if (!input.publicAgentProfilesAudited) reasons.push("public_profile_audit_required");
  if (!input.telegramResponsesAudited) reasons.push("telegram_response_audit_required");
  if (!input.dashboardCopyAudited) reasons.push("dashboard_copy_audit_required");
  if (!input.logsAudited) reasons.push("log_audit_required");
  if (!input.docsAudited) reasons.push("docs_audit_required");
  if (!input.edgeFunctionErrorsAudited) reasons.push("edge_error_audit_required");
  if (!input.walletAddressesHiddenUnlessOwnerApproved) reasons.push("wallet_address_exposure_forbidden");
  if (!input.tokenRefsHidden) reasons.push("token_ref_exposure_forbidden");
  if (!input.sessionIdsHidden) reasons.push("session_id_exposure_forbidden");
  if (!input.internalIdsHidden) reasons.push("internal_id_exposure_forbidden");
  if (!input.providerPayloadRefsHidden) reasons.push("provider_payload_exposure_forbidden");
  if (!input.transactionIntentInternalsHidden) reasons.push("transaction_intent_internal_exposure_forbidden");
  if (!input.rawErrorDetailsHidden) reasons.push("raw_error_detail_exposure_forbidden");
  if (!input.releaseDecisionRecorded) reasons.push("release_decision_required");

  const uniqueReasons = [...new Set(reasons)];
  const blockingWithoutRuntime = uniqueReasons.filter((reason) => reason !== "runtime_disabled");
  const surfacesAudited = input.landingPageAudited
    && input.publicAgentProfilesAudited
    && input.telegramResponsesAudited
    && input.dashboardCopyAudited
    && input.logsAudited
    && input.docsAudited
    && input.edgeFunctionErrorsAudited;
  const sensitiveDataHidden = input.walletAddressesHiddenUnlessOwnerApproved
    && input.tokenRefsHidden
    && input.sessionIdsHidden
    && input.internalIdsHidden
    && input.providerPayloadRefsHidden
    && input.transactionIntentInternalsHidden
    && input.rawErrorDetailsHidden;

  return {
    status: resolveStatus(uniqueReasons, blockingWithoutRuntime),
    ownerOnly: true,
    phase9CanClose: blockingWithoutRuntime.length === 0,
    canProceedToPhase10: blockingWithoutRuntime.length === 0,
    publicExecutionAllowed: uniqueReasons.length === 0,
    surfacesAudited,
    sensitiveDataHidden,
    reasons: uniqueReasons,
    controls: buildControls(input, surfacesAudited, sensitiveDataHidden),
    message: getMessage(uniqueReasons, blockingWithoutRuntime),
  };
}

function resolveStatus(
  reasons: Phase9PublicPrivacyReleaseReason[],
  blockingWithoutRuntime: Phase9PublicPrivacyReleaseReason[],
): Phase9PublicPrivacyReleaseStatus {
  if (reasons.length === 0) return "release_ready";
  return blockingWithoutRuntime.length === 0 ? "ready_for_runtime" : "blocked";
}

function buildControls(
  input: Phase9PublicPrivacyReleaseInput,
  surfacesAudited: boolean,
  sensitiveDataHidden: boolean,
): Phase9PublicPrivacyReleaseItem[] {
  return [
    {
      label: "Monitoring gate",
      status: input.monitoringSupportCanProceed ? "pass" : "blocked",
      detail: "Monitoring, support, and owner evidence must be ready first.",
    },
    {
      label: "Public surfaces",
      status: surfacesAudited ? "pass" : "blocked",
      detail: "Landing, public profiles, Telegram, dashboard copy, logs, docs, and Edge errors must be audited.",
    },
    {
      label: "Sensitive data",
      status: sensitiveDataHidden ? "pass" : "blocked",
      detail: "Wallet addresses, token refs, session ids, internal ids, provider payload refs, intent internals, and raw errors must stay hidden.",
    },
    {
      label: "Release decision",
      status: input.releaseDecisionRecorded ? "pass" : "blocked",
      detail: "A recorded release decision is required before final readiness starts.",
    },
    {
      label: "Runtime",
      status: input.phase9RuntimeEnabled ? "pass" : "pending",
      detail: "Public execution runtime remains disabled until explicit release approval.",
    },
  ];
}

function getMessage(
  reasons: Phase9PublicPrivacyReleaseReason[],
  blockingWithoutRuntime: Phase9PublicPrivacyReleaseReason[],
) {
  if (reasons.length === 0) {
    return "Public privacy and release review is ready for the approved release lane.";
  }

  if (blockingWithoutRuntime.length === 0) {
    return "Public privacy review can close structurally, but runtime remains disabled.";
  }

  return "Public privacy review is waiting on required safety checks.";
}