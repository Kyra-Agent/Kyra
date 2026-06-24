import { baseChainId } from "./unsignedTransactionHandoff";

export type WalletPromptSource =
  | "owner_dashboard_click"
  | "page_load"
  | "public_agent_page"
  | "telegram_message"
  | "telegram_webhook"
  | "llm_output"
  | "base_mcp_provider_response"
  | "background_retry"
  | "activity_log_replay";

export type WalletPromptBlockReason =
  | "wallet_execution_disabled"
  | "not_owner_dashboard"
  | "owner_session_required"
  | "agent_binding_required"
  | "base_account_connection_required"
  | "base_network_required"
  | "reviewed_prepared_action_required"
  | "risk_review_required"
  | "owner_approval_required"
  | "valid_handoff_required"
  | "handoff_expired"
  | "forbidden_prompt_source";

export interface WalletPromptEligibilityInput {
  walletExecutionEnabled: boolean;
  promptSource: WalletPromptSource;
  ownerSignedIn: boolean;
  privateDashboard: boolean;
  selectedAgent: boolean;
  baseAccountConnected: boolean;
  chainId: unknown;
  preparedActionReviewed: boolean;
  riskReviewReady: boolean;
  ownerApprovalRecorded: boolean;
  handoffValid: boolean;
  handoffExpired: boolean;
}

export interface WalletPromptEligibilityResult {
  eligible: boolean;
  reasons: WalletPromptBlockReason[];
  message: string;
}

const allowedPromptSource: WalletPromptSource = "owner_dashboard_click";

const promptBlockMessages: Record<WalletPromptBlockReason, string> = {
  wallet_execution_disabled: "Wallet signing is still disabled by the runtime gate.",
  not_owner_dashboard: "Wallet prompts are only allowed from the private owner dashboard.",
  owner_session_required: "A fresh owner session is required before any wallet prompt.",
  agent_binding_required: "A selected deployed agent binding is required.",
  base_account_connection_required: "Connect the owner Base Account before signing can be reviewed.",
  base_network_required: "The connected wallet must be on Base.",
  reviewed_prepared_action_required: "A reviewed prepared action is required before signing.",
  risk_review_required: "NYX-05 risk review must be ready before signing.",
  owner_approval_required: "Kyra owner approval must be recorded before wallet approval.",
  valid_handoff_required: "A valid unsigned handoff is required before wallet approval.",
  handoff_expired: "Expired wallet handoffs cannot open prompts.",
  forbidden_prompt_source: "This source is never allowed to open a wallet prompt.",
};

export function evaluateWalletPromptEligibility(
  input: WalletPromptEligibilityInput,
): WalletPromptEligibilityResult {
  const reasons: WalletPromptBlockReason[] = [];

  if (!input.walletExecutionEnabled) {
    reasons.push("wallet_execution_disabled");
  }

  if (!input.privateDashboard) {
    reasons.push("not_owner_dashboard");
  }

  if (!input.ownerSignedIn) {
    reasons.push("owner_session_required");
  }

  if (!input.selectedAgent) {
    reasons.push("agent_binding_required");
  }

  if (!input.baseAccountConnected) {
    reasons.push("base_account_connection_required");
  }

  if (input.chainId !== baseChainId) {
    reasons.push("base_network_required");
  }

  if (!input.preparedActionReviewed) {
    reasons.push("reviewed_prepared_action_required");
  }

  if (!input.riskReviewReady) {
    reasons.push("risk_review_required");
  }

  if (!input.ownerApprovalRecorded) {
    reasons.push("owner_approval_required");
  }

  if (!input.handoffValid) {
    reasons.push("valid_handoff_required");
  }

  if (input.handoffExpired) {
    reasons.push("handoff_expired");
  }

  if (input.promptSource !== allowedPromptSource) {
    reasons.push("forbidden_prompt_source");
  }

  return {
    eligible: reasons.length === 0,
    reasons,
    message: reasons.length === 0
      ? "Wallet prompt is eligible for the next reviewed gate."
      : promptBlockMessages[reasons[0]],
  };
}

export function getWalletPromptBlockMessage(reason: WalletPromptBlockReason) {
  return promptBlockMessages[reason];
}

export function isForbiddenWalletPromptSource(source: WalletPromptSource) {
  return source !== allowedPromptSource;
}
