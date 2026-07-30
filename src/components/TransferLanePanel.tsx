import {
  CheckCircle2,
  LoaderCircle,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatUnits } from "viem";
import { useConnection, useSendTransaction } from "wagmi";
import {
  createReviewedTransfer,
  kyraTokenAddress,
  kyraTransferDailyMaxAtomic,
  kyraTransferMaxAtomic,
  nativeTransferDailyMaxAtomic,
  nativeTransferMaxAtomic,
  type ReviewedTransferTransaction,
  type TransferAssetKind,
} from "../config/transferTransactionPolicy";
import { currentProductChain, type ProductChainKey } from "../config/productChains";
import type { KyraAuthSession } from "../services/supabaseAuthService";
import { persistTransactionResultCloseout } from "../services/transactionResultCloseoutService";
import {
  prepareTransferTransactionIntent,
} from "../services/transferTransactionIntentPrepareService";
import {
  createPhase8PersistedExecutionResult,
  type Phase8PersistedExecutionResult,
} from "../types/phase8ResultPersistence";
import { createPhase8SubmittedCloseoutEvent } from "../types/phase8SubmitterCloseout";
import { productChainId } from "../types/unsignedTransactionHandoff";
import type { OwnerWalletConnectionStatus } from "./OwnerWalletConnectionPanel";

interface TransferLanePanelProps {
  session: KyraAuthSession | null;
  workspaceId: string | null;
  agentId: string | null;
  agentName: string | null;
  agentChainKey: ProductChainKey | null;
  walletStatus: OwnerWalletConnectionStatus;
}

type TransferLaneState =
  | "draft"
  | "reviewed"
  | "preparing"
  | "prepared"
  | "submitting"
  | "submitted"
  | "confirmed"
  | "error";

interface PreparedTransfer {
  requestId: string;
  expiresAt: string;
  transaction: ReviewedTransferTransaction;
}

const initialMessage =
  "Choose an approved asset, recipient, and amount. Kyra will lock the exact transfer before your wallet opens.";

export function TransferLanePanel({
  session,
  workspaceId,
  agentId,
  agentName,
  agentChainKey,
  walletStatus,
}: TransferLanePanelProps) {
  const connection = useConnection();
  const sendTransaction = useSendTransaction();
  const [assetKind, setAssetKind] = useState<TransferAssetKind>("native");
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [laneState, setLaneState] = useState<TransferLaneState>("draft");
  const [message, setMessage] = useState(initialMessage);
  const [reviewed, setReviewed] = useState<ReviewedTransferTransaction | null>(
    null,
  );
  const [prepared, setPrepared] = useState<PreparedTransfer | null>(null);
  const [closeoutRecord, setCloseoutRecord] =
    useState<Phase8PersistedExecutionResult | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);

  const walletBound = Boolean(
    walletStatus.connected &&
      walletStatus.address &&
      connection.status === "connected" &&
      connection.address === walletStatus.address &&
      connection.chainId === productChainId &&
      walletStatus.chainId === productChainId &&
      agentChainKey === currentProductChain.key,
  );
  const scopeReady = Boolean(session && workspaceId && agentId && walletBound);
  const stateScopeKey = [
    session?.user.id ?? "",
    workspaceId ?? "",
    agentId ?? "",
    agentChainKey ?? "",
    walletStatus.address ?? "",
    walletStatus.chainId ?? "",
  ].join(":");
  const actionLimitLabel = assetKind === "native"
    ? `${formatUnits(nativeTransferMaxAtomic, 18)} ETH`
    : `${formatUnits(kyraTransferMaxAtomic, 18)} KYRA`;
  const dailyLimitLabel = assetKind === "native"
    ? `${formatUnits(nativeTransferDailyMaxAtomic, 18)} ETH`
    : `${formatUnits(kyraTransferDailyMaxAtomic, 18)} KYRA`;
  const preparedExpired = Boolean(
    prepared && Date.parse(prepared.expiresAt) <= Date.now(),
  );
  const canPrepare = Boolean(
    laneState === "reviewed" && reviewed && scopeReady,
  );
  const canSubmit = Boolean(
    laneState === "prepared" &&
      prepared &&
      !preparedExpired &&
      scopeReady &&
      !sendTransaction.isPending,
  );
  const reviewSummary = useMemo(
    () =>
      reviewed
        ? {
          asset: reviewed.tokenSymbol,
          amount: formatUnits(BigInt(reviewed.amountAtomic), reviewed.tokenDecimals),
          recipient: maskAddress(reviewed.recipient),
          sender: maskAddress(reviewed.sender),
        }
        : null,
    [reviewed],
  );

  useEffect(() => {
    setLaneState("draft");
    setMessage(initialMessage);
    setReviewed(null);
    setPrepared(null);
    setCloseoutRecord(null);
    setTxHash(null);
  }, [stateScopeKey]);

  function resetReview(nextMessage = initialMessage) {
    setLaneState("draft");
    setMessage(nextMessage);
    setReviewed(null);
    setPrepared(null);
    setCloseoutRecord(null);
    setTxHash(null);
  }

  function handleReview() {
    if (!walletBound || !walletStatus.address) {
      resetReview("Connect a wallet to the selected agent on Robinhood Chain first.");
      return;
    }

    const result = createReviewedTransfer({
      sender: walletStatus.address,
      recipient,
      assetKind,
      amount,
    });
    if (!result.ok) {
      setLaneState("error");
      setMessage(result.message);
      setReviewed(null);
      setPrepared(null);
      return;
    }

    setReviewed(result.transaction);
    setPrepared(null);
    setLaneState("reviewed");
    setMessage(
      "Review the locked summary. Preparing it will reserve this exact transfer for ten minutes.",
    );
  }

  async function handlePrepare() {
    if (!session || !workspaceId || !agentId || !reviewed || !canPrepare) {
      setLaneState("error");
      setMessage("A signed-in account, selected agent, and bound wallet are required.");
      return;
    }

    let requestId: string;
    try {
      requestId = createSecureId("transfer");
    } catch {
      setLaneState("error");
      setMessage("Secure browser randomness is required to prepare a transfer.");
      return;
    }

    setLaneState("preparing");
    setMessage("Locking the reviewed transfer in the private Kyra backend...");
    const result = await prepareTransferTransactionIntent(session, {
      workspaceId,
      agentId,
      requestId,
      transaction: reviewed,
    });
    if (!result.ok) {
      setLaneState("error");
      setMessage(result.message);
      return;
    }

    setPrepared({
      requestId,
      expiresAt: result.expiresAt,
      transaction: reviewed,
    });
    setLaneState("prepared");
    setMessage(
      "Transfer locked. Confirm once more, then approve the exact request inside your wallet.",
    );
  }

  async function handleSubmit() {
    if (
      !session ||
      !workspaceId ||
      !agentId ||
      !prepared ||
      Date.parse(prepared.expiresAt) <= Date.now() ||
      !canSubmit
    ) {
      setLaneState("error");
      setMessage(
        preparedExpired
          ? "This transfer review expired. Review it again before opening the wallet."
          : "The private transfer gate is not ready.",
      );
      return;
    }

    const transaction = prepared.transaction;
    const to = transaction.assetKind === "native"
      ? transaction.recipient
      : transaction.tokenAddress;
    if (!to) {
      setLaneState("error");
      setMessage("The reviewed token transfer is missing its official contract.");
      return;
    }

    let hash: `0x${string}`;
    try {
      setLaneState("submitting");
      setMessage("Waiting for explicit confirmation in your wallet...");
      hash = await sendTransaction.sendTransactionAsync({
        account: transaction.sender,
        chainId: productChainId,
        to,
        value: BigInt(transaction.valueWei),
        data: transaction.data,
      });
    } catch (error) {
      setLaneState("prepared");
      setMessage(classifyWalletError(error));
      return;
    }

    setTxHash(hash);
    setLaneState("submitted");
    setMessage("Transaction submitted. Preparing private receipt verification...");

    try {
      const createdAt = new Date().toISOString();
      const submissionNonce = createSecureId("transfer-submit");
      const closeoutEvent = createPhase8SubmittedCloseoutEvent({
        ownerUserId: session.user.id,
        workspaceId,
        agentId,
        preparedActionId: prepared.requestId,
        submissionNonce,
        txHash: hash,
        createdAt,
      });
      if (!closeoutEvent.ok || !closeoutEvent.event) {
        setMessage("Transaction submitted. Private receipt closeout is pending.");
        return;
      }

      const persisted = createPhase8PersistedExecutionResult({
        ownerUserId: session.user.id,
        workspaceId,
        agentId,
        preparedActionId: prepared.requestId,
        submissionNonce,
        event: closeoutEvent.event,
      });
      if (!persisted.ok || !persisted.record) {
        setMessage("Transaction submitted. Private receipt closeout is pending.");
        return;
      }

      setCloseoutRecord(persisted.record);
      await syncCloseout(session, persisted.record);
    } catch {
      setMessage("Transaction submitted. Private receipt closeout is pending.");
    }
  }
  async function syncCloseout(
    currentSession: KyraAuthSession,
    record: Phase8PersistedExecutionResult,
  ) {
    setMessage("Verifying the submitted transaction with the private backend...");
    const closeout = await persistTransactionResultCloseout(
      currentSession,
      record,
    );
    if (closeout.status !== "saved") {
      setLaneState("submitted");
      setMessage(
        "Transaction submitted. Receipt verification is pending and can be refreshed safely.",
      );
      return;
    }

    setLaneState(
      closeout.verifiedStatus === "confirmed"
        ? "confirmed"
        : closeout.verifiedStatus === "failed"
        ? "error"
        : "submitted",
    );
    setMessage(closeout.message);
  }

  return (
    <section className={`transfer-lane-panel state-${laneState}`}>
      <div className="transfer-lane-heading">
        <div>
          <span className="transfer-lane-kicker">
            <ShieldCheck size={15} />
            Private transfer lane
          </span>
          <h3>Send on Robinhood Chain</h3>
          <p>
            Transfer native ETH or the official KYRA token from your connected
            wallet. Every detail is reviewed, locked, and confirmed by you.
          </p>
        </div>
        <span className="transfer-lane-state">
          {laneState === "confirmed"
            ? <CheckCircle2 size={15} />
            : <LockKeyhole size={15} />}
          {formatState(laneState)}
        </span>
      </div>

      <div className="transfer-lane-assets" aria-label="Transfer asset">
        <button
          className={assetKind === "native" ? "is-selected" : ""}
          type="button"
          onClick={() => {
            setAssetKind("native");
            resetReview();
          }}
          disabled={laneState === "preparing" || laneState === "submitting"}
        >
          <span>ETH</span>
          <small>Robinhood Chain native gas asset</small>
        </button>
        <button
          className={assetKind === "erc20" ? "is-selected" : ""}
          type="button"
          onClick={() => {
            setAssetKind("erc20");
            resetReview();
          }}
          disabled={laneState === "preparing" || laneState === "submitting"}
        >
          <span>KYRA</span>
          <small>Official token only</small>
        </button>
      </div>

      <div className="transfer-lane-form">
        <label>
          Recipient
          <input
            autoComplete="off"
            inputMode="text"
            placeholder="0x..."
            spellCheck={false}
            value={recipient}
            onChange={(event) => {
              setRecipient(event.target.value.trim());
              resetReview();
            }}
            disabled={laneState === "preparing" || laneState === "submitting"}
          />
        </label>
        <label>
          Amount
          <div className="transfer-amount-input">
            <input
              autoComplete="off"
              inputMode="decimal"
              placeholder={assetKind === "native" ? "0.001" : "100"}
              value={amount}
              onChange={(event) => {
                setAmount(event.target.value);
                resetReview();
              }}
              disabled={laneState === "preparing" || laneState === "submitting"}
            />
            <span>{assetKind === "native" ? "ETH" : "KYRA"}</span>
          </div>
        </label>
      </div>

      <div className="transfer-lane-limits">
        <span>Per transfer <strong>{actionLimitLabel}</strong></span>
        <span>Daily review cap <strong>{dailyLimitLabel}</strong></span>
        <span>Network <strong>{currentProductChain.name}</strong></span>
      </div>

      {assetKind === "erc20" ? (
        <div className="transfer-token-contract">
          <span>Official KYRA contract</span>
          <code>{kyraTokenAddress}</code>
        </div>
      ) : null}

      {reviewSummary ? (
        <div className="transfer-review-summary">
          <span><small>From</small><strong>{reviewSummary.sender}</strong></span>
          <span><small>To</small><strong>{reviewSummary.recipient}</strong></span>
          <span><small>Asset</small><strong>{reviewSummary.asset}</strong></span>
          <span><small>Amount</small><strong>{reviewSummary.amount}</strong></span>
        </div>
      ) : null}

      <p className="transfer-lane-message" aria-live="polite">{message}</p>
      {txHash ? <small className="transfer-hash">Hash: {maskHash(txHash)}</small> : null}

      <div className="transfer-lane-actions">
        {laneState === "draft" || laneState === "error" ? (
          <button
            className="button button-primary"
            type="button"
            onClick={handleReview}
            disabled={!scopeReady}
          >
            <ShieldCheck size={16} />
            Review transfer
          </button>
        ) : null}
        {laneState === "reviewed" ? (
          <>
            <button className="button button-ghost" type="button" onClick={() => resetReview()}>
              Edit
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void handlePrepare()}
              disabled={!canPrepare}
            >
              <LockKeyhole size={16} />
              Lock transfer
            </button>
          </>
        ) : null}
        {laneState === "preparing" ? (
          <button className="button button-primary" type="button" disabled>
            <LoaderCircle className="spin-icon" size={16} />
            Locking transfer
          </button>
        ) : null}
        {laneState === "prepared" ? (
          <>
            <button className="button button-ghost" type="button" onClick={() => resetReview()}>
              Cancel
            </button>
            <button
              className="button button-primary"
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit}
            >
              <WalletCards size={16} />
              Confirm in wallet
            </button>
          </>
        ) : null}
        {laneState === "submitting" ? (
          <button className="button button-primary" type="button" disabled>
            <LoaderCircle className="spin-icon" size={16} />
            Waiting for wallet
          </button>
        ) : null}
        {(laneState === "submitted" || laneState === "confirmed") ? (
          <>
            <button className="button button-ghost" type="button" onClick={() => resetReview()}>
              New transfer
            </button>
            {laneState !== "confirmed" && closeoutRecord && session ? (
              <button
                className="button button-primary"
                type="button"
                onClick={() => void syncCloseout(session, closeoutRecord)}
              >
                <RefreshCw size={16} />
                Refresh receipt
              </button>
            ) : laneState === "confirmed" ? (
              <span className="transfer-confirmed-label">
                <CheckCircle2 size={16} />
                Confirmed
              </span>
            ) : (
              <span className="transfer-pending-label">Receipt pending</span>
            )}
          </>
        ) : null}
      </div>

      <small className="transfer-lane-boundary">
        Private dashboard only. No Telegram execution, token approval, swap,
        arbitrary contract, hidden calldata, seed phrase, or private-key path.
      </small>
      {!scopeReady ? (
        <small className="transfer-lane-requirement">
          Sign in, select a deployed agent, and connect its wallet to continue.
        </small>
      ) : (
        <small className="transfer-lane-agent">
          Bound to {agentName || "selected agent"} and {maskAddress(walletStatus.address!)}.
        </small>
      )}
    </section>
  );
}

function createSecureId(prefix: string) {
  if (!globalThis.crypto?.randomUUID) {
    throw new Error("secure randomness unavailable");
  }
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function classifyWalletError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    (("code" in error && error.code === 4001) ||
      ("name" in error &&
        typeof error.name === "string" &&
        error.name.toLowerCase().includes("userrejected")))
  ) {
    return "Wallet confirmation was rejected. The locked transfer was not submitted.";
  }
  return "Wallet submission failed safely. Review the wallet network and try again.";
}

function formatState(state: TransferLaneState) {
  switch (state) {
    case "draft":
      return "Draft";
    case "reviewed":
      return "Reviewed";
    case "preparing":
      return "Locking";
    case "prepared":
      return "Locked";
    case "submitting":
      return "Wallet open";
    case "submitted":
      return "Submitted";
    case "confirmed":
      return "Confirmed";
    case "error":
      return "Needs review";
  }
}

function maskAddress(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function maskHash(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}
