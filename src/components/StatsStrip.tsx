import { useEffect, useRef, useState } from "react";
import { Bot, Boxes, KeyRound, LayoutTemplate } from "lucide-react";
import { demoAgentLimits } from "../config/demoLimits";
import { coreModules } from "../data/modules";

interface StatsStripProps {
  templateCount: number;
}

interface CountUpProps {
  value: number;
  durationMs?: number;
}

function prefersReducedMotion() {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Counts from zero once the number scrolls into view. Renders the final value
// immediately without motion support so the figure is never wrong.
function CountUp({ value, durationMs = 1100 }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(() =>
    prefersReducedMotion() || typeof IntersectionObserver === "undefined"
      ? value
      : 0
  );

  useEffect(() => {
    const element = ref.current;

    if (
      !element || prefersReducedMotion() ||
      typeof IntersectionObserver === "undefined"
    ) {
      setDisplay(value);
      return;
    }

    let frame = 0;
    let settleTimer = 0;
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) {
        return;
      }

      observer.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(Math.round(value * eased));

        if (progress < 1) {
          frame = window.requestAnimationFrame(tick);
        }
      };
      frame = window.requestAnimationFrame(tick);
      // Frames can be throttled in background tabs; always land on the value.
      settleTimer = window.setTimeout(() => {
        window.cancelAnimationFrame(frame);
        setDisplay(value);
      }, durationMs + 300);
    }, { threshold: 0.6 });

    observer.observe(element);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
    };
  }, [durationMs, value]);

  return (
    <span className="stat-value" ref={ref} aria-hidden="true">
      {display}
    </span>
  );
}

export function StatsStrip({ templateCount }: StatsStripProps) {
  const stats = [
    {
      icon: LayoutTemplate,
      value: templateCount,
      label: "Agent templates",
      detail: "Operator to Strategist",
    },
    {
      icon: Boxes,
      value: coreModules.length,
      label: "Core modules",
      detail: "NIRA · VEXA · ASTRA · NOVA · NYX",
    },
    {
      icon: Bot,
      value: demoAgentLimits.maxAgentsPerWorkspace,
      label: "Agents per workspace",
      detail: "Private, account-scoped",
    },
    {
      icon: KeyRound,
      value: 0,
      label: "Private keys requested",
      detail: "Your wallet stays yours",
    },
  ];

  return (
    <section className="stats-strip" aria-label="Kyra at a glance">
      {stats.map((stat) => {
        const Icon = stat.icon;

        return (
          <article className="stat-card" key={stat.label}>
            <span className="stat-icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <div>
              <p className="stat-figure">
                <CountUp value={stat.value} />
                <span className="visually-hidden">{stat.value}</span>
                <span className="stat-label">{stat.label}</span>
              </p>
              <small>{stat.detail}</small>
            </div>
          </article>
        );
      })}
    </section>
  );
}
