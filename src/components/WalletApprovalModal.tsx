import { CheckCircle2, ShieldCheck, WalletCards, X } from "lucide-react";
import type { DemoScenario } from "../data/demoScenarios";
import type {
  WalletUnsignedTransactionHandoff,
  WalletUnsignedTransactionHandoffValidation,
} from "../types/unsignedTransactionHandoff";
import type { WalletSigningState } from "../types/walletSigning";
import type { RiskReviewResult } from "../types/riskReview";

interface WalletApprovalModalProps {
  scenario: DemoScenario;
  open: boolean;
  approved: boolean;
  rejected: boolean;
  closing: boolean;
  signingState: WalletSigningState;
  unsignedHandoff: WalletUnsignedTransactionHandoff;
  unsignedHandoffValidation: WalletUnsignedTransactionHandoffValidation;
  riskReview: RiskReviewResult;
  onApprove: () => void;
  onReject: () => void;
  onClose: () => void;
}

export function WalletApprovalModal({
  scenario,
  open,
  approved,
  rejected,
  closing,
  signingState,
  unsignedHandoff,
  unsignedHandoffValidation,
  riskReview,
  onApprove,
  onReject,
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
          rejected ? "is-rejected" : ""
        } ${closing ? "is-closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label="Wallet approval review"
      >
        <div className="modal-header">
          <div>
            <span className="demo-badge compact">
              <WalletCards size={14} />
              Approval review
            </span>
            <h3>
              {approved
                ? "Approval review recorded"
                : rejected
                ? "Approval rejection recorded"
                : "Review draft"}
            </h3>
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
            <strong>{riskReview.level}</strong>
          </span>
          <span>
            Execution
            <strong>Disabled</strong>
          </span>
          <span>
            Approval
            <strong>
              {riskReview.explicitApprovalRequired
                ? "Required"
                : "Not required"}
            </strong>
          </span>
          <span>
            Signing state
            <strong>{formatSigningState(signingState)}</strong>
          </span>
        </div>

        <div
          className={`risk-review-panel risk-${riskReview.status}`}
          aria-label="NYX-05 risk review"
        >
          <div>
            <span>NYX-05 risk review</span>
            <strong>{formatRiskStatus(riskReview.status)}</strong>
          </div>
          <div className="risk-review-grid">
            <span>
              Permissions
              <strong>
                {riskReview.permissions.map(formatPermission).join(", ")}
              </strong>
            </span>
            <span>
              Safety
              <strong>
                {riskReview.refusalReason ?? riskReview.safetyCopy}
              </strong>
            </span>
          </div>
          <ul>
            {riskReview.checks.map((check) => <li key={check}>{check}</li>)}
          </ul>
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
            ? "Approval review is recorded locally. Real wallet signing remains disabled."
            : rejected
            ? "Approval rejection is recorded locally. No wallet prompt was opened."
            : "Kyra prepares review context only. Real wallet signing stays disabled."}
        </div>

        <div className="modal-actions">
          <button
            className="button button-ghost"
            type="button"
            onClick={onClose}
            disabled={approved || rejected}
          >
            Cancel
          </button>
          <button
            className="button button-ghost button-danger"
            type="button"
            onClick={onReject}
            disabled={approved || rejected}
          >
            Reject
          </button>
          <button
            className="button button-primary"
            type="button"
            onClick={onApprove}
            disabled={approved || rejected}
          >
            <CheckCircle2 size={17} />
            {approved ? "Recorded" : "Record Approval Review"}
          </button>
        </div>
      </section>
    </div>
  );
}

function formatSigningState(state: WalletSigningState) {
  return state.replace(/_/g, " ");
}

function formatRiskStatus(status: RiskReviewResult["status"]) {
  return status.replace(/_/g, " ");
}

function formatPermission(permission: RiskReviewResult["permissions"][number]) {
  return permission.replace(/_/g, " ");
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
