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
    "Controlled submission is locked until every Phase 8 Batch 1-10 gate passes.",
  );
  const [submittedHash, setSubmittedHash] = useState<string | null>(null);

  const submitRequest = useMemo(
    () => createPhase8OwnerSubmitRequest(frozenAction),
    [frozenAction],
  );

  const runtimeEnabled =
    appConfig.integrations.phase8ControlledSubmission === "owner_approved_window";
  const walletConnected = connection.status === "connected";
  const gasReadiness = getGasReadiness({
    walletConnected,
    baseAccountAddress,
    isLoading: baseGasBalance.isLoading,
    isError: baseGasBalance.isError,
    value: baseGasBalance.data?.value ?? null,
  });
  const gasReady = gasReadiness.status === "funded";
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
      setMessage("Phase 8 Batch 11 gas readiness is disabled for production safety.");
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
      setMessage(gasReadiness.message);
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
          <small>Phase 8 Batch 11 submitter</small>
          <strong>{activation.transactionSubmissionAllowed ? "Window armed" : "Window locked"}</strong>
        </div>
        <span>{state}</span>
      </div>

      <div className="phase-8-submit-boundary-grid">
        <span>
          Runtime
          <strong>{preflight.runtimeSubmitterEnabled ? "preflight ready" : runtimeEnabled ? "preflight locked" : "default-off"}</strong>
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
          Runtime preflight
          <strong>{preflight.status}</strong>
        </span>
        <span>
          Base ETH gas
          <strong>{gasReadiness.label}</strong>
        </span>
      </div>

      <p aria-live="polite">{activation.transactionSubmissionAllowed ? message : activation.message}</p>
      {preflight.reasons.length ? <small>Preflight blocked by: {preflight.reasons.join(", ")}</small> : null}
      {activation.reasons.length ? <small>Activation blocked by: {activation.reasons.join(", ")}</small> : null}
      {gasReadiness.status !== "funded" ? <small>{gasReadiness.message}</small> : <small>Gas balance: {formatBaseEth(baseGasBalance.data?.value ?? 0n)} ETH on Base.</small>}
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

type GasReadinessStatus = "wallet_required" | "address_required" | "checking" | "unavailable" | "empty" | "funded";

function getGasReadiness(input: {
  walletConnected: boolean;
  baseAccountAddress: `0x${string}` | null;
  isLoading: boolean;
  isError: boolean;
  value: bigint | null;
}): { status: GasReadinessStatus; label: string; message: string } {
  if (!input.walletConnected) {
    return {
      status: "wallet_required",
      label: "wallet required",
      message: "Connect the owner Base Account before checking gas readiness.",
    };
  }

  if (!input.baseAccountAddress) {
    return {
      status: "address_required",
      label: "address required",
      message: "Kyra needs the owner Base Account address before checking gas readiness.",
    };
  }

  if (input.isLoading) {
    return {
      status: "checking",
      label: "checking",
      message: "Checking native ETH gas balance on Base before opening the submit prompt.",
    };
  }

  if (input.isError || input.value === null) {
    return {
      status: "unavailable",
      label: "check failed",
      message: "Kyra could not verify Base ETH gas readiness. Retry after the wallet connection refreshes.",
    };
  }

  if (input.value <= 0n) {
    return {
      status: "empty",
      label: "0 ETH",
      message: "Add a small amount of ETH on Base to this Base Account before submitting. The transaction is zero-value, but gas still requires ETH.",
    };
  }

  return {
    status: "funded",
    label: `${formatBaseEth(input.value)} ETH`,
    message: "Base ETH gas balance is present for the owner-controlled submit.",
  };
}

function formatBaseEth(value: bigint) {
  const whole = value / 1_000_000_000_000_000_000n;
  const fractional = value % 1_000_000_000_000_000_000n;
  const fractionText = fractional.toString().padStart(18, "0").slice(0, 6).replace(/0+$/u, "");
  return fractionText ? `${whole}.${fractionText}` : whole.toString();
}
