import {
  ArrowLeftRight,
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
import { currentProductChain, type ProductChainKey } from "../config/productChains";
import {
  createReviewedSwapQuoteRequest,
  type ReviewedSwapQuoteRequest,
  type SwapTokenSymbol,
} from "../config/swapQuotePolicy";
import type { KyraAuthSession } from "../services/supabaseAuthService";
import {
  closeProtectedSwapResult,
  prepareProtectedSwapExecution,
  type PreparedSwapExecution,
  type SwapExecutionNextAction,
  type SwapExecutionStep,
} from "../services/swapExecutionService";
import {
  prepareProtectedSwapQuote,
  type SwapQuoteSummary,
} from "../services/swapQuotePrepareService";
import { productChainId } from "../types/unsignedTransactionHandoff";
import type { OwnerWalletConnectionStatus } from "./OwnerWalletConnectionPanel";

interface ProtectedSwapLanePanelProps {
  session: KyraAuthSession | null;
  workspaceId: string | null;
  agentId: string | null;
  agentName: string | null;
  agentChainKey: ProductChainKey | null;
  walletStatus: OwnerWalletConnectionStatus;
}

type SwapLaneState =
  | "draft"
  | "quoting"
  | "quoted"
  | "preparing"
  | "prepared"
  | "submitting"
  | "submitted"
  | "confirmed"
  | "complete"
  | "error";

interface QuoteContext {
  request: ReviewedSwapQuoteRequest;
  quote: SwapQuoteSummary;
}

const initialMessage =
  "Choose ETH or KYRA and request a private, time-limited quote. Nothing opens in your wallet until you approve the next step.";
const slippageOptions = [50, 100, 200] as const;

export function ProtectedSwapLanePanel({
  session,
  workspaceId,
  agentId,
  agentName,
  agentChainKey,
  walletStatus,
}: ProtectedSwapLanePanelProps) {
  const connection = useConnection();
  const sendTransaction = useSendTransaction();
  const [sellToken, setSellToken] = useState<SwapTokenSymbol>("ETH");
  const [amount, setAmount] = useState("");
  const [slippageBps, setSlippageBps] = useState<number>(50);
  const [laneState, setLaneState] = useState<SwapLaneState>("draft");
  const [message, setMessage] = useState(initialMessage);
  const [quoteContext, setQuoteContext] = useState<QuoteContext | null>(null);
  const [prepared, setPrepared] = useState<PreparedSwapExecution | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [nextAction, setNextAction] = useState<SwapExecutionNextAction | null>(null);

  const buyToken: SwapTokenSymbol = sellToken === "ETH" ? "KYRA" : "ETH";
  const walletBound = Boolean(
    walletStatus.connected && walletStatus.address &&
      connection.status === "connected" &&
      connection.address.toLowerCase() === walletStatus.address.toLowerCase() &&
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
  const quoteExpired = Boolean(
    quoteContext && Date.parse(quoteContext.quote.expiresAt) <= Date.now(),
  );
  const preparedExpired = Boolean(
    prepared && Date.parse(prepared.expiresAt) <= Date.now(),
  );
  const quoteSummary = useMemo(() => {
    if (!quoteContext) return null;
    return {
      sell: `${formatUnits(BigInt(quoteContext.quote.sellAmount), 18)} ${quoteContext.quote.sellTokenSymbol}`,
      receive: `${formatUnits(BigInt(quoteContext.quote.buyAmount), 18)} ${quoteContext.quote.buyTokenSymbol}`,
      minimum: `${formatUnits(BigInt(quoteContext.quote.minimumBuyAmount), 18)} ${quoteContext.quote.buyTokenSymbol}`,
      expires: new Date(quoteContext.quote.expiresAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      }),
    };
  }, [quoteContext]);

  useEffect(() => {
    resetFlow();
  // Scope changes must discard every quote, intent, and hash from browser memory.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateScopeKey]);

  function resetFlow(nextMessage = initialMessage) {
    setLaneState("draft");
    setMessage(nextMessage);
    setQuoteContext(null);
    setPrepared(null);
    setTxHash(null);
    setNextAction(null);
  }

  function editSwap() {
    resetFlow();
  }

  async function handleQuote() {
    if (!session || !workspaceId || !agentId || !walletStatus.address || !scopeReady) {
      resetFlow("Sign in, select a Robinhood Chain agent, and connect its wallet first.");
      return;
    }
    let requestId: string;
    try {
      requestId = createSecureId("swap-quote");
    } catch {
      setLaneState("error");
      setMessage("Secure browser randomness is required to request a swap quote.");
      return;
    }
    const reviewed = createReviewedSwapQuoteRequest({
      workspaceId,
      agentId,
      requestId,
      taker: walletStatus.address,
      sellTokenSymbol: sellToken,
      buyTokenSymbol: buyToken,
      sellAmount: amount,
      slippageBps,
    });
    if (!reviewed.ok) {
      setLaneState("error");
      setMessage(reviewed.message);
      setQuoteContext(null);
      return;
    }

    setLaneState("quoting");
    setMessage("Requesting a private Robinhood Chain quote from the protected backend...");
    setPrepared(null);
    setTxHash(null);
    setNextAction(null);
    const result = await prepareProtectedSwapQuote(session, reviewed.request);
    if (!result.ok) {
      setLaneState("error");
      setMessage(result.message);
      setQuoteContext(null);
      return;
    }
    setQuoteContext({ request: reviewed.request, quote: result.quote });
    setLaneState("quoted");
    setMessage(result.quote.allowanceRequired
      ? "Quote reviewed. KYRA needs one exact, limited allowance before a fresh swap quote can be requested."
      : "Quote reviewed. Lock the exact swap before opening your wallet.");
  }

  async function handlePrepare(step: SwapExecutionStep) {
    if (!session || !workspaceId || !agentId || !walletStatus.address || !quoteContext || !scopeReady) {
      setLaneState("error");
      setMessage("The private account, agent, wallet, and quote scope must all match.");
      return;
    }
    if (quoteExpired && step !== "allowance_revoke") {
      setLaneState("error");
      setMessage("This quote expired. Request a fresh quote before opening your wallet.");
      return;
    }
    let requestId: string;
    try {
      requestId = createSecureId(`swap-${step}`);
    } catch {
      setLaneState("error");
      setMessage("Secure browser randomness is required to lock this swap step.");
      return;
    }
    setLaneState("preparing");
    setMessage(`Locking the exact ${formatStep(step)} in the private backend...`);
    const result = await prepareProtectedSwapExecution(session, {
      workspaceId,
      agentId,
      quoteRecordId: quoteContext.quote.quoteRecordId,
      requestId,
      step,
      sender: walletStatus.address,
    });
    if (!result.ok) {
      setLaneState("error");
      setMessage(result.message);
      return;
    }
    setPrepared(result.prepared);
    setTxHash(null);
    setNextAction(null);
    setLaneState("prepared");
    setMessage(`The exact ${formatStep(step)} is locked. Confirm it explicitly inside your wallet.`);
  }

  async function handleSubmit() {
    if (
      !session || !workspaceId || !agentId || !prepared || !scopeReady ||
      preparedExpired ||
      prepared.sender.toLowerCase() !== walletStatus.address?.toLowerCase()
    ) {
      setLaneState("error");
      setMessage(preparedExpired
        ? "This locked swap step expired. Request a fresh quote and review it again."
        : "The private swap execution gate is not ready.");
      return;
    }
    let hash: `0x${string}`;
    try {
      setLaneState("submitting");
      setMessage(`Waiting for explicit wallet confirmation of the ${formatStep(prepared.step)}...`);
      hash = await sendTransaction.sendTransactionAsync({
        account: prepared.sender,
        chainId: productChainId,
        to: prepared.transaction.to,
        data: prepared.transaction.data,
        value: BigInt(prepared.transaction.valueWei),
      });
    } catch (error) {
      setLaneState("prepared");
      setMessage(classifyWalletError(error, prepared.step));
      return;
    }
    setTxHash(hash);
    setLaneState("submitted");
    setMessage("Transaction submitted. Verifying the receipt in the owner-only backend...");
    await syncCloseout(hash, prepared);
  }

  async function syncCloseout(hash: `0x${string}`, intent: PreparedSwapExecution) {
    if (!session || !workspaceId || !agentId) return;
    const result = await closeProtectedSwapResult(session, {
      workspaceId,
      agentId,
      intentRecordId: intent.intentRecordId,
      requestId: intent.requestId,
      txHash: hash,
    });
    if (!result.ok) {
      setLaneState("submitted");
      setMessage("Transaction submitted. Receipt verification is pending and can be refreshed safely.");
      return;
    }
    setNextAction(result.nextAction);
    if (result.status === "submitted") {
      setLaneState("submitted");
      setMessage("Receipt is pending. Refresh before continuing to another protected step.");
      return;
    }
    if (result.status === "failed") {
      setLaneState("error");
      setMessage(result.nextAction === "revoke_allowance"
        ? "The swap failed. Revoke the temporary KYRA allowance before starting over."
        : `The ${formatStep(result.step)} failed and can be reviewed again safely.`);
      return;
    }
    setLaneState(result.nextAction === "complete" ? "complete" : "confirmed");
    setMessage(messageForNextAction(result.nextAction));
  }

  async function handleNextAction() {
    if (nextAction === "request_fresh_quote") {
      await handleQuote();
      return;
    }
    if (nextAction === "revoke_allowance") {
      await handlePrepare("allowance_revoke");
      return;
    }
    if (nextAction === "retry_allowance") {
      await handlePrepare("allowance_set");
      return;
    }
    if (nextAction === "retry_swap") {
      await handlePrepare("swap");
      return;
    }
    if (nextAction === "retry_revoke") {
      await handlePrepare("allowance_revoke");
    }
  }

  const quoteStep: SwapExecutionStep | null = quoteContext
    ? quoteContext.quote.allowanceRequired ? "allowance_set" : "swap"
    : null;

  return (
    <section className={`transfer-lane-panel protected-swap-panel state-${laneState}`}>
      <div className="transfer-lane-heading">
        <div>
          <span className="transfer-lane-kicker">
            <ArrowLeftRight size={15} />
            Protected swap lane
          </span>
          <h3>Swap ETH and KYRA</h3>
          <p>
            Private quotes, exact token allowances, fresh calldata, and mandatory
            allowance cleanup on Robinhood Chain.
          </p>
        </div>
        <span className="transfer-lane-state">
          {laneState === "complete" ? <CheckCircle2 size={15} /> : <LockKeyhole size={15} />}
          {formatState(laneState)}
        </span>
      </div>

      <div className="transfer-lane-assets" aria-label="Swap direction">
        <button
          className={sellToken === "ETH" ? "is-selected" : ""}
          type="button"
          onClick={() => { setSellToken("ETH"); resetFlow(); }}
          disabled={isBusy(laneState)}
        >
          <span>ETH to KYRA</span>
          <small>Native ETH into official KYRA</small>
        </button>
        <button
          className={sellToken === "KYRA" ? "is-selected" : ""}
          type="button"
          onClick={() => { setSellToken("KYRA"); resetFlow(); }}
          disabled={isBusy(laneState)}
        >
          <span>KYRA to ETH</span>
          <small>Exact allowance with cleanup</small>
        </button>
      </div>

      <div className="transfer-lane-form swap-lane-form">
        <label>
          Sell amount
          <div className="transfer-amount-input">
            <input
              autoComplete="off"
              inputMode="decimal"
              placeholder={sellToken === "ETH" ? "0.001" : "100"}
              value={amount}
              onChange={(event) => { setAmount(event.target.value); resetFlow(); }}
              disabled={isBusy(laneState)}
            />
            <span>{sellToken}</span>
          </div>
        </label>
        <fieldset className="swap-slippage-control">
          <legend>Max slippage</legend>
          <div>
            {slippageOptions.map((bps) => (
              <button
                className={slippageBps === bps ? "is-selected" : ""}
                type="button"
                key={bps}
                onClick={() => { setSlippageBps(bps); resetFlow(); }}
                disabled={isBusy(laneState)}
              >
                {(bps / 100).toFixed(2)}%
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      <div className="transfer-lane-limits">
        <span>Pair <strong>{sellToken}/{buyToken}</strong></span>
        <span>Quote <strong>time-limited</strong></span>
        <span>Network <strong>{currentProductChain.name}</strong></span>
      </div>

      {quoteSummary ? (
        <div className="transfer-review-summary swap-review-summary">
          <span><small>Sell</small><strong>{quoteSummary.sell}</strong></span>
          <span><small>Estimated receive</small><strong>{quoteSummary.receive}</strong></span>
          <span><small>Minimum receive</small><strong>{quoteSummary.minimum}</strong></span>
          <span><small>Expires</small><strong>{quoteSummary.expires}</strong></span>
          <span className="swap-route-summary"><small>Route</small><strong>{quoteContext?.quote.routeSummary}</strong></span>
        </div>
      ) : null}

      {prepared?.allowance ? (
        <div className="transfer-token-contract">
          <span>{prepared.step === "allowance_revoke" ? "Allowance cleanup" : "Exact allowance"}</span>
          <code>{prepared.allowance.amountAtomic === "0" ? "Revoke to 0" : `${formatUnits(BigInt(prepared.allowance.amountAtomic), 18)} KYRA`}</code>
        </div>
      ) : null}

      <p className="transfer-lane-message" aria-live="polite">{message}</p>
      {txHash ? <small className="transfer-hash">Hash: {maskHash(txHash)}</small> : null}

      <div className="transfer-lane-actions">
        {(laneState === "draft" || (laneState === "error" && !nextAction)) ? (
          <button className="button button-primary" type="button" onClick={() => void handleQuote()} disabled={!scopeReady}>
            <ShieldCheck size={16} />
            Review quote
          </button>
        ) : null}
        {laneState === "quoting" ? (
          <button className="button button-primary" type="button" disabled>
            <LoaderCircle className="spin-icon" size={16} /> Requesting quote
          </button>
        ) : null}
        {laneState === "quoted" && quoteStep ? (
          <>
            <button className="button button-ghost" type="button" onClick={editSwap}>Edit</button>
            <button className="button button-primary" type="button" onClick={() => void handlePrepare(quoteStep)} disabled={quoteExpired}>
              <LockKeyhole size={16} />
              {quoteStep === "allowance_set" ? "Lock exact allowance" : "Lock swap"}
            </button>
          </>
        ) : null}
        {laneState === "preparing" ? (
          <button className="button button-primary" type="button" disabled>
            <LoaderCircle className="spin-icon" size={16} /> Locking step
          </button>
        ) : null}
        {laneState === "prepared" ? (
          <>
            <button className="button button-ghost" type="button" onClick={editSwap}>Cancel</button>
            <button className="button button-primary" type="button" onClick={() => void handleSubmit()} disabled={preparedExpired || sendTransaction.isPending}>
              <WalletCards size={16} /> Confirm {prepared ? formatStep(prepared.step) : "step"} in wallet
            </button>
          </>
        ) : null}
        {laneState === "submitting" ? (
          <button className="button button-primary" type="button" disabled>
            <LoaderCircle className="spin-icon" size={16} /> Waiting for wallet
          </button>
        ) : null}
        {laneState === "submitted" && prepared && txHash ? (
          <button className="button button-primary" type="button" onClick={() => void syncCloseout(txHash, prepared)}>
            <RefreshCw size={16} /> Refresh receipt
          </button>
        ) : null}
        {(laneState === "confirmed" || (laneState === "error" && nextAction)) && nextAction ? (
          <button className="button button-primary" type="button" onClick={() => void handleNextAction()}>
            {nextAction === "request_fresh_quote" ? <RefreshCw size={16} /> : <ShieldCheck size={16} />}
            {labelForNextAction(nextAction)}
          </button>
        ) : null}
        {laneState === "complete" ? (
          <>
            <button className="button button-ghost" type="button" onClick={editSwap}>New swap</button>
            <span className="transfer-confirmed-label"><CheckCircle2 size={16} /> Complete</span>
          </>
        ) : null}
      </div>

      <small className="transfer-lane-boundary">
        Private dashboard only. Exact allowance only, fresh quote after approval,
        mandatory revoke, and no Telegram or public execution.
      </small>
      {!scopeReady ? (
        <small className="transfer-lane-requirement">Sign in, select a deployed agent, and connect its Robinhood Chain wallet.</small>
      ) : (
        <small className="transfer-lane-agent">Bound to {agentName || "selected agent"} and {maskAddress(walletStatus.address!)}.</small>
      )}
    </section>
  );
}

function createSecureId(prefix: string) {
  if (!globalThis.crypto?.randomUUID) throw new Error("secure randomness unavailable");
  return `${prefix}-${globalThis.crypto.randomUUID()}`;
}

function isBusy(state: SwapLaneState) {
  return state === "quoting" || state === "preparing" || state === "submitting";
}

function classifyWalletError(error: unknown, step: SwapExecutionStep) {
  if (error && typeof error === "object" && (
    ("code" in error && error.code === 4001) ||
    ("name" in error && typeof error.name === "string" && error.name.toLowerCase().includes("userrejected"))
  )) return `Wallet confirmation was rejected. The ${formatStep(step)} was not submitted.`;
  return `Wallet submission failed safely. Verify Robinhood Chain and review the ${formatStep(step)} again.`;
}

function formatStep(step: SwapExecutionStep) {
  if (step === "allowance_set") return "exact allowance";
  if (step === "allowance_revoke") return "allowance cleanup";
  return "swap";
}

function formatState(state: SwapLaneState) {
  const labels: Record<SwapLaneState, string> = {
    draft: "Draft", quoting: "Quoting", quoted: "Reviewed", preparing: "Locking",
    prepared: "Locked", submitting: "Wallet open", submitted: "Submitted",
    confirmed: "Confirmed", complete: "Complete", error: "Needs review",
  };
  return labels[state];
}

function messageForNextAction(action: SwapExecutionNextAction) {
  if (action === "request_fresh_quote") return "Exact allowance confirmed. Request the required fresh quote before swapping.";
  if (action === "revoke_allowance") return "Swap receipt confirmed. Revoke the temporary KYRA allowance to finish safely.";
  if (action === "complete") return "Protected swap flow completed and the private receipt was confirmed.";
  return "The protected step was verified. Review the next server-authorized action.";
}

function labelForNextAction(action: SwapExecutionNextAction) {
  const labels: Record<SwapExecutionNextAction, string> = {
    wait_for_receipt: "Refresh receipt", request_fresh_quote: "Request fresh quote",
    retry_allowance: "Review allowance again", retry_swap: "Review swap again",
    revoke_allowance: "Lock allowance cleanup", retry_revoke: "Review cleanup again",
    complete: "Complete",
  };
  return labels[action];
}

function maskAddress(value: string) {
  return value.length > 14 ? `${value.slice(0, 8)}...${value.slice(-6)}` : value;
}

function maskHash(value: string) {
  return value.length > 18 ? `${value.slice(0, 10)}...${value.slice(-8)}` : value;
}
