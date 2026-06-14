import { CheckCircle2, ShieldCheck, WalletCards, X } from "lucide-react";
import type { DemoScenario } from "../data/demoScenarios";
import type { WalletSigningState } from "../types/walletSigning";

interface WalletApprovalModalProps {
  scenario: DemoScenario;
  open: boolean;
  approved: boolean;
  closing: boolean;
  signingState: WalletSigningState;
  onApprove: () => void;
  onClose: () => void;
}

export function WalletApprovalModal({
  scenario,
  open,
  approved,
  closing,
  signingState,
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
              Wallet approval
            </span>
            <h3>{approved ? "Demo approval confirmed" : "Review action"}</h3>
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
            <strong>Demo only</strong>
          </span>
          <span>
            Signing state
            <strong>{formatSigningState(signingState)}</strong>
          </span>
        </div>

        <div className="approval-warning">
          <ShieldCheck size={17} />
          {approved
            ? "Demo approval is recorded locally. Real wallet signing remains disabled."
            : "Kyra prepares the review context. Real wallet signing stays disabled."}
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
            {approved ? "Approved" : "Approve Demo"}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatSigningState(state: WalletSigningState) {
  return state.replace(/_/g, " ");
}
