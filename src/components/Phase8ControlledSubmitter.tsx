import { useMemo, useState } from "react";
import { LoaderCircle, Send, ShieldCheck } from "lucide-react";
import { useBalance, useConnection, useSendTransaction } from "wagmi";
import { appConfig } from "../config/appConfig";
import type { FrozenPreparedAction } from "../types/dualApprovalExecution";
import type {
  Phase8ControlledSubmissionResult,
  Phase8ControlledSubmissionResultEvent,
} from "../types/phase8ControlledSubmission";
import type { Phase8OwnerLiveWindowActivationResult } from "../types/phase8OwnerLiveWindowActivation";
import type { Phase8RuntimeEnablementPreflightResult } from "../types/phase8RuntimeEnablementPreflight";
import { baseChainId } from "../types/unsignedTransactionHandoff";
import {
  createPhase8OwnerSubmitRequest,
  type Phase8OwnerSubmitRequestFailure,
} from "../types/phase8OwnerSubmitRequest";
import {
  createPhase8SubmittedCloseoutEvent,
  getPhase8SubmitterCloseoutFailureMessage,
} from "../types/phase8SubmitterCloseout";
import {
  evaluatePhase8FundingReadiness,
  formatPhase8BaseEth,
} from "../types/phase8FundingReadiness";

interface Phase8ControlledSubmitterProps {
  submission: Phase8ControlledSubmissionResult;
  activation: Phase8OwnerLiveWindowActivationResult;
  preflight: Phase8RuntimeEnablementPreflightResult;
  baseAccountAddress: `0x${string}` | null;
  submissionNonce: string | null;
  frozenAction: FrozenPreparedAction | null;
  onResultCloseout?: (event: Phase8ControlledSubmissionResultEvent) => void;
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
  preflight,
  baseAccountAddress,
  submissionNonce,
  frozenAction,
  onResultCloseout,
}: Phase8ControlledSubmitterProps) {
  const connection = useConnection();
  const sendTransaction = useSendTransaction();
  const baseGasBalance = useBalance({
    address: baseAccountAddress ?? undefined,
    chainId: baseChainId,
    query: {
      enabled: connection.status === "connected" && Boolean(baseAccountAddress),
      refetchInterval: 15_000,
    },
  });
  const [state, setState] = useState<SubmitterState>("locked");
  const [message, setMessage] = useState(
    "Owner transaction window is locked until sign-in, Base Account, approval, and gas checks are complete.",
  );
  const [submittedHash, setSubmittedHash] = useState<string | null>(null);

  const submitRequest = useMemo(
    () => createPhase8OwnerSubmitRequest(frozenAction),
    [frozenAction],
  );

  const runtimeEnabled =
    appConfig.integrations.phase8ControlledSubmission === "owner_approved_window";
  const walletConnected = connection.status === "connected";
  const fundingReadiness = evaluatePhase8FundingReadiness({
    walletConnected,
    baseAccountAddress,
    isLoading: baseGasBalance.isLoading,
    isError: baseGasBalance.isError,
    value: baseGasBalance.data?.value ?? null,
  });
  const gasReady = fundingReadiness.canOpenSubmitter;
  const canSubmit = Boolean(
    runtimeEnabled &&
      preflight.runtimeSubmitterEnabled &&
      walletConnected &&
      gasReady &&
      submission.transactionSubmissionAllowed &&
      activation.transactionSubmissionAllowed &&
      submitRequest.ok &&
      !sendTransaction.isPending,
  );

  async function handleSubmit() {
    if (!runtimeEnabled) {
      setState("locked");
      setMessage("Owner transaction submission is disabled for production safety.");
      return;
    }

    if (!preflight.runtimeSubmitterEnabled) {
      setState("locked");
      setMessage(preflight.message);
      return;
    }

    if (!walletConnected) {
      setState("locked");
      setMessage("Connect the owner Base Account before controlled submit.");
      return;
    }
    if (!gasReady) {
      setState("locked");
      setMessage(fundingReadiness.message);
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

    if (!frozenAction) {
      setState("locked");
      setMessage(failureCopy.frozen_action_required);
      return;
    }

    try {
      setState("submitting");
      setMessage("Opening Base Account for one owner-controlled zero-value submit...");
      const hash = await sendTransaction.sendTransactionAsync(submitRequest.request);
      const closeout = createPhase8SubmittedCloseoutEvent({
        ownerUserId: frozenAction.ownerUserId,
        workspaceId: frozenAction.workspaceId,
        agentId: frozenAction.agentId,
        preparedActionId: frozenAction.requestId,
        submissionNonce: submissionNonce ?? "",
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
      setMessage("Submitted with sanitized hash reference. Owner-only result closeout recorded.");
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
          <small>Owner transaction window</small>
          <strong>{activation.transactionSubmissionAllowed ? "Ready for owner review" : "Locked"}</strong>
        </div>
        <span>{state}</span>
      </div>

      <div className="phase-8-submit-boundary-grid">
        <span>
          Access
          <strong>{preflight.runtimeSubmitterEnabled ? "ready" : runtimeEnabled ? "waiting" : "disabled"}</strong>
        </span>
        <span>
          Wallet
          <strong>{walletConnected ? "connected" : "required"}</strong>
        </span>
        <span>
          Request
          <strong>{submitRequest.ok ? "reviewed" : "needs review"}</strong>
        </span>
        <span>
          Readiness
          <strong>{preflight.runtimeSubmitterEnabled ? "ready" : "waiting"}</strong>
        </span>
        <span>
          Base ETH gas
          <strong>{fundingReadiness.label}</strong>
        </span>
      </div>

      <p aria-live="polite">{activation.transactionSubmissionAllowed ? message : activation.message}</p>
      {preflight.reasons.length ? <small>{formatSubmitterGateReasons(preflight.reasons)}</small> : null}
      {activation.reasons.length ? <small>{formatSubmitterGateReasons(activation.reasons)}</small> : null}
      {fundingReadiness.status !== "funded"
        ? (
          <div className="phase-8-funding-guide">
            <strong>Funding required</strong>
            <span>{fundingReadiness.ownerAction}</span>
            <small>{fundingReadiness.privacyBoundary}</small>
          </div>
        )
        : (
          <small>Gas balance: {formatPhase8BaseEth(baseGasBalance.data?.value ?? 0n)} ETH on Base.</small>
        )}
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
        No Telegram, public profile, token approval, swap, calldata, non-zero value, seed phrase, or private-key path is allowed here.
      </small>
    </div>
  );
}


function formatSubmitterGateReasons(reasons: readonly string[]) {
  if (!reasons.length) {
    return "";
  }

  const labels = new Map<string, string>([
    ["owner_session_required", "sign in to the owner account"],
    ["selected_agent_required", "select a deployed agent"],
    ["base_account_required", "connect Base Account"],
    ["base_account_address_required", "connect Base Account"],
    ["base_chain_required", "switch to Base"],
    ["controlled_submission_required", "prepare the reviewed transaction"],
    ["operator_ack_required", "confirm owner review"],
    ["live_window_activation_required", "open the owner transaction window"],
    ["runtime_window_disabled", "enable the owner runtime window"],
    ["owner_approval_required", "record owner approval"],
    ["base_account_approval_required", "confirm in Base Account"],
    ["submission_nonce_required", "bind the one-time submit session"],
    ["private_dashboard_required", "use the private dashboard"],
    ["telegram_authority_forbidden", "Telegram cannot execute this action"],
  ]);

  const readable = reasons.map((reason) => labels.get(reason) ?? reason.replace(/_/g, " "));
  return `Needs: ${Array.from(new Set(readable)).join(", ")}.`;
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
