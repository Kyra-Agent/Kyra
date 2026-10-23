import {
  ArrowDown,
  CheckCircle2,
  Copy,
  ExternalLink,
  LoaderCircle,
  RefreshCw,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { encode } from "uqr";
import { formatUnits } from "viem";
import { currentProductChain } from "../config/productChains";
import {
  createReviewedSwapQuoteRequest,
  formatSwapAmount,
  getSwapTokenDecimals,
  type ReviewedSwapQuoteRequest,
  type SwapTokenSymbol,
} from "../config/swapQuotePolicy";
import {
  type PreparedSwapExecution,
  requestSwapCloseout,
  requestSwapExecutionStep,
  type SwapExecutionStep,
} from "../services/swapExecutionService";
import {
  requestSwapQuote,
  type SwapQuoteSummary,
} from "../services/swapQuotePrepareService";
import {
  createMiniAppSwapPost,
  isMiniAppConfigured,
  loadMiniAppContext,
  type MiniAppRule,
  type MiniAppSession,
  readMiniAppLaunch,
} from "../services/telegramMiniAppService";
import {
  addRobinhoodChain,
  chooseWalletApp,
  connectWallet,
  disconnectWallet,
  isWalletConnectUnreachable,
  type MiniAppWallet,
  onWalletSessionEnd,
  restoreWallet,
  sendWalletTransaction,
  walletConnectProjectId,
  type WalletDeepLink,
  walletDeepLinks,
} from "../services/telegramWalletConnect";
import {
  type BrowserWalletOption,
  connectBrowserWallet,
  discoverBrowserWallets,
  readBrowserWallet,
  sendBrowserTransaction,
  switchBrowserWalletChain,
  watchBrowserWallet,
} from "../services/telegramBrowserWallet";
import "../telegram-miniapp.css";

// The Kyra Telegram Mini App: the owner taps a button their agent's bot sent
// (a /swap reply, a DCA reminder, a stop-loss alert) and lands here with the
// swap already filled in. Kyra quotes and simulates it; the owner's own
// wallet confirms every transaction. Nothing here can sign.

type Stage =
  | "loading"
  | "blocked"
  | "connect"
  | "pairing"
  | "quoting"
  | "quoted"
  | "locking"
  | "wallet"
  | "verifying"
  | "complete"
  | "error";

interface QuoteContext {
  request: ReviewedSwapQuoteRequest;
  quote: SwapQuoteSummary;
}

const connectMessage =
  "Connect the wallet that holds the funds. Connecting never signs anything.";
const slippageOptions = [50, 100, 200] as const;
const ruleLabels: Record<MiniAppRule["kind"], string> = {
  dca: "DCA buy",
  stop_loss: "Stop-loss",
  take_profit: "Take-profit",
};

// Telegram clients that run on a computer, where the owner's wallet is a
// browser extension or a phone that scans a code.
const desktopPlatforms = ["tdesktop", "macos", "unigram"];
// Telegram Web (web.telegram.org /a and /k) runs in a browser tab on a
// computer too; it frames the Mini App and may sandbox its popups.
const webPlatforms = ["weba", "webk", "web"];

export function TelegramMiniApp() {
  const launch = useMemo(() => readMiniAppLaunch(window.location), []);
  // Inside Telegram's own window, or opened in the owner's browser through
  // "Open in browser" (same signed session, extensions available).
  const inTelegram = useMemo(() => isInsideTelegram(), []);
  const desktopTelegram = inTelegram && (
    launch.platform
      ? desktopPlatforms.includes(launch.platform) || webPlatforms.includes(launch.platform)
      : window.matchMedia?.("(pointer: fine)").matches === true
  );
  const session = useMemo<MiniAppSession | null>(
    () =>
      launch.initData && launch.agentId
        ? { initData: launch.initData, agentId: launch.agentId }
        : null,
    [launch],
  );

  const [stage, setStage] = useState<Stage>("loading");
  const [message, setMessage] = useState("Opening your agent...");
  const [agentName, setAgentName] = useState<string | null>(null);
  const [rule, setRule] = useState<MiniAppRule | null>(null);
  const [wallet, setWallet] = useState<MiniAppWallet | null>(null);
  const [pairingUri, setPairingUri] = useState<string | null>(null);
  const [browserWallets, setBrowserWallets] = useState<BrowserWalletOption[]>([]);
  const browserWallet = useRef<BrowserWalletOption | null>(null);
  const [slippageBps, setSlippageBps] = useState<number>(100);
  const [quoteContext, setQuoteContext] = useState<QuoteContext | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [revokeNeeded, setRevokeNeeded] = useState(false);
  // A sent transaction whose receipt is still unconfirmed. While it is set
  // the page offers to check it again, never a fresh swap.
  const [pending, setPending] = useState<PreparedSwapExecution | null>(null);
  const busy = useRef(false);
  // Each connect attempt gets a number; cancelling moves on to the next one so
  // a late answer from an abandoned pairing is ignored.
  const pairingAttempt = useRef(0);

  // The server's rule wins over the button's query string when both exist.
  const sell: SwapTokenSymbol | null = rule?.sell ?? launch.sell;
  const amountAtomic = rule?.amountAtomic ?? launch.amountAtomic;
  const buy: SwapTokenSymbol | null = sell ? (sell === "ETH" ? "USDG" : "ETH") : null;
  const address = wallet?.onTargetChain ? wallet.address : null;

  useEffect(() => {
    postTelegramEvent("web_app_ready");
    postTelegramEvent("web_app_expand");
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!isMiniAppConfigured()) {
      block("Kyra swaps from Telegram are not available right now.");
      return;
    }
    if (!session) {
      block("Open this from your Kyra agent's Telegram bot to swap.");
      return;
    }
    void (async () => {
      const result = await loadMiniAppContext(session, launch.ruleId);
      if (cancelled) return;
      if (!result.ok) {
        block(result.message);
        return;
      }
      setAgentName(result.agentName);
      setRule(result.rule);
      if (!(result.rule?.sell ?? launch.sell) || !(result.rule?.amountAtomic ?? launch.amountAtomic)) {
        block("This swap link is incomplete. Send /swap to your bot again.");
        return;
      }
      if (inTelegram && !desktopTelegram && !walletConnectProjectId) {
        block("Wallet connection is not set up yet. Try again later.");
        return;
      }
      // In the owner's browser the extension is the wallet; a phone session
      // from Telegram's window is only reused inside Telegram.
      let restored: MiniAppWallet | null = null;
      if (inTelegram) {
        try {
          restored = await restoreWallet();
        } catch {
          restored = null;
        }
      }
      if (cancelled) return;
      setWallet(restored);
      setStage("connect");
      setMessage(restored && !restored.onTargetChain ? chainMessage(restored) : connectMessage);
    })();
    return () => {
      cancelled = true;
    };
  }, [launch, session, inTelegram, desktopTelegram]);

  useEffect(() => {
    if (inTelegram) return;
    return discoverBrowserWallets(setBrowserWallets);
  }, [inTelegram]);

  // An extension can switch account or chain at any time; a quote belongs to
  // one address on Robinhood Chain, so any change discards it.
  useEffect(() => {
    const option = browserWallet.current;
    if (!option || wallet?.source !== "browser") return;
    return watchBrowserWallet(option, () => {
      void readBrowserWallet(option).then((next) => {
        setWallet(next);
        if (busy.current) return;
        setQuoteContext(null);
        setStage("connect");
        setMessage(next.onTargetChain ? connectMessage : chainMessage(next));
      }).catch(() => {
        browserWallet.current = null;
        setWallet(null);
        setQuoteContext(null);
        setStage("connect");
        setMessage("Your wallet disconnected. Connect it again to continue.");
      });
    });
  }, [wallet?.source]);

  useEffect(() => {
    if (!wallet || wallet.source !== "walletconnect") return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    void onWalletSessionEnd(() => {
      setWallet(null);
      setQuoteContext(null);
      setStage("connect");
      setMessage("Your wallet ended the connection. Connect it again to continue.");
    }).then((unsubscribe) => {
      if (cancelled) unsubscribe();
      else stop = unsubscribe;
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [wallet]);

  // Quote as soon as a wallet on Robinhood Chain is connected. Quoting opens
  // no wallet prompt.
  useEffect(() => {
    if (stage === "connect" && address) void quote();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, address]);

  function block(text: string) {
    setStage("blocked");
    setMessage(text);
  }

  function fail(text: string) {
    setStage("error");
    setMessage(text);
  }

  async function connect() {
    if (busy.current) return;
    const attempt = ++pairingAttempt.current;
    setPairingUri(null);
    setStage("pairing");
    setMessage("Preparing a secure WalletConnect link...");
    try {
      const connected = await connectWallet((uri) => {
        if (attempt !== pairingAttempt.current) return;
        setPairingUri(uri);
        setMessage("Open your wallet below, or scan the code from another device.");
      });
      if (attempt !== pairingAttempt.current) return;
      setWallet(connected);
      setPairingUri(null);
      setStage("connect");
      setMessage(connected.onTargetChain ? connectMessage : chainMessage(connected));
    } catch (error) {
      if (attempt !== pairingAttempt.current) return;
      setPairingUri(null);
      setStage("connect");
      setMessage(isWalletConnectUnreachable(error)
        ? "WalletConnect is not reachable right now. Try again in a moment."
        : isUserRejection(error)
        ? "Connection was cancelled. Nothing was shared."
        : "The wallet could not connect. Try again.");
    }
  }

  async function connectExtension(option: BrowserWalletOption) {
    if (busy.current) return;
    busy.current = true;
    setMessage(`Waiting for ${option.name}...`);
    try {
      const connected = await connectBrowserWallet(option);
      browserWallet.current = option;
      setWallet(connected);
      setMessage(connected.onTargetChain ? connectMessage : chainMessage(connected));
    } catch (error) {
      setMessage(isUserRejection(error)
        ? "Connection was cancelled. Nothing was shared."
        : `${option.name} could not connect. Unlock it and try again.`);
    } finally {
      busy.current = false;
    }
  }

  function openInBrowser() {
    // Telegram Web opens the tab itself, outside its sandboxed frame.
    if (launch.platform && webPlatforms.includes(launch.platform)) {
      postTelegramEvent("web_app_open_link", { url: window.location.href });
    } else {
      window.open(window.location.href, "_blank", "noopener,noreferrer");
    }
    setMessage("Opened in your browser. Finish the swap there with your wallet extension. This window expires in an hour.");
  }

  function cancelPairing() {
    pairingAttempt.current += 1;
    setPairingUri(null);
    setStage("connect");
    setMessage(connectMessage);
  }

  async function addChain() {
    if (busy.current) return;
    busy.current = true;
    try {
      setMessage(`Approve ${currentProductChain.name} in your wallet...`);
      if (wallet?.source === "browser" && browserWallet.current) {
        await switchBrowserWalletChain(browserWallet.current);
        const next = await readBrowserWallet(browserWallet.current);
        setWallet(next);
        setMessage(next.onTargetChain ? connectMessage : chainMessage(next));
        return;
      }
      await addRobinhoodChain();
      setWallet(null);
      setMessage(`${currentProductChain.name} added. Connect again to finish.`);
    } catch {
      setMessage(`Add ${currentProductChain.name} (chain ${currentProductChain.id}) in your wallet, then connect again.`);
    } finally {
      busy.current = false;
    }
  }

  async function changeWallet() {
    // An extension stays connected to the site; forgetting it here is enough
    // to pick another wallet.
    if (wallet?.source === "browser") browserWallet.current = null;
    else await disconnectWallet();
    setWallet(null);
    setQuoteContext(null);
    setStage("connect");
    setMessage(connectMessage);
  }

  async function quote() {
    if (!session || !sell || !buy || !amountAtomic) return;
    if (!address) {
      setStage("connect");
      setMessage(connectMessage);
      return;
    }
    const requestId = createSecureId("swap-quote");
    if (!requestId) {
      fail("Secure randomness is unavailable in this window.");
      return;
    }
    const reviewed = createReviewedSwapQuoteRequest({
      workspaceId: "",
      agentId: session.agentId,
      requestId,
      taker: address,
      sellTokenSymbol: sell,
      buyTokenSymbol: buy,
      sellAmount: formatUnits(BigInt(amountAtomic), getSwapTokenDecimals(sell)),
      slippageBps,
    });
    if (!reviewed.ok) {
      fail(reviewed.message);
      return;
    }
    setStage("quoting");
    setMessage("Pricing every Uniswap pool and simulating your swap...");
    const result = await requestSwapQuote(
      createMiniAppSwapPost(session, "quote"),
      reviewed.request,
    );
    if (!result.ok) {
      setQuoteContext(null);
      fail(result.message);
      return;
    }
    setQuoteContext({ request: reviewed.request, quote: result.quote });
    setStage("quoted");
    setMessage(result.quote.allowanceRequired
      ? "Uniswap first needs permission to spend exactly this much USDG. Confirm that, and Kyra fetches the final quote."
      : "Quote simulated on Robinhood Chain. Confirm it in your wallet.");
  }

  async function run(step: SwapExecutionStep) {
    if (!session || !address || !quoteContext || busy.current) return;
    if (step !== "allowance_revoke" && Date.parse(quoteContext.quote.expiresAt) <= Date.now()) {
      await quote();
      return;
    }
    const requestId = createSecureId(`swap-${step}`);
    if (!requestId) {
      fail("Secure randomness is unavailable in this window.");
      return;
    }
    busy.current = true;
    try {
      setStage("locking");
      setMessage(`Locking the exact ${formatStep(step)}...`);
      const prepared = await requestSwapExecutionStep(
        createMiniAppSwapPost(session, "prepare"),
        {
          workspaceId: "",
          agentId: session.agentId,
          quoteRecordId: quoteContext.quote.quoteRecordId,
          requestId,
          step,
          sender: address,
        },
      );
      if (!prepared.ok) {
        fail(prepared.message);
        return;
      }

      setStage("wallet");
      setMessage(`Open ${wallet?.walletName ?? "your wallet"} and confirm the ${formatStep(step)}.`);
      let hash: `0x${string}`;
      try {
        const transaction = {
          from: prepared.prepared.sender,
          to: prepared.prepared.transaction.to,
          data: prepared.prepared.transaction.data,
          valueWei: prepared.prepared.transaction.valueWei,
        };
        hash = wallet?.source === "browser" && browserWallet.current
          ? await sendBrowserTransaction(browserWallet.current, transaction)
          : await sendWalletTransaction(transaction);
      } catch (error) {
        setStage("quoted");
        setMessage(isUserRejection(error)
          ? `You rejected the ${formatStep(step)}. Nothing was sent.`
          : error instanceof Error && error.message === "wallet_wrong_chain"
          ? `Switch ${wallet?.walletName ?? "your wallet"} to ${currentProductChain.name}, then confirm again.`
          : `Your wallet could not send the ${formatStep(step)}. Check it is on ${currentProductChain.name} and try again.`);
        return;
      }
      setTxHash(hash);
      setStage("verifying");
      setMessage("Sent. Verifying the receipt on Robinhood Chain...");
      await closeout(hash, prepared.prepared);
    } finally {
      busy.current = false;
    }
  }

  async function closeout(hash: `0x${string}`, intent: PreparedSwapExecution) {
    if (!session) return;
    setPending(null);
    const check = () =>
      requestSwapCloseout(createMiniAppSwapPost(session, "closeout"), {
        workspaceId: "",
        agentId: session.agentId,
        intentRecordId: intent.intentRecordId,
        requestId: intent.requestId,
        txHash: hash,
      });
    // A fresh transaction can take a moment to reach the verification RPC.
    let result = await check();
    for (let attempt = 1; attempt < 6 && (!result.ok || result.status === "submitted"); attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2_000 * attempt));
      result = await check();
    }
    if (!result.ok || result.status === "submitted") {
      setPending(intent);
      fail("The transaction was sent but its receipt is not confirmed yet. Check the explorer before trying again.");
      return;
    }
    if (result.status === "failed") {
      setRevokeNeeded(result.nextAction === "revoke_allowance");
      fail(result.nextAction === "revoke_allowance"
        ? "The swap reverted. Clean up the USDG allowance, then start again."
        : `The ${formatStep(result.step)} failed on chain. Nothing else was sent.`);
      return;
    }
    if (result.nextAction === "request_fresh_quote") {
      await quote();
      return;
    }
    if (result.nextAction === "revoke_allowance") {
      setRevokeNeeded(true);
      setStage("complete");
      setMessage("Swap confirmed. One USDG allowance is left; clean it up to finish.");
      return;
    }
    setRevokeNeeded(false);
    setStage("complete");
    setMessage(result.step === "allowance_revoke"
      ? "Allowance cleaned up. Uniswap can no longer spend your USDG."
      : "Swap complete. The receipt was verified on Robinhood Chain.");
  }

  async function copyPairingLink() {
    if (!pairingUri) return;
    try {
      await navigator.clipboard.writeText(pairingUri);
      setMessage("Link copied. Paste it into your wallet's WalletConnect screen.");
    } catch {
      setMessage("Copying is blocked here. Scan the code or open a wallet below.");
    }
  }

  const summary = useMemo(() => {
    if (!sell || !buy || !amountAtomic) return null;
    const buyDecimals = getSwapTokenDecimals(buy);
    return {
      sell: formatSwapAmount(amountAtomic, getSwapTokenDecimals(sell)),
      receive: quoteContext ? formatSwapAmount(quoteContext.quote.buyAmount, buyDecimals) : null,
      minimum: quoteContext ? formatSwapAmount(quoteContext.quote.minimumBuyAmount, buyDecimals) : null,
      route: quoteContext?.quote.routeSummary ?? null,
    };
  }, [sell, buy, amountAtomic, quoteContext]);

  const working = stage === "loading" || stage === "quoting" || stage === "locking" ||
    stage === "wallet" || stage === "verifying" || (stage === "pairing" && !pairingUri);
  const nextStep: SwapExecutionStep | null = quoteContext
    ? quoteContext.quote.allowanceRequired ? "allowance_set" : "swap"
    : null;
  // No phone wallet apps on a computer: show the code to scan first.
  const onComputer = desktopTelegram || !inTelegram;
  const canChangeSlippage = stage === "connect" || stage === "quoted" || stage === "error";

  return (
    <main className={`tg-app tg-stage-${stage}`}>
      <header className="tg-head">
        <img src="/brand/kyra.jpg" alt="" width={36} height={36} />
        <div>
          <strong>{agentName ?? "Kyra Agent"}</strong>
          <span>{rule ? ruleLabels[rule.kind] : "Swap"} on {currentProductChain.name}</span>
        </div>
      </header>

      {summary && sell && buy && stage !== "blocked" && stage !== "loading"
        ? (
          <section className="tg-card" aria-label="Swap">
            <div className="tg-leg">
              <span>You sell</span>
              <strong>{summary.sell} <em>{sell}</em></strong>
            </div>
            <div className="tg-arrow" aria-hidden="true"><ArrowDown size={16} /></div>
            <div className="tg-leg">
              <span>You receive about</span>
              <strong>
                {summary.receive ?? (stage === "quoting" ? "..." : "-")} <em>{buy}</em>
              </strong>
            </div>
            {summary.minimum
              ? (
                <dl className="tg-facts">
                  <div><dt>Minimum</dt><dd>{summary.minimum} {buy}</dd></div>
                  <div><dt>Route</dt><dd>{summary.route}</dd></div>
                </dl>
              )
              : null}
            <fieldset className="tg-slippage" disabled={!canChangeSlippage}>
              <legend>Max slippage</legend>
              {slippageOptions.map((bps) => (
                <button
                  key={bps}
                  type="button"
                  className={slippageBps === bps ? "is-selected" : ""}
                  aria-pressed={slippageBps === bps}
                  onClick={() => {
                    if (bps === slippageBps) return;
                    setSlippageBps(bps);
                    if (quoteContext || stage === "error") {
                      setQuoteContext(null);
                      setStage("connect");
                    }
                  }}
                >
                  {(bps / 100).toFixed(1)}%
                </button>
              ))}
            </fieldset>
          </section>
        )
        : null}

      <p className="tg-message" role="status" aria-live="polite">
        {working ? <LoaderCircle className="tg-spin" size={15} /> : null}
        {stage === "complete" ? <CheckCircle2 size={15} /> : null}
        {message}
      </p>

      {stage === "pairing" && pairingUri
        ? (
          <section className="tg-pairing" aria-label="Connect a wallet">
            {onComputer ? <PairingCode uri={pairingUri} /> : null}
            <div className="tg-wallets" hidden={onComputer}>
              {walletDeepLinks.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  className="tg-secondary"
                  onClick={() => void openWalletApp(item, pairingUri)}
                >
                  <WalletCards size={16} />
                  Open {item.name}
                </button>
              ))}
            </div>
            {onComputer ? null : <PairingCode uri={pairingUri} />}
            <button type="button" className="tg-link" onClick={() => void copyPairingLink()}>
              <Copy size={14} />
              Copy WalletConnect link
            </button>
          </section>
        )
        : null}

      {stage === "pairing"
        ? (
          <button type="button" className="tg-link tg-cancel" onClick={cancelPairing}>
            Cancel
          </button>
        )
        : null}

      <div className="tg-actions">
        {stage === "connect" && !wallet && desktopTelegram
          ? (
            <button type="button" className="tg-primary" onClick={openInBrowser}>
              <ExternalLink size={17} />
              Open in browser to use your extension
            </button>
          )
          : null}

        {stage === "connect" && !wallet && !inTelegram
          ? browserWallets.map((option) => (
            <button
              key={option.id}
              type="button"
              className="tg-primary"
              onClick={() => void connectExtension(option)}
            >
              {option.icon
                ? <img className="tg-wallet-icon" src={option.icon} alt="" width={18} height={18} />
                : <WalletCards size={17} />}
              Connect {option.name}
            </button>
          ))
          : null}

        {stage === "connect" && !wallet && !inTelegram && !browserWallets.length
          ? <p className="tg-note">No wallet extension found in this browser. Install or unlock one, then reload.</p>
          : null}

        {stage === "connect" && !wallet && walletConnectProjectId
          ? (
            <button
              type="button"
              className={inTelegram && !desktopTelegram ? "tg-primary" : "tg-secondary"}
              onClick={() => void connect()}
            >
              <WalletCards size={17} />
              {inTelegram && !desktopTelegram ? "Connect wallet" : "Connect a phone wallet"}
            </button>
          )
          : null}

        {stage === "connect" && wallet && !wallet.onTargetChain
          ? (
            <button type="button" className="tg-primary" onClick={() => void addChain()}>
              {wallet.source === "browser"
                ? `Switch to ${currentProductChain.name}`
                : `Add ${currentProductChain.name} to ${wallet.walletName}`}
            </button>
          )
          : null}

        {stage === "quoted" && nextStep
          ? (
            <button type="button" className="tg-primary" onClick={() => void run(nextStep)}>
              <ShieldCheck size={17} />
              {nextStep === "allowance_set" ? "Allow exact USDG" : "Confirm swap in wallet"}
            </button>
          )
          : null}

        {stage === "error" && pending && txHash
          ? (
            <button
              type="button"
              className="tg-primary"
              onClick={() => {
                setStage("verifying");
                setMessage("Checking the receipt on Robinhood Chain...");
                void closeout(txHash, pending);
              }}
            >
              <RefreshCw size={16} />
              Check receipt again
            </button>
          )
          : null}

        {stage === "error" && !revokeNeeded && !pending
          ? (
            <button type="button" className="tg-secondary" onClick={() => void quote()}>
              <RefreshCw size={16} />
              Get a fresh quote
            </button>
          )
          : null}

        {revokeNeeded && (stage === "complete" || stage === "error")
          ? (
            <button type="button" className="tg-primary" onClick={() => void run("allowance_revoke")}>
              Clean up USDG allowance
            </button>
          )
          : null}

        {txHash && (stage === "complete" || stage === "error" || stage === "verifying")
          ? (
            <button
              type="button"
              className="tg-secondary"
              onClick={() => openLink(`${currentProductChain.explorerUrl}/tx/${txHash}`)}
            >
              <ExternalLink size={16} />
              View on explorer
            </button>
          )
          : null}

        {stage === "complete" && !revokeNeeded && inTelegram
          ? (
            <button type="button" className="tg-secondary" onClick={() => postTelegramEvent("web_app_close")}>
              Done
            </button>
          )
          : null}
      </div>

      <footer className="tg-foot">
        <span className="tg-foot-note">
          <ShieldCheck size={13} />
          Kyra never signs. Your wallet confirms every transaction.
        </span>
        {wallet && (stage === "connect" || stage === "quoted" || stage === "error")
          ? (
            <button type="button" className="tg-link" onClick={() => void changeWallet()}>
              {maskAddress(wallet.address)} · change
            </button>
          )
          : null}
      </footer>
    </main>
  );
}

function PairingCode({ uri }: { uri: string }) {
  const qr = useMemo(() => encode(uri, { ecc: "M", border: 2 }), [uri]);
  const cells: string[] = [];
  qr.data.forEach((row, y) =>
    row.forEach((dark, x) => {
      if (dark) cells.push(`M${x} ${y}h1v1h-1z`);
    })
  );
  return (
    <svg
      className="tg-qr"
      viewBox={`0 0 ${qr.size} ${qr.size}`}
      role="img"
      aria-label="WalletConnect pairing code"
      shapeRendering="crispEdges"
    >
      <rect width={qr.size} height={qr.size} fill="#fff" />
      <path d={cells.join("")} fill="#000" />
    </svg>
  );
}

function chainMessage(wallet: MiniAppWallet) {
  return wallet.source === "browser"
    ? `${wallet.walletName} is on another network. Switch it to ${currentProductChain.name} to continue.`
    : `${wallet.walletName} connected without ${currentProductChain.name}. Add the chain, then connect again.`;
}

// Telegram's Mini App bridge without loading its script: native clients
// expose TelegramWebviewProxy, Telegram Web listens for window messages.
function postTelegramEvent(eventType: string, eventData: Record<string, unknown> = {}) {
  const proxy = (window as unknown as {
    TelegramWebviewProxy?: { postEvent?: (type: string, data: string) => void };
  }).TelegramWebviewProxy;
  try {
    if (proxy?.postEvent) {
      proxy.postEvent(eventType, JSON.stringify(eventData));
    } else if (window.parent !== window) {
      window.parent.postMessage(JSON.stringify({ eventType, eventData }), "https://web.telegram.org");
    }
  } catch {
    // Outside Telegram there is nothing to tell.
  }
}

// Telegram hands links opened from a Mini App to the system, which is how a
// wallet's universal link reaches the wallet app.
async function openWalletApp(wallet: WalletDeepLink, pairingUri: string) {
  try {
    window.open(await chooseWalletApp(wallet, pairingUri), "_blank", "noopener,noreferrer");
  } catch {
    // The pairing code and copy link still work.
  }
}

function isInsideTelegram() {
  return Boolean(
    (window as unknown as { TelegramWebviewProxy?: unknown }).TelegramWebviewProxy,
  ) || window.parent !== window;
}

function openLink(url: string) {
  if (isInsideTelegram()) {
    postTelegramEvent("web_app_open_link", { url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

function createSecureId(prefix: string) {
  return globalThis.crypto?.randomUUID ? `${prefix}-${globalThis.crypto.randomUUID()}` : null;
}

function isUserRejection(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? error.code : null;
  const text = `${"name" in error ? String(error.name) : ""} ${"message" in error ? String(error.message) : ""}`
    .toLowerCase();
  return code === 4001 || code === 5000 || text.includes("userrejected") || text.includes("rejected");
}

function formatStep(step: SwapExecutionStep) {
  if (step === "allowance_set") return "USDG allowance";
  if (step === "allowance_revoke") return "allowance cleanup";
  return "swap";
}

function maskAddress(value: string) {
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}
