export type Phase8SecurityAbuseHardeningStatus =
  | "blocked"
  | "ready_for_hardening"
  | "hardened"
  | "failed_safe";

export type Phase8SecurityAbuseHardeningReason =
  | "owner_scope_required"
  | "runtime_required"
  | "owner_approval_required"
  | "request_required"
  | "submitter_busy"
  | "result_already_recorded"
  | "replay_nonce_detected"
  | "public_visibility_forbidden"
  | "telegram_execution_forbidden"
  | "unsafe_value"
  | "unsafe_calldata"
  | "token_approval_forbidden"
  | "swap_forbidden"
  | "unsanitized_failure_forbidden"
  | "receipt_verification_required";

export interface Phase8SecurityAbuseHardeningInput {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  preparedActionId: string;
  submissionNonce: string;
  runtimeEnabled: boolean;
  ownerApprovalRecorded: boolean;
  lowValueRequestReady: boolean;
  submitterPending: boolean;
  resultAlreadyRecorded: boolean;
  nonceAlreadyUsed: boolean;
  requestedValueWei: string | null;
  maxValueWei: string;
  calldata: string | null;
  includesTokenApproval: boolean;
  includesSwap: boolean;
  visibleInPublicProfile: boolean;
  telegramRequestedExecution: boolean;
  failureMessage: string | null;
  failureSanitized: boolean;
  verificationStatus: "not_started" | "pending_receipt" | "confirmed" | "failed" | "blocked";
}

export interface Phase8SecurityAbuseHardeningControl {
  label: string;
  status: "pass" | "pending" | "blocked";
  detail: string;
}

export interface Phase8SecurityAbuseHardeningResult {
  status: Phase8SecurityAbuseHardeningStatus;
  ownerOnly: true;
  canOpenSubmitter: boolean;
  reasons: Phase8SecurityAbuseHardeningReason[];
  controls: Phase8SecurityAbuseHardeningControl[];
  message: string;
}

const maxLowValueWei = 100000000000000n;

export function evaluatePhase8SecurityAbuseHardening(
  input: Phase8SecurityAbuseHardeningInput,
): Phase8SecurityAbuseHardeningResult {
  const reasons: Phase8SecurityAbuseHardeningReason[] = [];
  const valueWei = parseWei(input.requestedValueWei);
  const capWei = parseWei(input.maxValueWei) ?? maxLowValueWei;

  if (!input.ownerUserId.trim() || !input.workspaceId.trim() || !input.agentId.trim()) {
    reasons.push("owner_scope_required");
  }

  if (!input.preparedActionId.trim() || !input.submissionNonce.trim()) {
    reasons.push("owner_scope_required");
  }

  if (!input.runtimeEnabled) {
    reasons.push("runtime_required");
  }

  if (!input.ownerApprovalRecorded) {
    reasons.push("owner_approval_required");
  }

  if (!input.lowValueRequestReady || valueWei === null) {
    reasons.push("request_required");
  }

  if (input.submitterPending) {
    reasons.push("submitter_busy");
  }

  if (input.resultAlreadyRecorded) {
    reasons.push("result_already_recorded");
  }

  if (input.nonceAlreadyUsed) {
    reasons.push("replay_nonce_detected");
  }

  if (input.visibleInPublicProfile) {
    reasons.push("public_visibility_forbidden");
  }

  if (input.telegramRequestedExecution) {
    reasons.push("telegram_execution_forbidden");
  }

  if (valueWei !== null && (valueWei <= 0n || valueWei > capWei)) {
    reasons.push("unsafe_value");
  }

  if ((input.calldata ?? "0x") !== "0x") {
    reasons.push("unsafe_calldata");
  }

  if (input.includesTokenApproval) {
    reasons.push("token_approval_forbidden");
  }

  if (input.includesSwap) {
    reasons.push("swap_forbidden");
  }

  if (input.failureMessage && !input.failureSanitized) {
    reasons.push("unsanitized_failure_forbidden");
  }

  if (input.verificationStatus === "blocked") {
    reasons.push("receipt_verification_required");
  }

  const uniqueReasons = [...new Set(reasons)];
  const failedSafe = input.verificationStatus === "failed";
  const canOpenSubmitter = uniqueReasons.length === 0 && !failedSafe;

  return {
    status: resolveStatus(uniqueReasons, canOpenSubmitter, failedSafe),
    ownerOnly: true,
    canOpenSubmitter,
    reasons: uniqueReasons,
    controls: buildControls(input, uniqueReasons, valueWei, capWei),
    message: getMessage(uniqueReasons, canOpenSubmitter, failedSafe),
  };
}

function resolveStatus(
  reasons: Phase8SecurityAbuseHardeningReason[],
  canOpenSubmitter: boolean,
  failedSafe: boolean,
): Phase8SecurityAbuseHardeningStatus {
  if (failedSafe) {
    return "failed_safe";
  }

  if (reasons.length) {
    return "blocked";
  }

  return canOpenSubmitter ? "hardened" : "ready_for_hardening";
}

function buildControls(
  input: Phase8SecurityAbuseHardeningInput,
  reasons: Phase8SecurityAbuseHardeningReason[],
  valueWei: bigint | null,
  capWei: bigint,
): Phase8SecurityAbuseHardeningControl[] {
  return [
    {
      label: "Owner scope",
      status: reasons.includes("owner_scope_required") ? "blocked" : "pass",
      detail: "Owner, workspace, agent, action, and nonce are required.",
    },
    {
      label: "Replay lock",
      status: input.nonceAlreadyUsed || input.resultAlreadyRecorded ? "blocked" : "pass",
      detail: "A used nonce or recorded result cannot submit again.",
    },
    {
      label: "Submit lock",
      status: input.submitterPending ? "pending" : "pass",
      detail: "Only one provider submit can be pending at a time.",
    },
    {
      label: "Transaction shape",
      status: valueWei !== null && valueWei > 0n && valueWei <= capWei && (input.calldata ?? "0x") === "0x" ? "pass" : "blocked",
      detail: "Low-value ETH transfer only; arbitrary calldata stays blocked.",
    },
    {
      label: "Surface boundary",
      status: input.visibleInPublicProfile || input.telegramRequestedExecution ? "blocked" : "pass",
      detail: "Public profiles and Telegram cannot open execution.",
    },
    {
      label: "Failure hygiene",
      status: input.failureMessage && !input.failureSanitized ? "blocked" : "pass",
      detail: "Failure evidence must be sanitized and owner-only.",
    },
    {
      label: "Receipt verification",
      status: input.verificationStatus === "blocked" ? "blocked" : input.verificationStatus === "pending_receipt" ? "pending" : "pass",
      detail: "A submitted hash must close through Base receipt verification.",
    },
  ];
}

function getMessage(
  reasons: Phase8SecurityAbuseHardeningReason[],
  canOpenSubmitter: boolean,
  failedSafe: boolean,
) {
  if (failedSafe) {
    return "Security hardening failed safely with sanitized owner-only evidence.";
  }

  if (canOpenSubmitter) {
    return "Security hardening allows one owner-controlled low-value submit.";
  }

  return `Security hardening blocks submitter: ${reasons[0] ?? "unknown"}.`;
}

function parseWei(value: string | null) {
  if (!value || !/^\d+$/u.test(value)) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}
