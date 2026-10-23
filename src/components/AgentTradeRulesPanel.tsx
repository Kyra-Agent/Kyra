import { LoaderCircle, Pause, Play, Repeat, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import type { KyraAuthSession } from "../services/supabaseAuthService";
import {
  changeTradeRule,
  listTradeRules,
  type TradeRule,
  type TradeRuleChange,
} from "../services/agentTradeRulesService";

interface AgentTradeRulesPanelProps {
  session: KyraAuthSession;
  agentId: string;
  agentName: string;
}

type PanelStatus = "loading" | "ready" | "error";

// The agent's DCA, stop-loss, and take-profit rules. Owners create them in
// Telegram; here they can see each rule and pause, resume, or delete it. A
// rule never trades: when it comes due the bot sends a swap prompt the owner
// confirms in their own wallet.
export function AgentTradeRulesPanel({ session, agentId, agentName }: AgentTradeRulesPanelProps) {
  const [rules, setRules] = useState<TradeRule[]>([]);
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [busyRuleId, setBusyRuleId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setStatus("loading");
    void listTradeRules(session, agentId).then((result) => {
      if (!active) return;
      if (result.ok) {
        setRules(result.rules);
        setStatus("ready");
      } else {
        setMessage({ text: result.message, error: true });
        setStatus("error");
      }
    });
    return () => {
      active = false;
    };
  }, [agentId, session]);

  async function change(rule: TradeRule, action: TradeRuleChange) {
    if (busyRuleId) return;
    setBusyRuleId(rule.id);
    setMessage(null);
    const result = await changeTradeRule(session, agentId, rule.id, action);
    setBusyRuleId(null);
    setConfirmDeleteId(null);
    if (!result.ok) {
      setMessage({ text: result.message, error: true });
      return;
    }
    setRules(result.rules);
    setMessage(result.message ? { text: result.message, error: false } : null);
  }

  const activeCount = rules.filter((rule) => rule.enabled).length;

  return (
    <section className="dashboard-panel trade-rules-panel" id="trade-rules">
      <div className="panel-title">
        <span>Trade rules</span>
        <span>{status === "ready" ? `${activeCount}/5 active` : "DCA and price rules"}</span>
      </div>
      <p className="agent-settings-intro">
        When a rule comes due, {agentName} sends you a swap prompt in Telegram with a live Uniswap
        quote. Nothing trades until you confirm it in your own wallet.
      </p>

      {status === "loading"
        ? (
          <p className="agent-settings-status">
            <LoaderCircle className="spin-icon" size={15} />
            Loading rules...
          </p>
        )
        : status === "ready" && rules.length
        ? (
          <ul className="trade-rule-list">
            {rules.map((rule) => (
              <li className={rule.enabled ? "" : "is-paused"} key={rule.id}>
                <span className="trade-rule-icon" aria-hidden="true">
                  {rule.kind === "dca"
                    ? <Repeat size={15} />
                    : rule.kind === "stop_loss"
                    ? <TrendingDown size={15} />
                    : <TrendingUp size={15} />}
                </span>
                <span className="trade-rule-text">
                  <strong>{describeRule(rule)}</strong>
                  <small>{describeState(rule)}</small>
                </span>
                <span className="trade-rule-actions">
                  {confirmDeleteId === rule.id
                    ? (
                      <>
                        <button
                          className="trade-rule-danger"
                          disabled={busyRuleId !== null}
                          onClick={() => void change(rule, "delete")}
                          type="button"
                        >
                          {busyRuleId === rule.id ? <LoaderCircle className="spin-icon" size={14} /> : null}
                          Delete
                        </button>
                        <button
                          disabled={busyRuleId !== null}
                          onClick={() => setConfirmDeleteId(null)}
                          type="button"
                        >
                          Keep
                        </button>
                      </>
                    )
                    : (
                      <>
                        <button
                          disabled={busyRuleId !== null}
                          onClick={() => void change(rule, rule.enabled ? "pause" : "resume")}
                          type="button"
                        >
                          {busyRuleId === rule.id
                            ? <LoaderCircle className="spin-icon" size={14} />
                            : rule.enabled
                            ? <Pause size={14} />
                            : <Play size={14} />}
                          {rule.enabled ? "Pause" : "Resume"}
                        </button>
                        <button
                          aria-label={`Delete ${describeRule(rule)}`}
                          disabled={busyRuleId !== null}
                          onClick={() => setConfirmDeleteId(rule.id)}
                          type="button"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                </span>
              </li>
            ))}
          </ul>
        )
        : status === "ready"
        ? <p className="agent-settings-hint">No rules yet.</p>
        : null}

      {message
        ? (
          <p
            className={`agent-settings-status ${message.error ? "status-error" : "status-saved"}`}
            role="status"
          >
            {message.text}
          </p>
        )
        : null}

      <ol className="community-chat-steps">
        <li>
          In your private chat with the bot, send <code>/dca 0.001 ETH daily</code> (or{" "}
          <code>weekly</code>) to swap on a schedule. Use <code>USDG</code> as the token to buy ETH
          instead.
        </li>
        <li>
          <code>/stoploss 2000 0.001</code> or <code>/takeprofit 3000 0.001</code> sell that much ETH
          for USDG when ETH reaches the price.
        </li>
        <li>
          Caps match the swap lane: 0.005 ETH or 12.5 USDG per swap, 5 active rules per agent.
        </li>
      </ol>
    </section>
  );
}

function describeRule(rule: TradeRule) {
  const amount = `${formatUnits(BigInt(rule.amountAtomic), rule.sell === "USDG" ? 6 : 18)} ${rule.sell}`;
  if (rule.kind === "dca") {
    return `DCA ${amount} into ${rule.buy}, ${rule.intervalHours === 168 ? "weekly" : "daily"}`;
  }
  const price = formatUsd(rule.triggerPriceUsd);
  return rule.kind === "stop_loss"
    ? `Stop-loss: sell ${amount} if ETH falls to ${price}`
    : `Take-profit: sell ${amount} if ETH rises to ${price}`;
}

function describeState(rule: TradeRule) {
  if (!rule.enabled) {
    return rule.kind !== "dca" && rule.lastTriggeredAt
      ? `Triggered ${formatDate(rule.lastTriggeredAt)}. Resume to arm it again.`
      : "Paused";
  }
  if (rule.kind === "dca" && rule.nextRunAt) {
    return Date.parse(rule.nextRunAt) <= Date.now()
      ? "Next prompt within 5 minutes"
      : `Next prompt ${formatDate(rule.nextRunAt)}`;
  }
  return "Watching the ETH price every 5 minutes";
}

function formatUsd(value: string | null) {
  const number = Number(value);
  return Number.isFinite(number)
    ? number.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    })
    : "the trigger price";
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
