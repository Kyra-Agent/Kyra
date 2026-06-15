import { useEffect, useMemo, useState } from "react";
import { Bot, Radio, ShieldCheck, WalletCards } from "lucide-react";
import type { AgentTemplate } from "../types/agent";
import type { DemoScenario } from "../data/demoScenarios";

interface HeroConsoleProps {
  selectedTemplate: AgentTemplate;
  scenarios: DemoScenario[];
  selectedScenario: DemoScenario;
  onSelectScenario: (scenarioId: string) => void;
  onRequestApproval: () => void;
}

const asciiKyra = [
  "        .------.",
  "     .-'  KYRA '-.",
  "    /  .--------. \\",
  "   |  | 01 04 05 | |",
  "   |  |  BASE   | |",
  "    \\  '--------' /",
  "     '---.____.---'",
].join("\n");

export function HeroConsole({
  selectedTemplate,
  scenarios,
  selectedScenario,
  onSelectScenario,
  onRequestApproval,
}: HeroConsoleProps) {
  const [visibleCount, setVisibleCount] = useState(1);

  const lines = useMemo(
    () => [
      `kyra@base:~$ deploy --template ${selectedTemplate.id}`,
      "loading Telegram-native agent shell",
      "NIRA-01  routing intent",
      "NOVA-04  wallet data module synced",
      "NYX-05   risk guard active",
      "BASE ACTION review layer gated",
      `telegram> ${selectedScenario.command}`,
      ...selectedScenario.lines,
    ],
    [selectedScenario, selectedTemplate],
  );

  useEffect(() => {
    setVisibleCount(1);
    const timer = window.setInterval(() => {
      setVisibleCount((value) => {
        if (value >= lines.length) {
          window.clearInterval(timer);
          return value;
        }
        return value + 1;
      });
    }, 620);

    return () => window.clearInterval(timer);
  }, [lines]);

  useEffect(() => {
    if (!selectedScenario.approvalRequired || visibleCount < lines.length) {
      return;
    }

    const timer = window.setTimeout(onRequestApproval, 520);
    return () => window.clearTimeout(timer);
  }, [
    lines.length,
    onRequestApproval,
    selectedScenario.approvalRequired,
    visibleCount,
  ]);

  return (
    <section className="hero-shell" aria-label="Kyra demo console">
      <div className="hero-console-topbar">
        <div className="window-controls" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span>kyra-core/demo</span>
        <span className="live-indicator">live simulation</span>
      </div>

      <div className="hero-console-body">
        <pre className="ascii-kyra" aria-hidden="true">
          {asciiKyra}
        </pre>

        <div className="console-lines" aria-live="polite">
          {lines.slice(0, visibleCount).map((line) => (
            <p key={line}>
              <span className="prompt-mark">&gt;</span>
              {line}
            </p>
          ))}
          <span className="typing-caret" aria-hidden="true" />
        </div>

        <div className="command-presets" aria-label="Demo commands">
          {scenarios.map((scenario) => (
            <button
              className={scenario.id === selectedScenario.id ? "is-active" : ""}
              key={scenario.id}
              type="button"
              onClick={() => onSelectScenario(scenario.id)}
            >
              {scenario.label}
            </button>
          ))}
        </div>

        <div className="console-status-grid">
          <span>
            <Bot size={15} />
            Telegram ready
          </span>
          <span>
            <WalletCards size={15} />
            Wallet review
          </span>
          <span>
            <ShieldCheck size={15} />
            Risk checked
          </span>
          <span>
            <Radio size={15} />
            Base gated
          </span>
        </div>
      </div>
    </section>
  );
}
