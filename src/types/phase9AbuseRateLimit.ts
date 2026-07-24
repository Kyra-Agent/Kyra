export type Phase9AbuseRateLimitStatus =
  | "blocked"
  | "ready_for_runtime"
  | "enforced";

export type Phase9AbuseRateLimitReason =
  | "eligibility_required"
  | "runtime_disabled"
  | "owner_rate_limit_exceeded"
  | "agent_rate_limit_exceeded"
  | "workspace_rate_limit_exceeded"
  | "route_rate_limit_exceeded"
  | "wallet_rate_limit_exceeded"
  | "cooldown_active"
  | "nonce_replay_detected"
  | "duplicate_submit_detected"
  | "provider_backoff_active"
  | "value_cap_exceeded"
  | "unsanitized_decision_forbidden"
  | "raw_wallet_data_forbidden"
  | "telegram_token_ref_forbidden"
  | "provider_payload_ref_forbidden";

export interface Phase9RateLimitWindowInput {
  used: number;
  limit: number;
}

export interface Phase9AbuseRateLimitInput {
  eligibilityCanProceed: boolean;
  phase9RuntimeEnabled: boolean;
  owner: Phase9RateLimitWindowInput;
  agent: Phase9RateLimitWindowInput;
  workspace: Phase9RateLimitWindowInput;
  route: Phase9RateLimitWindowInput;
  wallet: Phase9RateLimitWindowInput;
  cooldownActive: boolean;
  nonceAlreadyUsed: boolean;
  duplicateSubmitDetected: boolean;
  providerBackoffActive: boolean;
  requestedValueWei: string | null | undefined;
  maxValueWei: string;
  sanitizedDecision: boolean;
  exposesRawWalletData: boolean;
  exposesTelegramTokenRef: boolean;
  exposesProviderPayloadRef: boolean;
}

export interface Phase9AbuseRateLimitControl {
  label: string;
  status: "pass" | "pending" | "blocked";
  detail: string;
}

export interface Phase9AbuseRateLimitResult {
  status: Phase9AbuseRateLimitStatus;
  ownerOnly: true;
  publicExecutionAllowed: boolean;
  canProceedToIncidentControls: boolean;
  reasons: Phase9AbuseRateLimitReason[];
  controls: Phase9AbuseRateLimitControl[];
  message: string;
}

export function evaluatePhase9AbuseRateLimit(
  input: Phase9AbuseRateLimitInput,
): Phase9AbuseRateLimitResult {
  const reasons: Phase9AbuseRateLimitReason[] = [];
  const valueWei = parseWei(input.requestedValueWei);
  const maxValueWei = parseWei(input.maxValueWei);

  if (!input.eligibilityCanProceed) reasons.push("eligibility_required");
  if (!input.phase9RuntimeEnabled) reasons.push("runtime_disabled");
  if (isLimitExceeded(input.owner)) reasons.push("owner_rate_limit_exceeded");
  if (isLimitExceeded(input.agent)) reasons.push("agent_rate_limit_exceeded");
  if (isLimitExceeded(input.workspace)) reasons.push("workspace_rate_limit_exceeded");
  if (isLimitExceeded(input.route)) reasons.push("route_rate_limit_exceeded");
  if (isLimitExceeded(input.wallet)) reasons.push("wallet_rate_limit_exceeded");
  if (input.cooldownActive) reasons.push("cooldown_active");
  if (input.nonceAlreadyUsed) reasons.push("nonce_replay_detected");
  if (input.duplicateSubmitDetected) reasons.push("duplicate_submit_detected");
  if (input.providerBackoffActive) reasons.push("provider_backoff_active");
  if (valueWei === null || maxValueWei === null || valueWei > maxValueWei) reasons.push("value_cap_exceeded");
  if (!input.sanitizedDecision) reasons.push("unsanitized_decision_forbidden");
  if (input.exposesRawWalletData) reasons.push("raw_wallet_data_forbidden");
  if (input.exposesTelegramTokenRef) reasons.push("telegram_token_ref_forbidden");
  if (input.exposesProviderPayloadRef) reasons.push("provider_payload_ref_forbidden");

  const uniqueReasons = [...new Set(reasons)];
  const blockingWithoutRuntime = uniqueReasons.filter((reason) => reason !== "runtime_disabled");
  const publicExecutionAllowed = uniqueReasons.length === 0;

  return {
    status: resolveStatus(uniqueReasons, blockingWithoutRuntime),
    ownerOnly: true,
    publicExecutionAllowed,
    canProceedToIncidentControls: blockingWithoutRuntime.length === 0,
    reasons: uniqueReasons,
    controls: buildControls(input, uniqueReasons, valueWei, maxValueWei),
    message: getMessage(uniqueReasons, blockingWithoutRuntime),
  };
}

function resolveStatus(
  reasons: Phase9AbuseRateLimitReason[],
  blockingWithoutRuntime: Phase9AbuseRateLimitReason[],
): Phase9AbuseRateLimitStatus {
  if (reasons.length === 0) return "enforced";
  return blockingWithoutRuntime.length === 0 ? "ready_for_runtime" : "blocked";
}

function buildControls(
  input: Phase9AbuseRateLimitInput,
  reasons: Phase9AbuseRateLimitReason[],
  valueWei: bigint | null,
  maxValueWei: bigint | null,
): Phase9AbuseRateLimitControl[] {
  return [
    {
      label: "Eligibility",
      status: input.eligibilityCanProceed ? "pass" : "blocked",
      detail: "Execution eligibility must be clean before abuse controls can pass.",
    },
    {
      label: "Owner and agent limits",
      status: reasons.some((reason) => ["owner_rate_limit_exceeded", "agent_rate_limit_exceeded"].includes(reason)) ? "blocked" : "pass",
      detail: `Owner ${formatWindow(input.owner)}; agent ${formatWindow(input.agent)}.`,
    },
    {
      label: "Workspace and route limits",
      status: reasons.some((reason) => ["workspace_rate_limit_exceeded", "route_rate_limit_exceeded"].includes(reason)) ? "blocked" : "pass",
      detail: `Workspace ${formatWindow(input.workspace)}; route ${formatWindow(input.route)}.`,
    },
    {
      label: "Wallet limit",
      status: reasons.includes("wallet_rate_limit_exceeded") ? "blocked" : "pass",
      detail: `Wallet ${formatWindow(input.wallet)} without exposing the raw address.`,
    },
    {
      label: "Replay and duplicate lock",
      status: reasons.some((reason) => ["nonce_replay_detected", "duplicate_submit_detected"].includes(reason)) ? "blocked" : "pass",
      detail: "Used nonces and duplicate submit attempts cannot open execution.",
    },
    {
      label: "Cooldown and provider backoff",
      status: input.cooldownActive || input.providerBackoffActive ? "pending" : "pass",
      detail: "Cooldowns and provider failure backoff prevent repeated unsafe attempts.",
    },
    {
      label: "Value cap",
      status: valueWei !== null && maxValueWei !== null && valueWei <= maxValueWei ? "pass" : "blocked",
      detail: "Requested value must stay within the approved low-value cap.",
    },
    {
      label: "Sanitized evidence",
      status: reasons.some((reason) => ["unsanitized_decision_forbidden", "raw_wallet_data_forbidden", "telegram_token_ref_forbidden", "provider_payload_ref_forbidden"].includes(reason)) ? "blocked" : "pass",
      detail: "Decisions must not expose raw wallet data, Telegram token refs, or provider payload refs.",
    },
    {
      label: "Runtime",
      status: input.phase9RuntimeEnabled ? "pass" : "pending",
      detail: "Public execution runtime remains disabled until explicit release approval.",
    },
  ];
}

function getMessage(
  reasons: Phase9AbuseRateLimitReason[],
  blockingWithoutRuntime: Phase9AbuseRateLimitReason[],
) {
  if (reasons.length === 0) {
    return "Abuse and rate-limit controls are enforced for the approved release lane.";
  }

  if (blockingWithoutRuntime.length === 0) {
    return "Abuse and rate-limit controls are structurally ready, but runtime remains disabled.";
  }

  return "Abuse and rate-limit controls are waiting on required safety checks.";
}

function isLimitExceeded(window: Phase9RateLimitWindowInput) {
  return !Number.isFinite(window.used) || !Number.isFinite(window.limit) || window.limit < 0 || window.used > window.limit;
}

function formatWindow(window: Phase9RateLimitWindowInput) {
  return `${window.used}/${window.limit}`;
}

function parseWei(value: string | null | undefined) {
  if (!value || !/^\d+$/u.test(value)) return null;

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}