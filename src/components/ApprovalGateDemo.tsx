import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Ban, Bot, LayoutDashboard, Link2, Send, Wallet } from "lucide-react";
import {
  currentProductChain,
  currentWalletDisplayName,
} from "../config/productChains";

type StageId = "telegram" | "kyra" | "dashboard" | "wallet" | "chain";
type ScenarioId = "question" | "swap" | "secret";

const stages: Array<{ id: StageId; label: string; icon: typeof Send }> = [
  { id: "telegram", label: "Telegram", icon: Send },
  { id: "kyra", label: "Kyra gate", icon: Bot },
  { id: "dashboard", label: "Dashboard review", icon: LayoutDashboard },
  { id: "wallet", label: "Wallet signature", icon: Wallet },
  { id: "chain", label: currentProductChain.name, icon: Link2 },
];

const scenarios: Record<
  ScenarioId,
  { label: string; stopAt: number; tone: "ok" | "gated" | "blocked"; steps: string[] }
> = {
  question: {
    label: "Ask a question",
    stopAt: 1,
    tone: "ok",
    steps: [
      "You ask your agent a question in Telegram.",
      "Kyra answers read-only in chat. Nothing else moves.",
    ],
  },
  swap: {
    label: "Request a swap",
    stopAt: 4,
    tone: "gated",
    steps: [
      "You ask for a swap in Telegram.",
      "Kyra refuses to execute from chat and points you to the dashboard.",
      "You review the prepared action in your private dashboard.",
      `${currentWalletDisplayName} asks for your signature. Decline and nothing happens.`,
      `Only your signature sends it to ${currentProductChain.name}.`,
    ],
  },
  secret: {
    label: "Paste a private key",
    stopAt: 1,
    tone: "blocked",
    steps: [
      "Someone pastes a private key into Telegram.",
      "Kyra blocks it before any model or service sees it.",
    ],
  },
};

const stepDelayMs = 700;

export function ApprovalGateDemo() {
  const [scenarioId, setScenarioId] = useState<ScenarioId | null>(null);
  const [reached, setReached] = useState(-1);
  const timersRef = useRef<number[]>([]);
  const scenario = scenarioId ? scenarios[scenarioId] : null;
  const finished = Boolean(scenario && reached >= scenario.stopAt);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  function run(nextScenarioId: ScenarioId) {
    const next = scenarios[nextScenarioId];
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    setScenarioId(nextScenarioId);

    if (reduced) {
      setReached(next.stopAt);
      return;
    }

    setReached(0);

    for (let index = 1; index <= next.stopAt; index += 1) {
      timersRef.current.push(
        window.setTimeout(() => setReached(index), index * stepDelayMs),
      );
    }
  }

  const progress = reached < 0 ? 0 : reached / (stages.length - 1);
  const currentStep = scenario && reached >= 0
    ? scenario.steps[Math.min(reached, scenario.steps.length - 1)]
    : "Pick a request to see where Kyra lets it through and where it stops.";

  return (
    <div className="gate-demo">
      <div className="gate-demo-controls" role="group" aria-label="Approval path scenarios">
        {(Object.keys(scenarios) as ScenarioId[]).map((id) => (
          <button
            aria-pressed={scenarioId === id}
            className={scenarioId === id ? "is-active" : undefined}
            key={id}
            onClick={() => run(id)}
            type="button"
          >
            {scenarios[id].label}
          </button>
        ))}
      </div>

      <div
        className={`gate-track${scenario ? ` tone-${scenario.tone}` : ""}${finished ? " is-finished" : ""}`}
        style={{ "--gate-progress": progress } as CSSProperties}
      >
        <span className="gate-line" aria-hidden="true">
          <span className="gate-line-fill" />
          {scenario ? <span className="gate-packet" /> : null}
        </span>
        <ol className="gate-stages">
          {stages.map((stage, index) => {
            const Icon = scenario?.tone === "blocked" && index === 1 && finished ? Ban : stage.icon;
            const state = !scenario || reached < index
              ? scenario && index > scenario.stopAt ? "is-skipped" : ""
              : index === scenario.stopAt && finished
              ? "is-stop"
              : "is-reached";

            return (
              <li className={`gate-stage ${state}`} key={stage.id}>
                <span className="gate-stage-icon"><Icon size={17} /></span>
                <small>{stage.label}</small>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="gate-demo-status" aria-live="polite">{currentStep}</p>
    </div>
  );
}
