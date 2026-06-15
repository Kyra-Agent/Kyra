import { CheckCircle2, ShieldCheck, WalletCards, X } from "lucide-react";
import type { DemoScenario } from "../data/demoScenarios";
import type {
  WalletUnsignedTransactionHandoff,
  WalletUnsignedTransactionHandoffValidation,
} from "../types/unsignedTransactionHandoff";
import type { WalletSigningState } from "../types/walletSigning";

interface WalletApprovalModalProps {
  scenario: DemoScenario;
  open: boolean;
  approved: boolean;
  closing: boolean;
  signingState: WalletSigningState;
  unsignedHandoff: WalletUnsignedTransactionHandoff;
  unsignedHandoffValidation: WalletUnsignedTransactionHandoffValidation;
  onApprove: () => void;
  onClose: () => void;
}

export function WalletApprovalModal({
  scenario,
  open,
  approved,
  closing,
  signingState,
  unsignedHandoff,
  unsignedHandoffValidation,
  onApprove,
  onClose,
}: WalletApprovalModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div
      className={`modal-backdrop ${closing ? "is-closing" : ""}`}
      role="presentation"
    >
      <section
        className={`approval-modal ${approved ? "is-approved" : ""} ${
          closing ? "is-closing" : ""
        }`}
        role="dialog"
        aria-modal="true"
        aria-label="Wallet approval demo"
      >
        <div className="modal-header">
          <div>
            <span className="demo-badge compact">
              <WalletCards size={14} />
              Demo review
            </span>
            <h3>{approved ? "Demo review recorded" : "Review draft"}</h3>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className="approval-detail-card">
          <span>Command</span>
          <strong>{scenario.command}</strong>
        </div>

        <div className="approval-detail-grid">
          <span>
            Route
            <strong>{scenario.route}</strong>
          </span>
          <span>
            Network
            <strong>{scenario.network}</strong>
          </span>
          <span>
            Risk
            <strong>{scenario.risk}</strong>
          </span>
          <span>
            Execution
            <strong>Disabled</strong>
          </span>
          <span>
            Signing state
            <strong>{formatSigningState(signingState)}</strong>
          </span>
        </div>

        <div
          className={`handoff-review ${
            unsignedHandoffValidation.ok ? "is-ready" : "is-blocked"
          }`}
        >
          <div>
            <span>Unsigned handoff</span>
            <strong>
              {unsignedHandoffValidation.ok ? "review ready" : "blocked"}
            </strong>
          </div>
          <div className="handoff-review-grid">
            <span>
              Chain
              <strong>{unsignedHandoff.chainName}</strong>
            </span>
            <span>
              Gas payer
              <strong>connected wallet</strong>
            </span>
            <span>
              Expiry
              <strong>{formatExpiry(unsignedHandoff.expiresAt)}</strong>
            </span>
            <span>
              Value
              <strong>{unsignedHandoff.valueSummary}</strong>
            </span>
          </div>
          <p>
            {unsignedHandoffValidation.ok
              ? "Review context is valid. Wallet execution remains disabled until provider integration."
              : unsignedHandoffValidation.reason}
          </p>
        </div>

        <div className="approval-warning">
          <ShieldCheck size={17} />
          {approved
            ? "Demo review is recorded locally. Real wallet signing remains disabled."
            : "Kyra prepares review context only. Real wallet signing stays disabled."}
        </div>

        <div className="modal-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={onClose}
          >
            Reject
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={onApprove}
            disabled={approved}
          >
            <CheckCircle2 size={17} />
            {approved ? "Recorded" : "Record Demo Review"}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatSigningState(state: WalletSigningState) {
  return state.replace(/_/g, " ");
}

function formatExpiry(expiresAt: string) {
  const expiry = new Date(expiresAt);

  if (Number.isNaN(expiry.getTime())) {
    return "invalid";
  }

  return expiry.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}
