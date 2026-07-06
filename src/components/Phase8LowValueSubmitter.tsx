import { LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { useConnection, useSendTransaction } from "wagmi";
import { appConfig } from "../config/appConfig";
import type { Phase8ControlledSubmissionResultEvent } from "../types/phase8ControlledSubmission";
import type { Phase8LowValueSubmitRequestResult } from "../types/phase8LowValueSubmitRequest";
import {
  createPhase8SubmittedCloseoutEvent,
  getPhase8SubmitterCloseoutFailureMessage,
} from "../types/phase8SubmitterCloseout";
import type { Phase8LowValueTransactionReadinessResult } from "../types/phase8LowValueTransactionReadiness";

interface Phase8LowValueSubmitterProps {
  readiness: Phase8LowValueTransactionReadinessResult;
  submitRequest: Phase8LowValueSubmitRequestResult;
  ownerWindowArmed: boolean;
  resultAlreadyRecorded: boolean;
  securityCanOpenSubmitter: boolean;
  securityBlockReasons: string[];
  closeoutScope: {
    ownerUserId: string;
    workspaceId: string;
    agentId: string;
    preparedActionId: string;
    submissionNonce: string;
  };
  onResultCloseout?: (event: Phase8ControlledSubmissionResultEvent) => void;
}

type LowValueSubmitterState = "locked" | "ready" | "submitting" | "submitted" | "failed";

export function Phase8LowValueSubmitter({
  readiness,
  submitRequest,
  ownerWindowArmed,
  resultAlreadyRecorded,
  securityCanOpenSubmitter,
  securityBlockReasons,
  closeoutScope,
  onResultCloseout,
}: Phase8LowValueSubmitterProps) {
  const connection = useConnection();
  const sendTransaction = useSendTransaction();
  const [state, setState] = useState<LowValueSubmitterState>("locked");
  const [message, setMessage] = useState(
    "Low-value submission is locked until the owner-controlled transaction window is ready.",
  );
  const [submittedHash, setSubmittedHash] = useState<string | null>(null);

  const runtimeEnabled =
    appConfig.integrations.phase8LowValueSubmission === "owner_low_value_window";
  const walletConnected = connection.status === "connected";
  const hasCloseoutScope = Boolean(
    closeoutScope.ownerUserId.trim() &&
      closeoutScope.workspaceId.trim() &&
      closeoutScope.agentId.trim() &&
      closeoutScope.preparedActionId.trim() &&
      closeoutScope.submissionNonce.trim(),
  );
  const canSubmit = Boolean(
    runtimeEnabled &&
      walletConnected &&
      ownerWindowArmed &&
      !resultAlreadyRecorded &&
      securityCanOpenSubmitter &&
      hasCloseoutScope &&
      readiness.canEnterLowValueReview &&
      submitRequest.ok &&
      !sendTransaction.isPending,
  );

  async function handleSubmit() {
    if (!runtimeEnabled) {
      setState("locked");
      setMessage("Low-value submission is disabled for production safety.");
      return;
    }

    if (!walletConnected) {
      setState("locked");
      setMessage("Connect the owner Base Account before low-value submit.");
      return;
    }

    if (!ownerWindowArmed) {
      setState("locked");
      setMessage("Owner live window must be armed before low-value submit.");
      return;
    }

    if (resultAlreadyRecorded) {
      setState("locked");
      setMessage("Low-value submitter is locked after an owner-only result is recorded.");
      return;
    }

    if (!securityCanOpenSubmitter) {
      setState("locked");
      setMessage("Security hardening blocked this submitter window.");
      return;
    }

    if (!hasCloseoutScope) {
      setState("locked");
      setMessage("Owner closeout scope must be complete before low-value submit.");
      return;
    }

    if (!readiness.canEnterLowValueReview) {
      setState("locked");
      setMessage(readiness.message);
      return;
    }

    if (!submitRequest.ok) {
      setState("locked");
      setMessage(submitRequest.message);
      return;
    }

    try {
      setSubmittedHash(null);
      setState("submitting");
      setMessage("Opening Base Account for one owner-controlled low-value submit...");
      const hash = await sendTransaction.sendTransactionAsync(submitRequest.request);
      const closeout = createPhase8SubmittedCloseoutEvent({
        ownerUserId: closeoutScope.ownerUserId,
        workspaceId: closeoutScope.workspaceId,
        agentId: closeoutScope.agentId,
        preparedActionId: closeoutScope.preparedActionId,
        submissionNonce: closeoutScope.submissionNonce,
        txHash: hash,
        createdAt: new Date().toISOString(),
      });

      if (!closeout.ok || !closeout.event) {
        setSubmittedHash(null);
        setState("failed");
        setMessage(getPhase8SubmitterCloseoutFailureMessage(closeout.reason ?? "transaction_hash_required"));
        return;
      }

      setSubmittedHash(hash);
      onResultCloseout?.(closeout.event);
      setState("submitted");
      setMessage("Low-value submit request sent and owner-only closeout recorded.");
    } catch (error) {
      setSubmittedHash(null);
      setState("failed");
      setMessage(classifySubmitError(error));
    }
  }

  return (
    <div className={`phase-8-low-value-submitter submit-${state}`}>
      <div className="phase-8-submit-boundary-header">
        <span className="queue-icon"><ShieldCheck size={16} /></span>
        <div>
          <small>Low-value transaction window</small>
          <strong>{runtimeEnabled ? "ready for owner review" : "locked"}</strong>
        </div>
        <span>{state}</span>
      </div>

      <div className="phase-8-low-value-submitter-grid">
        <span>
          Access
          <strong>{runtimeEnabled ? "ready" : "locked"}</strong>
        </span>
        <span>
          Wallet
          <strong>{walletConnected ? "connected" : "required"}</strong>
        </span>
        <span>
          Review window
          <strong>{ownerWindowArmed ? "armed" : "locked"}</strong>
        </span>
        <span>
          Request
          <strong>{submitRequest.ok ? "low-value capped" : "blocked"}</strong>
        </span>
        <span>
          Security
          <strong>{securityCanOpenSubmitter ? "hardened" : "blocked"}</strong>
        </span>
        <span>
          Closeout scope
          <strong>{hasCloseoutScope ? "complete" : "required"}</strong>
        </span>
      </div>

      <p aria-live="polite">{message}</p>
      {!readiness.canEnterLowValueReview
        ? <small>Needs: complete low-value readiness checks.</small>
        : null}
      {!submitRequest.ok
        ? <small>Needs: prepare a reviewed low-value request.</small>
        : null}
      {securityBlockReasons.length
        ? <small>Needs: security checks must pass before submission.</small>
        : null}
      {!hasCloseoutScope
        ? <small>Needs: complete owner, workspace, agent, action, and session scope.</small>
        : null}
      {submittedHash ? <small>Hash: {maskHash(submittedHash)}</small> : null}

      <button
        className="button button-primary"
        type="button"
        onClick={() => void handleSubmit()}
        disabled={!canSubmit}
      >
        {sendTransaction.isPending
          ? <LoaderCircle className="spin-icon" size={16} />
          : <Send size={16} />}
        Submit low-value transaction
      </button>
      <small>
        Isolated owner-dashboard gate only. Telegram, public profiles, token approvals,
        swaps, arbitrary calldata, seed phrases, and private keys remain blocked.
      </small>
    </div>
  );
}

function classifySubmitError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "name" in error &&
    typeof error.name === "string" &&
    error.name.toLowerCase().includes("userrejected")
  ) {
    return "Owner rejected the Base Account low-value submit prompt.";
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 4001
  ) {
    return "Owner rejected the Base Account low-value submit prompt.";
  }

  return "Low-value submit failed safely inside the isolated gate.";
}

function maskHash(hash: string) {
  return hash.length > 18 ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : hash;
}
