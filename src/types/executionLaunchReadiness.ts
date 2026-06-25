import type {
  ControlledLiveTransactionGateResult,
} from "./controlledLiveTransactionGate";

export type ExecutionLaunchReadinessStatus =
  | "blocked"
  | "ready_for_owner_launch_decision"
  | "owner_approved_runtime_still_disabled";

export type ExecutionLaunchReadinessBlockReason =
  | "owner_session_required"
  | "selected_agent_required"
  | "base_account_required"
  | "controlled_gate_not_ready"
  | "official_mcp_must_remain_optional_or_disabled"
  | "telegram_execution_must_remain_disabled"
  | "public_execution_must_remain_hidden"
  | "wallet_runtime_must_remain_disabled"
  | "signing_runtime_must_remain_disabled"
  | "submission_runtime_must_remain_disabled"
  | "production_health_required"
  | "supabase_health_required"
  | "rollback_required"
  | "emergency_disable_required"
  | "post_transaction_audit_required";

export interface ExecutionLaunchReadinessInput {
  ownerSignedIn: boolean;
  selectedAgent: boolean;
  baseAccountConnected: boolean;
  controlledGate: ControlledLiveTransactionGateResult;
  officialMcpAdapter: "no-go" | "optional-disabled" | "approved";
  telegramExecutionDisabled: boolean;
  publicExecutionHidden: boolean;
  walletExecutionRuntime: "disabled" | "enabled";
  walletSigningRuntime: "disabled" | "enabled";
  transactionSubmissionRuntime: "disabled" | "enabled";
  productionDeployHealthy: boolean;
  supabaseHealthy: boolean;
  rollbackReady: boolean;
  emergencyDisableReady: boolean;
  postTransactionAuditReady: boolean;
  ownerLaunchDecision: "not_requested" | "approved";
}

export interface ExecutionLaunchReadinessResult {
  status: ExecutionLaunchReadinessStatus;
  ownerOnly: true;
  baseAccountPrimaryLane: true;
  officialMcpRequired: false;
  walletPromptAllowed: false;
  walletSigningAllowed: false;
  transactionSubmissionAllowed: false;
  reasons: ExecutionLaunchReadinessBlockReason[];
  message: string;
}

const blockMessages: Record<ExecutionLaunchReadinessBlockReason, string> = {
  owner_session_required:
    "Sign in before an execution launch decision can be reviewed.",
  selected_agent_required:
    "Select one deployed agent before execution launch review.",
  base_account_required:
    "Connect the owner's Base Account before launch review.",
  controlled_gate_not_ready:
    "Controlled live gate must be ready before launch review.",
  official_mcp_must_remain_optional_or_disabled:
    "Official hosted Base MCP cannot be required while provider evidence is no-go.",
  telegram_execution_must_remain_disabled:
    "Telegram must remain unable to authorize wallet execution.",
  public_execution_must_remain_hidden:
    "Public profiles must not expose execution launch state.",
  wallet_runtime_must_remain_disabled:
    "Wallet execution runtime must remain disabled until a separate launch enablement.",
  signing_runtime_must_remain_disabled:
    "Signing runtime must remain disabled until a separate launch enablement.",
  submission_runtime_must_remain_disabled:
    "Transaction submission runtime must remain disabled until a separate launch enablement.",
  production_health_required:
    "Production deploy health must be green before launch review.",
  supabase_health_required:
    "Supabase health must be green before launch review.",
  rollback_required:
    "Rollback must be ready before launch review.",
  emergency_disable_required:
    "Emergency disablement must be ready before launch review.",
  post_transaction_audit_required:
    "Post-transaction audit must be ready before launch review.",
};

export function evaluateExecutionLaunchReadiness(
  input: ExecutionLaunchReadinessInput,
): ExecutionLaunchReadinessResult {
  const reasons: ExecutionLaunchReadinessBlockReason[] = [];

  if (!input.ownerSignedIn) {
    reasons.push("owner_session_required");
  }

  if (!input.selectedAgent) {
    reasons.push("selected_agent_required");
  }

  if (!input.baseAccountConnected) {
    reasons.push("base_account_required");
  }

  if (
    input.controlledGate.status === "blocked" ||
    input.controlledGate.reasons.length > 0 ||
    input.controlledGate.walletPromptAllowed ||
    input.controlledGate.walletSigningAllowed ||
    input.controlledGate.transactionSubmissionAllowed
  ) {
    reasons.push("controlled_gate_not_ready");
  }

  if (input.officialMcpAdapter === "approved") {
    reasons.push("official_mcp_must_remain_optional_or_disabled");
  }

  if (!input.telegramExecutionDisabled) {
    reasons.push("telegram_execution_must_remain_disabled");
  }

  if (!input.publicExecutionHidden) {
    reasons.push("public_execution_must_remain_hidden");
  }

  if (input.walletExecutionRuntime !== "disabled") {
    reasons.push("wallet_runtime_must_remain_disabled");
  }

  if (input.walletSigningRuntime !== "disabled") {
    reasons.push("signing_runtime_must_remain_disabled");
  }

  if (input.transactionSubmissionRuntime !== "disabled") {
    reasons.push("submission_runtime_must_remain_disabled");
  }

  if (!input.productionDeployHealthy) {
    reasons.push("production_health_required");
  }

  if (!input.supabaseHealthy) {
    reasons.push("supabase_health_required");
  }

  if (!input.rollbackReady) {
    reasons.push("rollback_required");
  }

  if (!input.emergencyDisableReady) {
    reasons.push("emergency_disable_required");
  }

  if (!input.postTransactionAuditReady) {
    reasons.push("post_transaction_audit_required");
  }

  const uniqueReasons = [...new Set(reasons)];

  return {
    status: uniqueReasons.length
      ? "blocked"
      : input.ownerLaunchDecision === "approved"
        ? "owner_approved_runtime_still_disabled"
        : "ready_for_owner_launch_decision",
    ownerOnly: true,
    baseAccountPrimaryLane: true,
    officialMcpRequired: false,
    walletPromptAllowed: false,
    walletSigningAllowed: false,
    transactionSubmissionAllowed: false,
    reasons: uniqueReasons,
    message: uniqueReasons.length
      ? blockMessages[uniqueReasons[0]]
      : input.ownerLaunchDecision === "approved"
        ? "Owner launch decision is approved, but runtime wallet prompt, signing, and submission remain disabled until the separate enablement window."
        : "Execution launch packet is ready for owner review. Base Account remains the primary lane and official Base MCP remains optional.",
  };
}

export function getExecutionLaunchReadinessBlockMessage(
  reason: ExecutionLaunchReadinessBlockReason,
) {
  return blockMessages[reason];
}
