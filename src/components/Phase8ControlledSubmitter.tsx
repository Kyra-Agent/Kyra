import { useMemo, useState } from "react";
import { LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { useConnection, useSendTransaction } from "wagmi";
import { appConfig } from "../config/appConfig";
import type { FrozenPreparedAction } from "../types/dualApprovalExecution";
import type { Phase8ControlledSubmissionResult } from "../types/phase8ControlledSubmission";
import type { Phase8OwnerLiveWindowActivationResult } from "../types/phase8OwnerLiveWindowActivation";
import {
  createPhase8OwnerSubmitRequest,
  type Phase8OwnerSubmitRequestFailure,
} from "../types/phase8OwnerSubmitRequest";

interface Phase8ControlledSubmitterProps {
  submission: Phase8ControlledSubmissionResult;
  activation: Phase8OwnerLiveWindowActivationResult;
  frozenAction: FrozenPreparedAction | null;
}

type SubmitterState = "locked" | "ready" | "submitting" | "submitted" | "failed";

const failureCopy: Record<Phase8OwnerSubmitRequestFailure, string> = {
  frozen_action_required: "A frozen reviewed action is required.",
  base_chain_required: "Only Base mainnet is allowed for this controlled submit.",
  zero_value_required: "Only the zero-value first transaction is allowed.",
  no_calldata_required: "Calldata is blocked for this controlled submit.",
  recipient_required: "A valid Base recipient is required.",
};

export function Phase8ControlledSubmitter({
  submission,
  activation,
  frozenAction,
}: Phase8ControlledSubmitterProps) {
  const connection = useConnection();
  const sendTransaction = useSendTransaction();
  const [state, setState] = useState<SubmitterState>("locked");
  const [message, setMessage] = useState(
    "Controlled submission is locked until every Phase 8 Batch 1-6 gate passes.",
  );
  const [submittedHash, setSubmittedHash] = useState<string | null>(null);

  const submitRequest = useMemo(
    () => createPhase8OwnerSubmitRequest(frozenAction),
    [frozenAction],
  );

  const runtimeEnabled =
    appConfig.integrations.phase8ControlledSubmission === "owner_approved_window";
  const walletConnected = connection.status === "connected";
  const canSubmit = Boolean(
    runtimeEnabled &&
      walletConnected &&
      submission.transactionSubmissionAllowed &&
      activation.transactionSubmissionAllowed &&
      submitRequest.ok &&
      !sendTransaction.isPending,
  );

  async function handleSubmit() {
    if (!runtimeEnabled) {
      setState("locked");
      setMessage("Phase 8 Batch 7 live-window runtime is disabled for production safety.");
      return;
    }

    if (!walletConnected) {
      setState("locked");
      setMessage("Connect the owner Base Account before controlled submit.");
      return;
    }

    if (!submission.transactionSubmissionAllowed) {
      setState("locked");
      setMessage(submission.message);
      return;
    }

    if (!activation.transactionSubmissionAllowed) {
      setState("locked");
      setMessage(activation.message);
      return;
    }

    if (!submitRequest.ok) {
      setState("locked");
      setMessage(failureCopy[submitRequest.reason]);
      return;
    }

    try {
      setState("submitting");
      setMessage("Opening Base Account for one owner-controlled zero-value submit...");
      const hash = await sendTransaction.sendTransactionAsync(submitRequest.request);
      setSubmittedHash(hash);
      setState("submitted");
      setMessage("Submitted. Owner-only result closeout should record the sanitized hash reference.");
    } catch (error) {
      setSubmittedHash(null);
      setState("failed");
      setMessage(classifySubmitError(error));
    }
  }

  return (
    <div className={`phase-8-submit-boundary submit-${state}`}>
      <div className="phase-8-submit-boundary-header">
        <span className="queue-icon"><ShieldCheck size={16} /></span>
        <div>
          <small>Phase 8 Batch 7 submitter</small>
          <strong>{activation.transactionSubmissionAllowed ? "Window armed" : "Window locked"}</strong>
        </div>
        <span>{state}</span>
      </div>

      <div className="phase-8-submit-boundary-grid">
        <span>
          Runtime
          <strong>{runtimeEnabled ? "owner window" : "default-off"}</strong>
        </span>
        <span>
          Wallet
          <strong>{walletConnected ? "connected" : "required"}</strong>
        </span>
        <span>
          Request
          <strong>{submitRequest.ok ? "zero-value" : submitRequest.reason}</strong>
        </span>
        <span>
          Activation
          <strong>{activation.status}</strong>
        </span>
      </div>

      <p aria-live="polite">{activation.transactionSubmissionAllowed ? message : activation.message}</p>
      {activation.reasons.length ? <small>Activation blocked by: {activation.reasons.join(", ")}</small> : null}
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
        Submit controlled transaction
      </button>
      <small>
        No Telegram, public profile, token approval, swap, calldata, or non-zero value path is allowed here.
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
    return "Owner rejected the Base Account submit prompt.";
  }

  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === 4001
  ) {
    return "Owner rejected the Base Account submit prompt.";
  }

  return "Controlled submit failed safely before closeout.";
}

function maskHash(hash: string) {
  return hash.length > 18 ? `${hash.slice(0, 10)}...${hash.slice(-8)}` : hash;
}
