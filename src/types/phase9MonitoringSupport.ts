export type Phase9MonitoringSupportStatus =
  | "blocked"
  | "ready_for_runtime"
  | "observable";

export type Phase9MonitoringSupportReason =
  | "incident_controls_required"
  | "runtime_disabled"
  | "netlify_health_required"
  | "supabase_health_required"
  | "edge_function_health_required"
  | "transaction_verification_health_required"
  | "public_execution_gate_health_required"
  | "owner_support_copy_required"
  | "sanitized_debug_state_required"
  | "aggregated_analytics_required"
  | "raw_wallet_internals_forbidden"
  | "telegram_token_exposure_forbidden"
  | "provider_payload_exposure_forbidden"
  | "secret_exposure_forbidden"
  | "owner_evidence_required"
  | "public_analytics_privacy_required";

export interface Phase9MonitoringSupportInput {
  incidentControlsCanProceed: boolean;
  phase9RuntimeEnabled: boolean;
  netlifyHealthReady: boolean;
  supabaseHealthReady: boolean;
  edgeFunctionHealthReady: boolean;
  transactionVerificationHealthReady: boolean;
  publicExecutionGateHealthReady: boolean;
  ownerSupportCopyReady: boolean;
  sanitizedDebugStates: boolean;
  aggregatedAnalyticsReady: boolean;
  rawWalletInternalsHidden: boolean;
  telegramTokensHidden: boolean;
  providerPayloadsHidden: boolean;
  secretsHidden: boolean;
  ownerEvidenceReady: boolean;
  publicAnalyticsPrivacyPreserving: boolean;
}

export interface Phase9MonitoringSupportItem {
  label: string;
  status: "pass" | "pending" | "blocked";
  detail: string;
}

export interface Phase9MonitoringSupportResult {
  status: Phase9MonitoringSupportStatus;
  ownerOnly: true;
  canProceedToPrivacyGate: boolean;
  publicExecutionAllowed: boolean;
  supportReady: boolean;
  monitoringReady: boolean;
  privacyPreserving: boolean;
  reasons: Phase9MonitoringSupportReason[];
  controls: Phase9MonitoringSupportItem[];
  message: string;
}

export function evaluatePhase9MonitoringSupport(
  input: Phase9MonitoringSupportInput,
): Phase9MonitoringSupportResult {
  const reasons: Phase9MonitoringSupportReason[] = [];

  if (!input.incidentControlsCanProceed) reasons.push("incident_controls_required");
  if (!input.phase9RuntimeEnabled) reasons.push("runtime_disabled");
  if (!input.netlifyHealthReady) reasons.push("netlify_health_required");
  if (!input.supabaseHealthReady) reasons.push("supabase_health_required");
  if (!input.edgeFunctionHealthReady) reasons.push("edge_function_health_required");
  if (!input.transactionVerificationHealthReady) reasons.push("transaction_verification_health_required");
  if (!input.publicExecutionGateHealthReady) reasons.push("public_execution_gate_health_required");
  if (!input.ownerSupportCopyReady) reasons.push("owner_support_copy_required");
  if (!input.sanitizedDebugStates) reasons.push("sanitized_debug_state_required");
  if (!input.aggregatedAnalyticsReady) reasons.push("aggregated_analytics_required");
  if (!input.rawWalletInternalsHidden) reasons.push("raw_wallet_internals_forbidden");
  if (!input.telegramTokensHidden) reasons.push("telegram_token_exposure_forbidden");
  if (!input.providerPayloadsHidden) reasons.push("provider_payload_exposure_forbidden");
  if (!input.secretsHidden) reasons.push("secret_exposure_forbidden");
  if (!input.ownerEvidenceReady) reasons.push("owner_evidence_required");
  if (!input.publicAnalyticsPrivacyPreserving) reasons.push("public_analytics_privacy_required");

  const uniqueReasons = [...new Set(reasons)];
  const blockingWithoutRuntime = uniqueReasons.filter((reason) => reason !== "runtime_disabled");
  const monitoringReady = input.netlifyHealthReady
    && input.supabaseHealthReady
    && input.edgeFunctionHealthReady
    && input.transactionVerificationHealthReady
    && input.publicExecutionGateHealthReady;
  const supportReady = input.ownerSupportCopyReady
    && input.sanitizedDebugStates
    && input.ownerEvidenceReady;
  const privacyPreserving = input.aggregatedAnalyticsReady
    && input.rawWalletInternalsHidden
    && input.telegramTokensHidden
    && input.providerPayloadsHidden
    && input.secretsHidden
    && input.publicAnalyticsPrivacyPreserving;

  return {
    status: resolveStatus(uniqueReasons, blockingWithoutRuntime),
    ownerOnly: true,
    canProceedToPrivacyGate: blockingWithoutRuntime.length === 0,
    publicExecutionAllowed: uniqueReasons.length === 0,
    supportReady,
    monitoringReady,
    privacyPreserving,
    reasons: uniqueReasons,
    controls: buildControls(input, monitoringReady, supportReady, privacyPreserving),
    message: getMessage(uniqueReasons, blockingWithoutRuntime),
  };
}

function resolveStatus(
  reasons: Phase9MonitoringSupportReason[],
  blockingWithoutRuntime: Phase9MonitoringSupportReason[],
): Phase9MonitoringSupportStatus {
  if (reasons.length === 0) return "observable";
  return blockingWithoutRuntime.length === 0 ? "ready_for_runtime" : "blocked";
}

function buildControls(
  input: Phase9MonitoringSupportInput,
  monitoringReady: boolean,
  supportReady: boolean,
  privacyPreserving: boolean,
): Phase9MonitoringSupportItem[] {
  return [
    {
      label: "Incident gate",
      status: input.incidentControlsCanProceed ? "pass" : "blocked",
      detail: "Incident and rollback controls must be ready first.",
    },
    {
      label: "Production health",
      status: monitoringReady ? "pass" : "blocked",
      detail: "Netlify, Supabase, Edge Functions, transaction verification, and public execution gates need owner-visible health evidence.",
    },
    {
      label: "Support copy",
      status: supportReady ? "pass" : "blocked",
      detail: "Support and debugging states must be owner-safe and sanitized.",
    },
    {
      label: "Privacy analytics",
      status: privacyPreserving ? "pass" : "blocked",
      detail: "Analytics must stay aggregated and hide wallet internals, Telegram tokens, provider payloads, and secrets.",
    },
    {
      label: "Owner evidence",
      status: input.ownerEvidenceReady ? "pass" : "blocked",
      detail: "Owner-only support evidence must exist before public execution can widen.",
    },
    {
      label: "Runtime",
      status: input.phase9RuntimeEnabled ? "pass" : "pending",
      detail: "Public execution runtime remains disabled until explicit release approval.",
    },
  ];
}

function getMessage(
  reasons: Phase9MonitoringSupportReason[],
  blockingWithoutRuntime: Phase9MonitoringSupportReason[],
) {
  if (reasons.length === 0) {
    return "Monitoring, support, and owner evidence are ready for the approved release lane.";
  }

  if (blockingWithoutRuntime.length === 0) {
    return "Monitoring and support are structurally ready, but runtime remains disabled.";
  }

  return "Monitoring and support are waiting on required safety checks.";
}