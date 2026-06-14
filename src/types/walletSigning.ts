export type WalletSigningState =
  | "not_ready"
  | "preview_ready"
  | "review_required"
  | "wallet_prompt_requested"
  | "wallet_prompt_opened"
  | "user_rejected"
  | "submitted"
  | "failed"
  | "confirmed";

export type WalletSigningEvent =
  | "load_preview"
  | "require_review"
  | "request_wallet_prompt"
  | "wallet_prompt_opened"
  | "reject"
  | "submit"
  | "fail"
  | "confirm"
  | "reset";

export interface WalletSigningTransitionInput {
  state: WalletSigningState;
  event: WalletSigningEvent;
  ownerAction?: boolean;
  txHash?: string | null;
  confirmationId?: string | null;
  sanitizedFailureReason?: string | null;
}

export interface WalletSigningTransitionResult {
  ok: boolean;
  state: WalletSigningState;
  reason: string | null;
}

const allowedTransitions: Record<WalletSigningState, WalletSigningEvent[]> = {
  not_ready: ["load_preview", "reset"],
  preview_ready: [
    "require_review",
    "request_wallet_prompt",
    "reject",
    "fail",
    "reset",
  ],
  review_required: ["request_wallet_prompt", "reject", "fail", "reset"],
  wallet_prompt_requested: ["wallet_prompt_opened", "reject", "fail", "reset"],
  wallet_prompt_opened: ["submit", "reject", "fail", "reset"],
  user_rejected: ["reset"],
  submitted: ["confirm", "fail", "reset"],
  failed: ["reset"],
  confirmed: ["reset"],
};

export function transitionWalletSigningState(
  input: WalletSigningTransitionInput,
): WalletSigningTransitionResult {
  if (!allowedTransitions[input.state].includes(input.event)) {
    return rejectTransition(
      input.state,
      "Wallet signing transition is not allowed.",
    );
  }

  switch (input.event) {
    case "load_preview":
      return allowTransition("preview_ready");
    case "require_review":
      return allowTransition("review_required");
    case "request_wallet_prompt":
      if (!input.ownerAction) {
        return rejectTransition(
          input.state,
          "Wallet prompt requires explicit owner action.",
        );
      }

      return allowTransition("wallet_prompt_requested");
    case "wallet_prompt_opened":
      return allowTransition("wallet_prompt_opened");
    case "reject":
      if (input.txHash) {
        return rejectTransition(
          input.state,
          "Rejected actions must not include a transaction hash.",
        );
      }

      return allowTransition("user_rejected");
    case "submit":
      if (!isTransactionHash(input.txHash)) {
        return rejectTransition(
          input.state,
          "Submitted actions require a transaction hash.",
        );
      }

      return allowTransition("submitted");
    case "confirm":
      if (!input.confirmationId || !input.confirmationId.trim()) {
        return rejectTransition(
          input.state,
          "Confirmed actions require confirmation data.",
        );
      }

      return allowTransition("confirmed");
    case "fail":
      if (
        !input.sanitizedFailureReason || !input.sanitizedFailureReason.trim()
      ) {
        return rejectTransition(
          input.state,
          "Failed actions require a sanitized reason.",
        );
      }

      return allowTransition("failed");
    case "reset":
      return allowTransition("not_ready");
  }
}

export function isTerminalWalletSigningState(state: WalletSigningState) {
  return state === "user_rejected" || state === "failed" ||
    state === "confirmed";
}

export function isTransactionHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/u.test(value);
}

function allowTransition(
  state: WalletSigningState,
): WalletSigningTransitionResult {
  return {
    ok: true,
    state,
    reason: null,
  };
}

function rejectTransition(
  state: WalletSigningState,
  reason: string,
): WalletSigningTransitionResult {
  return {
    ok: false,
    state,
    reason,
  };
}
