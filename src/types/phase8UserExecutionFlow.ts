export type Phase8UserExecutionFlowStatus =
  | "blocked"
  | "ready_to_start"
  | "in_progress"
  | "ready_to_submit"
  | "submitted"
  | "verifying"
  | "confirmed"
  | "failed";

export type Phase8UserExecutionFlowStepStatus =
  | "complete"
  | "current"
  | "locked"
  | "failed";

export type Phase8UserExecutionFlowStepKey =
  | "owner_session"
  | "agent_selection"
  | "base_account"
  | "prepared_action"
  | "owner_approval"
  | "runtime_submitter"
  | "receipt_verification"
  | "owner_closeout";

export interface Phase8UserExecutionFlowInput {
  ownerSignedIn: boolean;
  selectedAgent: boolean;
  baseAccountConnected: boolean;
  baseChainReady: boolean;
  preparedActionReady: boolean;
  ownerApprovalRecorded: boolean;
  runtimeEnabled: boolean;
  lowValueRequestReady: boolean;
  submitterState: "not_submitted" | "ready" | "submitted" | "confirmed" | "failed";
  verificationStatus: "not_started" | "pending_receipt" | "confirmed" | "failed" | "blocked";
  closeoutReady: boolean;
  visibleInPublicProfile: boolean;
  telegramRequestedExecution: boolean;
}

export interface Phase8UserExecutionFlowStep {
  key: Phase8UserExecutionFlowStepKey;
  label: string;
  status: Phase8UserExecutionFlowStepStatus;
  detail: string;
}

export interface Phase8UserExecutionFlowResult {
  status: Phase8UserExecutionFlowStatus;
  ownerOnly: true;
  activeStepKey: Phase8UserExecutionFlowStepKey;
  steps: Phase8UserExecutionFlowStep[];
  message: string;
  reasons: string[];
}

export function evaluatePhase8UserExecutionFlow(
  input: Phase8UserExecutionFlowInput,
): Phase8UserExecutionFlowResult {
  const reasons: string[] = [];

  if (input.visibleInPublicProfile) {
    reasons.push("public_visibility_forbidden");
  }

  if (input.telegramRequestedExecution) {
    reasons.push("telegram_execution_forbidden");
  }

  if (input.verificationStatus === "blocked") {
    reasons.push("verification_blocked");
  }

  if (input.verificationStatus === "failed" || input.submitterState === "failed") {
    reasons.push("execution_failed_safely");
  }

  const requirements = [
    input.ownerSignedIn,
    input.selectedAgent,
    input.baseAccountConnected && input.baseChainReady,
    input.preparedActionReady,
    input.ownerApprovalRecorded,
    input.runtimeEnabled && input.lowValueRequestReady,
  ];
  const firstMissingIndex = requirements.findIndex((ready) => !ready);
  const submitted = input.submitterState === "submitted" || input.submitterState === "confirmed";
  const confirmed = input.verificationStatus === "confirmed";
  const verifying = submitted && input.verificationStatus === "pending_receipt";

  const status = resolveStatus(input, reasons, firstMissingIndex, submitted, verifying, confirmed);
  const activeStepKey = resolveActiveStepKey(status, firstMissingIndex, submitted, confirmed);

  return {
    status,
    ownerOnly: true,
    activeStepKey,
    steps: [
      buildStep("owner_session", "Owner session", input.ownerSignedIn, firstMissingIndex === 0, "Sign in to the private owner dashboard."),
      buildStep("agent_selection", "Agent selected", input.selectedAgent, firstMissingIndex === 1, "Choose one deployed agent for the run."),
      buildStep("base_account", "Base Account", input.baseAccountConnected && input.baseChainReady, firstMissingIndex === 2, "Connect the owner Base Account on Base."),
      buildStep("prepared_action", "Prepared action", input.preparedActionReady, firstMissingIndex === 3, "Review the bounded low-value prepared action."),
      buildStep("owner_approval", "Owner approval", input.ownerApprovalRecorded, firstMissingIndex === 4, "Arm the owner live window before submit."),
      buildStep("runtime_submitter", "Submitter", input.runtimeEnabled && input.lowValueRequestReady && submitted, firstMissingIndex === 5 || status === "ready_to_submit", getSubmitterDetail(input, submitted)),
      buildStep("receipt_verification", "Receipt verification", confirmed, status === "verifying", getVerificationDetail(input)),
      buildStep("owner_closeout", "Owner closeout", input.closeoutReady, status === "confirmed" && !input.closeoutReady, "Record owner-only final evidence."),
    ].map((step) => normalizeFailure(step, status, reasons)),
    message: getFlowMessage(status),
    reasons: [...new Set(reasons)],
  };
}

function resolveStatus(
  input: Phase8UserExecutionFlowInput,
  reasons: string[],
  firstMissingIndex: number,
  submitted: boolean,
  verifying: boolean,
  confirmed: boolean,
): Phase8UserExecutionFlowStatus {
  if (reasons.includes("public_visibility_forbidden") || reasons.includes("telegram_execution_forbidden") || reasons.includes("verification_blocked")) {
    return "blocked";
  }

  if (reasons.includes("execution_failed_safely")) {
    return "failed";
  }

  if (confirmed && input.closeoutReady) {
    return "confirmed";
  }

  if (verifying) {
    return "verifying";
  }

  if (submitted) {
    return "submitted";
  }

  if (firstMissingIndex === -1) {
    return "ready_to_submit";
  }

  if (firstMissingIndex === 0) {
    return "ready_to_start";
  }

  return "in_progress";
}

function resolveActiveStepKey(
  status: Phase8UserExecutionFlowStatus,
  firstMissingIndex: number,
  submitted: boolean,
  confirmed: boolean,
): Phase8UserExecutionFlowStepKey {
  if (status === "blocked" || status === "failed") {
    return "owner_closeout";
  }

  if (confirmed) {
    return "owner_closeout";
  }

  if (submitted) {
    return "receipt_verification";
  }

  const keys: Phase8UserExecutionFlowStepKey[] = [
    "owner_session",
    "agent_selection",
    "base_account",
    "prepared_action",
    "owner_approval",
    "runtime_submitter",
  ];

  return keys[firstMissingIndex === -1 ? 5 : firstMissingIndex];
}

function buildStep(
  key: Phase8UserExecutionFlowStepKey,
  label: string,
  complete: boolean,
  current: boolean,
  detail: string,
): Phase8UserExecutionFlowStep {
  return {
    key,
    label,
    status: complete ? "complete" : current ? "current" : "locked",
    detail,
  };
}

function normalizeFailure(
  step: Phase8UserExecutionFlowStep,
  status: Phase8UserExecutionFlowStatus,
  reasons: string[],
): Phase8UserExecutionFlowStep {
  if (
    status === "failed" &&
    (step.key === "receipt_verification" || step.key === "owner_closeout")
  ) {
    return { ...step, status: "failed" };
  }

  if (
    status === "blocked" &&
    reasons.length > 0 &&
    (step.key === "runtime_submitter" || step.key === "receipt_verification")
  ) {
    return { ...step, status: "failed" };
  }

  return step;
}

function getSubmitterDetail(input: Phase8UserExecutionFlowInput, submitted: boolean) {
  if (submitted) {
    return "Provider handoff recorded; waiting for receipt verification.";
  }

  if (!input.runtimeEnabled) {
    return "Runtime submitter flag is still disabled.";
  }

  if (!input.lowValueRequestReady) {
    return "Low-value request is not ready yet.";
  }

  return "Submit one owner-controlled low-value transaction.";
}

function getVerificationDetail(input: Phase8UserExecutionFlowInput) {
  switch (input.verificationStatus) {
    case "confirmed":
      return "Base receipt verified successfully.";
    case "pending_receipt":
      return "Waiting for the Base receipt.";
    case "failed":
      return "Receipt failed safely with sanitized evidence.";
    case "blocked":
      return "Receipt verification is blocked.";
    case "not_started":
      return "Receipt verification starts after submit.";
  }
}

function getFlowMessage(status: Phase8UserExecutionFlowStatus) {
  switch (status) {
    case "ready_to_start":
      return "Start with the private owner dashboard session.";
    case "in_progress":
      return "Execution flow is progressing through the required owner gates.";
    case "ready_to_submit":
      return "Execution flow is ready for one owner-controlled low-value submit.";
    case "submitted":
      return "Transaction submit was handed to the provider; receipt verification is next.";
    case "verifying":
      return "Kyra is waiting for Base receipt verification under owner-only monitoring.";
    case "confirmed":
      return "Controlled low-value execution is confirmed and closed owner-only.";
    case "failed":
      return "Execution flow failed safely with sanitized owner-only evidence.";
    case "blocked":
      return "Execution flow is blocked by a privacy or authority boundary.";
  }
}