export type Phase9CloseoutStatus = "blocked" | "structurally_complete";

export type Phase9CloseoutReason =
  | "execution_eligibility_required"
  | "abuse_rate_limit_required"
  | "incident_controls_required"
  | "monitoring_support_required"
  | "public_privacy_release_required"
  | "phase10_readiness_required";

export interface Phase9CloseoutInput {
  executionEligibilityReady: boolean;
  abuseRateLimitReady: boolean;
  incidentControlsReady: boolean;
  monitoringSupportReady: boolean;
  publicPrivacyReleaseReady: boolean;
  phase10ReadinessStarted: boolean;
}

export interface Phase9CloseoutItem {
  label: string;
  status: "pass" | "pending" | "blocked";
  detail: string;
}

export interface Phase9CloseoutResult {
  status: Phase9CloseoutStatus;
  ownerOnly: true;
  phase9StructurallyComplete: boolean;
  canProceedToPhase10: boolean;
  publicExecutionRuntimeEnabled: false;
  reasons: Phase9CloseoutReason[];
  controls: Phase9CloseoutItem[];
  message: string;
}

export function evaluatePhase9Closeout(input: Phase9CloseoutInput): Phase9CloseoutResult {
  const reasons: Phase9CloseoutReason[] = [];

  if (!input.executionEligibilityReady) reasons.push("execution_eligibility_required");
  if (!input.abuseRateLimitReady) reasons.push("abuse_rate_limit_required");
  if (!input.incidentControlsReady) reasons.push("incident_controls_required");
  if (!input.monitoringSupportReady) reasons.push("monitoring_support_required");
  if (!input.publicPrivacyReleaseReady) reasons.push("public_privacy_release_required");
  if (!input.phase10ReadinessStarted) reasons.push("phase10_readiness_required");

  const blockingReasons = reasons.filter((reason) => reason !== "phase10_readiness_required");
  const phase9StructurallyComplete = blockingReasons.length === 0;

  return {
    status: phase9StructurallyComplete ? "structurally_complete" : "blocked",
    ownerOnly: true,
    phase9StructurallyComplete,
    canProceedToPhase10: phase9StructurallyComplete,
    publicExecutionRuntimeEnabled: false,
    reasons,
    controls: buildControls(input),
    message: getMessage(phase9StructurallyComplete, reasons),
  };
}

function buildControls(input: Phase9CloseoutInput): Phase9CloseoutItem[] {
  return [
    {
      label: "9A eligibility",
      status: input.executionEligibilityReady ? "pass" : "blocked",
      detail: "Execution eligibility hardening must be clean.",
    },
    {
      label: "9B abuse limits",
      status: input.abuseRateLimitReady ? "pass" : "blocked",
      detail: "Rate limit, replay, duplicate-submit, and value controls must be clean.",
    },
    {
      label: "9C incidents",
      status: input.incidentControlsReady ? "pass" : "blocked",
      detail: "Incident, rollback, emergency disable, and failure handling must be clean.",
    },
    {
      label: "9D monitoring",
      status: input.monitoringSupportReady ? "pass" : "blocked",
      detail: "Monitoring, support copy, owner evidence, and privacy analytics must be clean.",
    },
    {
      label: "9E privacy",
      status: input.publicPrivacyReleaseReady ? "pass" : "blocked",
      detail: "Public surface audit and sensitive-data hiding must be clean.",
    },
    {
      label: "Phase 10",
      status: input.phase10ReadinessStarted ? "pass" : "pending",
      detail: "Phase 10 owns final launch QA, production runbook, and release decision.",
    },
    {
      label: "Runtime",
      status: "pending",
      detail: "Public execution runtime remains disabled until explicit Phase 10 release approval.",
    },
  ];
}

function getMessage(phase9StructurallyComplete: boolean, reasons: Phase9CloseoutReason[]) {
  if (phase9StructurallyComplete) {
    return "Phase 9 public execution hardening is structurally complete; Phase 10 release readiness can start while runtime remains disabled.";
  }

  return `Phase 9 closeout is blocked by ${reasons[0]}.`;
}