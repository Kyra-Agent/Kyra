import { useCallback, useEffect, useRef, useState } from "react";
import {
  Ban,
  Bot,
  CheckCircle2,
  LockKeyhole,
  MessageSquareText,
  Send,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import type { AgentTemplate } from "../types/agent";
import { currentProductChain } from "../config/productChains";
import { RevealHeading } from "./RevealHeading";

type Verdict = "read_only" | "wallet" | "dashboard" | "secret";

interface ChatMessage {
  id: number;
  from: "user" | "bot";
  text: string;
}

interface SimulatedReply {
  verdict: Verdict;
  text: string;
}

const maxInputLength = 200;
const suggestions = [
  "/help",
  "What can you do?",
  "Check my wallet",
  "Swap 10 USDC to ETH now",
  "Draft a launch plan",
  "Here is my seed phrase",
] as const;

// These mirror the live bot's deterministic safety rules (execution gate and
// read-only intents) so the demo never promises more than Telegram does.
const secretPattern =
  /(?:\d{5,20}:[A-Za-z0-9_-]{20,}|sk-[A-Za-z0-9_-]{20,}|\b[0-9a-f]{64}\b|private\s+key|seed\s+phrase|recovery\s+phrase|mnemonic)/i;
const actionPattern =
  /\b(swap|transfer|send|approve|allowance|permit|revoke|sign|bridge|mint|burn|stake|unstake|claim|withdraw|deposit|buy|sell|wrap|unwrap|borrow|lend|repay)\b/i;
const walletPattern =
  /\b(wallet|balance|portfolio|holdings?|tx|transactions?|history|onchain)\b/i;
const helpPattern = /^\/help\b|\b(help|what can you do|commands?|capabilities)\b/i;
const statusPattern = /^\/status\b/i;
const planPattern =
  /\b(plan|launch|campaign|strategy|brief|narrative|roadmap|checklist|risk)\b/i;

function formatList(items: readonly string[]) {
  return items.slice(0, 5).join(", ");
}

function buildReply(text: string, template: AgentTemplate): SimulatedReply {
  if (secretPattern.test(text)) {
    return {
      verdict: "secret",
      text: [
        "Kyra cannot process secrets, wallet keys, or token material, and never passes them to the agent.",
        "If that was a real seed phrase or private key, treat it as exposed: delete the message and move your funds to a new wallet.",
      ].join("\n"),
    };
  }

  if (actionPattern.test(text)) {
    return {
      verdict: "dashboard",
      text: [
        "Kyra cannot execute that from Telegram.",
        "Telegram execution stays disabled.",
        "Prepare it as a review in your private dashboard; nothing is sent until you sign in your wallet.",
      ].join("\n"),
    };
  }

  if (/^\/help\b/i.test(text)) {
    return {
      verdict: "read_only",
      text: [
        "Kyra Telegram",
        "Commands: /help /status /agent /actions /modules /policy",
        "Plain text: ask in your own words for a market brief, research summary, risk review, or plan.",
        "Boundary: wallet and onchain execution are disabled.",
      ].join("\n"),
    };
  }

  if (statusPattern.test(text)) {
    return {
      verdict: "read_only",
      text: [
        "Kyra Telegram session: active",
        "Command access: read-only",
        "Execution: wallet, write, approval, and onchain disabled",
      ].join("\n"),
    };
  }

  if (helpPattern.test(text)) {
    return {
      verdict: "read_only",
      text: [
        `I'm your ${template.name} agent: ${template.role.toLowerCase()}.`,
        `I can help with ${formatList(template.actions)}.`,
        "Try /status, /agent, or /policy, or just ask in plain English.",
      ].join("\n"),
    };
  }

  if (walletPattern.test(text)) {
    return {
      verdict: "wallet",
      text: [
        "I can't read live wallet balances or history from Telegram.",
        "Open your private Kyra dashboard and connect your wallet to review them.",
        `Here I can help you plan a ${template.actions[1] ?? "review"} instead.`,
      ].join("\n"),
    };
  }

  if (planPattern.test(text)) {
    return {
      verdict: "read_only",
      text: [
        `${template.name} launch plan (sample outline)`,
        "1. Define the audience and the one message to land.",
        "2. Line up proof: docs, audits, and a clear risk note.",
        `3. Stage the announcement, then review any ${currentProductChain.name} action in the dashboard.`,
      ].join("\n"),
    };
  }

  return {
    verdict: "read_only",
    text: [
      `I'll answer that within the ${template.name} scope.`,
      "In the live bot, the agent brain writes a full read-only reply here.",
    ].join("\n"),
  };
}

const verdictCopy: Record<Verdict, { label: string; detail: string }> = {
  read_only: {
    label: "Read-only reply",
    detail: "Answered in chat. No wallet, no transaction.",
  },
  wallet: {
    label: "Dashboard for wallet data",
    detail: "Telegram never sees balances; the owner checks them privately.",
  },
  dashboard: {
    label: "Needs dashboard + wallet",
    detail: "Telegram refuses. A review can be prepared; only a wallet signature sends it.",
  },
  secret: {
    label: "Blocked: secret material",
    detail: "Refused before any model or service sees it.",
  },
};

function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

interface TelegramSimulatorProps {
  template: AgentTemplate;
}

export function TelegramSimulator({ template }: TelegramSimulatorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [streamingId, setStreamingId] = useState<number | null>(null);
  const [streamLength, setStreamLength] = useState(0);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [traceStep, setTraceStep] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const nextIdRef = useRef(1);
  const timersRef = useRef<number[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const busy = typing || streamingId !== null;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }, []);

  const later = useCallback((action: () => void, delay: number) => {
    timersRef.current.push(window.setTimeout(action, delay));
  }, []);

  // A new template starts a fresh conversation with its own greeting.
  useEffect(() => {
    clearTimers();
    setTyping(false);
    setStreamingId(null);
    setVerdict(null);
    setTraceStep(0);
    setMessages([{
      id: nextIdRef.current++,
      from: "bot",
      text: `Hi, I'm your ${template.name} agent on ${currentProductChain.name}. Ask me anything, or tap a suggestion.`,
    }]);

    return clearTimers;
  }, [clearTimers, template.id, template.name]);

  // Keep the newest message in view inside the phone, never the page.
  useEffect(() => {
    const body = bodyRef.current;

    if (body) {
      body.scrollTop = body.scrollHeight;
    }
  }, [messages, typing, streamLength]);

  function send(rawText: string) {
    const text = rawText.trim().slice(0, maxInputLength);

    if (!text || busy) {
      return;
    }

    const reply = buildReply(text, template);
    const reduced = prefersReducedMotion();
    const userMessage: ChatMessage = { id: nextIdRef.current++, from: "user", text };
    const botMessage: ChatMessage = { id: nextIdRef.current++, from: "bot", text: reply.text };

    clearTimers();
    setDraft("");
    setMessages((current) => [...current.slice(-12), userMessage]);
    setVerdict(reply.verdict);
    setTraceStep(1);
    setTyping(true);

    later(() => setTraceStep(2), reduced ? 0 : 420);
    later(() => {
      setTyping(false);
      setTraceStep(3);
      setMessages((current) => [...current, botMessage]);
      setAnnouncement(reply.text);

      if (reduced) {
        return;
      }

      setStreamingId(botMessage.id);
      setStreamLength(0);

      // Progress is derived from elapsed time, so throttled timers (a
      // background tab) only make the stream coarser, never longer.
      const duration = Math.min(1400, reply.text.length * 12);
      const startedAt = performance.now();
      const tick = () => {
        const progress = Math.min(1, (performance.now() - startedAt) / duration);
        setStreamLength(Math.ceil(reply.text.length * progress));

        if (progress < 1) {
          later(tick, 16);
        } else {
          setStreamingId(null);
        }
      };
      later(tick, 16);
    }, reduced ? 0 : 900);
  }

  const verdictInfo = verdict ? verdictCopy[verdict] : null;
  const VerdictIcon = verdict === "secret"
    ? Ban
    : verdict === "dashboard"
    ? LockKeyhole
    : verdict === "wallet"
    ? Wallet
    : CheckCircle2;

  return (
    <section className="section simulator-section" id="try">
      <div className="section-heading">
        <p className="eyebrow">Try it</p>
        <RevealHeading text="Talk to a Kyra agent before you deploy one." />
        <p>
          A live preview of the Telegram experience. Replies follow the same safety rules as
          the real bot: it explains and plans, and it never moves funds.
        </p>
      </div>

      <div className="simulator-layout">
        <div className="sim-phone">
          <div className="sim-phone-header">
            <span className="sim-avatar"><Bot size={18} /></span>
            <div>
              <strong>Kyra {template.name}</strong>
              <small>
                <span className="sim-online-dot" aria-hidden="true" />
                {typing ? "typing..." : "bot"}
              </small>
            </div>
          </div>

          <div className="sim-body" ref={bodyRef} aria-label="Simulated Telegram chat">
            {messages.map((message) => {
              const text = message.id === streamingId
                ? message.text.slice(0, streamLength)
                : message.text;

              return (
                <p
                  className={`sim-bubble sim-bubble-${message.from}${
                    message.id === streamingId ? " is-streaming" : ""
                  }`}
                  key={message.id}
                >
                  {text}
                </p>
              );
            })}
            {typing
              ? (
                <p className="sim-bubble sim-bubble-bot sim-typing" aria-hidden="true">
                  <span /><span /><span />
                </p>
              )
              : null}
          </div>

          <div className="sim-suggestions" role="group" aria-label="Suggested messages">
            {suggestions.map((suggestion) => (
              <button
                disabled={busy}
                key={suggestion}
                onClick={() => send(suggestion)}
                type="button"
              >
                {suggestion}
              </button>
            ))}
          </div>

          <form
            className="sim-input"
            onSubmit={(event) => {
              event.preventDefault();
              send(draft);
            }}
          >
            <label className="visually-hidden" htmlFor="sim-message">
              Message the demo agent
            </label>
            <input
              autoComplete="off"
              id="sim-message"
              maxLength={maxInputLength}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Write a message..."
              value={draft}
            />
            <button
              aria-label="Send message"
              disabled={busy || !draft.trim()}
              type="submit"
            >
              <Send size={16} />
            </button>
          </form>
          <p className="visually-hidden" aria-live="polite">{announcement}</p>
        </div>

        <aside className="sim-trace" aria-label="What Kyra decided">
          <span className="sim-trace-kicker">Decision trace</span>
          <ol>
            <li className={traceStep >= 1 ? "is-done" : ""}>
              <MessageSquareText size={16} />
              <div>
                <strong>Message received</strong>
                <small>Only the linked owner chat gets replies.</small>
              </div>
            </li>
            <li className={traceStep >= 2 ? "is-done" : ""}>
              <ShieldCheck size={16} />
              <div>
                <strong>Safety gate</strong>
                <small>Secrets and execution requests are stopped here.</small>
              </div>
            </li>
            <li className={traceStep >= 3 ? `is-done is-${verdict ?? "read_only"}` : ""}>
              <VerdictIcon size={16} />
              <div>
                <strong>{traceStep >= 3 && verdictInfo ? verdictInfo.label : "Reply"}</strong>
                <small>
                  {traceStep >= 3 && verdictInfo
                    ? verdictInfo.detail
                    : "Send a message to see the decision."}
                </small>
              </div>
            </li>
          </ol>
          <p className="sim-trace-note">
            Preview only. Messages stay in this browser tab.
          </p>
        </aside>
      </div>
    </section>
  );
}
