import type { Phase8TransactionVerificationStatus } from "./phase8TransactionVerification";

export type RobinhoodTestnetCloseoutStepStatus =
  | "complete"
  | "current"
  | "pending"
  | "failed";

export type RobinhoodTestnetCloseoutAction =
  | "sign_in"
  | "select_agent"
  | "check_chain_status"
  | "connect_wallet"
  | "open_review_window"
  | "submit_transaction"
  | "wait_for_receipt"
  | "retry_transaction"
  | "complete";

export interface RobinhoodTestnetCloseoutStep {
  key:
    | "owner"
    | "agent"
    | "network"
    | "wallet"
    | "action"
    | "review"
    | "submission"
    | "receipt";
  label: string;
  detail: string;
  status: RobinhoodTestnetCloseoutStepStatus;
}

export interface RobinhoodTestnetCloseoutInput {
  enabled: boolean;
  ownerSignedIn: boolean;
  selectedAgent: boolean;
  chainStatusPrepared: boolean;
  walletConnected: boolean;
  reviewedActionReady: boolean;
  ownerWindowArmed: boolean;
  submitterReady: boolean;
  transactionStatus: Phase8TransactionVerificationStatus;
}

export interface RobinhoodTestnetCloseoutResult {
  status:
    | "unavailable"
    | "setup_required"
    | "ready_for_review"
    | "ready_to_submit"
    | "waiting_for_receipt"
    | "complete"
    | "failed";
  label: string;
  message: string;
  nextAction: RobinhoodTestnetCloseoutAction;
  steps: RobinhoodTestnetCloseoutStep[];
}

export function evaluateRobinhoodTestnetCloseout(
  input: RobinhoodTestnetCloseoutInput,
): RobinhoodTestnetCloseoutResult {
  const transactionSubmitted =
    input.transactionStatus === "pending_receipt" ||
    input.transactionStatus === "confirmed" ||
    input.transactionStatus === "failed";
  const transactionConfirmed = input.transactionStatus === "confirmed";
  const transactionFailed = input.transactionStatus === "failed";

  const checkpoints = [
    input.ownerSignedIn,
    input.selectedAgent,
    input.chainStatusPrepared || transactionSubmitted,
    input.walletConnected || transactionSubmitted,
    input.reviewedActionReady || transactionSubmitted,
    input.ownerWindowArmed || transactionSubmitted,
    transactionSubmitted,
    transactionConfirmed,
  ];
  const firstIncomplete = checkpoints.findIndex((complete) => !complete);

  const steps: RobinhoodTestnetCloseoutStep[] = [
    createStep("owner", "Owner account", "Private session verified.", checkpoints, firstIncomplete, 0),
    createStep("agent", "Agent binding", "Selected agent matches Robinhood Chain Testnet.", checkpoints, firstIncomplete, 1),
    createStep("network", "Network status", "Owner-scoped read-only chain check prepared.", checkpoints, firstIncomplete, 2),
    createStep("wallet", "Wallet connection", "Owner wallet connected in browser memory.", checkpoints, firstIncomplete, 3),
    createStep("action", "Reviewed action", "Zero-value self-send frozen with no calldata.", checkpoints, firstIncomplete, 4),
    createStep("review", "Owner review", "One-time review window opened explicitly.", checkpoints, firstIncomplete, 5),
    createStep("submission", "Wallet confirmation", "Transaction submitted by the owner wallet.", checkpoints, firstIncomplete, 6, transactionFailed),
    createStep("receipt", "Network receipt", "Receipt verified under owner-only monitoring.", checkpoints, firstIncomplete, 7, transactionFailed),
  ];

  if (!input.enabled) {
    return build("unavailable", "Testnet lane disabled", "The Robinhood Chain Testnet owner lane is not enabled in this runtime.", "sign_in", steps);
  }

  if (!input.ownerSignedIn) {
    return build("setup_required", "Sign in required", "Sign in to the private owner workspace before preparing a transaction.", "sign_in", steps);
  }
  if (!input.selectedAgent) {
    return build("setup_required", "Select a testnet agent", "Select a deployed agent bound to Robinhood Chain Testnet.", "select_agent", steps);
  }
  if (transactionFailed) {
    return build("failed", "Transaction closed safely", "The provider returned a sanitized failure. Close the review window before retrying.", "retry_transaction", steps);
  }
  if (transactionConfirmed) {
    return build("complete", "Testnet transaction verified", "The owner-only zero-value transaction is confirmed and the testnet closeout is complete.", "complete", steps);
  }
  if (transactionSubmitted) {
    return build("waiting_for_receipt", "Waiting for receipt", "The transaction was submitted and is waiting for a Robinhood Chain Testnet receipt.", "wait_for_receipt", steps);
  }
  if (!input.chainStatusPrepared) {
    return build("setup_required", "Check network status", "Run the owner-only status check to prepare the selected agent's testnet route.", "check_chain_status", steps);
  }
  if (!input.walletConnected) {
    return build("setup_required", "Connect owner wallet", "Connect a wallet on Robinhood Chain Testnet. The connection stays in browser memory.", "connect_wallet", steps);
  }
  if (!input.reviewedActionReady) {
    return build("setup_required", "Preparing reviewed action", "Kyra is freezing the zero-value owner self-check for review.", "check_chain_status", steps);
  }
  if (!input.ownerWindowArmed) {
    return build("ready_for_review", "Ready for owner review", "Open the one-time review window after confirming the selected agent and zero-value action.", "open_review_window", steps);
  }

  if (!input.submitterReady) {
    return build("ready_to_submit", "Final checks in progress", "The owner review is open while Kyra completes the isolated submitter checks.", "submit_transaction", steps);
  }

  return build("ready_to_submit", "Ready for wallet confirmation", "Review the frozen action, then confirm the zero-value transaction in the connected wallet.", "submit_transaction", steps);
}

function createStep(
  key: RobinhoodTestnetCloseoutStep["key"],
  label: string,
  detail: string,
  checkpoints: boolean[],
  firstIncomplete: number,
  index: number,
  failed = false,
): RobinhoodTestnetCloseoutStep {
  return {
    key,
    label,
    detail,
    status: failed && (key === "submission" || key === "receipt")
      ? "failed"
      : checkpoints[index]
      ? "complete"
      : index === firstIncomplete
      ? "current"
      : "pending",
  };
}

function build(
  status: RobinhoodTestnetCloseoutResult["status"],
  label: string,
  message: string,
  nextAction: RobinhoodTestnetCloseoutAction,
  steps: RobinhoodTestnetCloseoutStep[],
): RobinhoodTestnetCloseoutResult {
  return { status, label, message, nextAction, steps };
}