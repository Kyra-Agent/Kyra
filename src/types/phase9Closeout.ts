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
      label: "Execution safety",
      status: input.executionEligibilityReady ? "pass" : "blocked",
      detail: "Execution safety review must be complete before public access expands.",
    },
    {
      label: "Abuse controls",
      status: input.abuseRateLimitReady ? "pass" : "blocked",
      detail: "Rate limits, replay protection, duplicate-submit checks, and value caps must be ready.",
    },
    {
      label: "Incident controls",
      status: input.incidentControlsReady ? "pass" : "blocked",
      detail: "Incident, rollback, emergency disable, and failure handling must be ready.",
    },
    {
      label: "Support monitoring",
      status: input.monitoringSupportReady ? "pass" : "blocked",
      detail: "Monitoring, support copy, owner evidence, and privacy-safe analytics must be ready.",
    },
    {
      label: "Privacy review",
      status: input.publicPrivacyReleaseReady ? "pass" : "blocked",
      detail: "Public surfaces must hide sensitive data before release.",
    },
    {
      label: "Release readiness",
      status: input.phase10ReadinessStarted ? "pass" : "pending",
      detail: "Final launch QA, production runbook, and release decision must be ready.",
    },
    {
      label: "Runtime",
      status: "pending",
      detail: "Public execution remains disabled until explicit release approval.",
    },
  ];
}

function getMessage(phase9StructurallyComplete: boolean, reasons: Phase9CloseoutReason[]) {
  if (phase9StructurallyComplete) {
    return "Public execution safety is structurally complete; release readiness can continue while runtime remains disabled.";
  }

  return "Public release readiness is waiting on final safety checks.";
}