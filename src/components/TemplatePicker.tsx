import type { CSSProperties } from "react";
import { CheckCircle2, Clock3, LockKeyhole, Sparkles } from "lucide-react";
import type { AgentTemplate } from "../types/agent";
import type { SupabaseConnectionStatus } from "../services/supabaseKyraRepository";
import { templateStarts } from "../config/agentSettings";
import { RevealHeading } from "./RevealHeading";

// Each template carries its own accent through the card (top bar, glow, tint).
const templateAccents: Record<string, string> = {
  operator: "#7aa8ff",
  scout: "#5fd4e8",
  steward: "#8ef0c4",
  executor: "#f6c978",
  strategist: "#b29bff",
  custom: "#ff9ad5",
};

interface TemplatePickerProps {
  templates: AgentTemplate[];
  selectedId: string;
  onSelect: (templateId: string) => void;
  catalogStatus: SupabaseConnectionStatus;
  catalogError: string | null;
}

const statusLabel = {
  mvp: "Ready",
  advanced: "Advanced",
  "coming-soon": "Soon",
};

const statusIcon = {
  mvp: CheckCircle2,
  advanced: Sparkles,
  "coming-soon": Clock3,
};

export function TemplatePicker({
  templates,
  selectedId,
  onSelect,
  catalogStatus,
  catalogError,
}: TemplatePickerProps) {
  return (
    <section className="section" id="templates">
      <div className="section-heading">
        <p className="eyebrow">Agent Templates</p>
        <RevealHeading text="Start from a role users already understand." />
        <p>
          Every agent gets every feature: live chain data, memory, alerts, and community mode. A template
          sets the starting focus, tone, and defaults, and you can change them anytime.
        </p>
        {catalogStatus === "error" && catalogError ? (
          <div className="catalog-status-row">
            <span className="readiness-chip readiness-error">Offline copy</span>
            <small>The live catalog is temporarily unreachable, so Kyra is showing its built-in templates.</small>
          </div>
        ) : null}
      </div>

      <div className="template-grid">
        {templates.map((template) => {
          const Icon = statusIcon[template.status];
          const active = selectedId === template.id;

          return (
            <button
              className={`template-card ${active ? "is-active" : ""}`}
              key={template.id}
              onClick={() => onSelect(template.id)}
              style={{ "--tpl": templateAccents[template.id] ?? "#7aa8ff" } as CSSProperties}
              type="button"
            >
              <span className="template-card-top">
                <span>
                  <strong>{template.name}</strong>
                  <small>{template.role}</small>
                </span>
                <span className={`status-pill status-${template.status}`}>
                  <Icon size={13} />
                  {statusLabel[template.status]}
                </span>
              </span>
              <span className="template-summary">{template.summary}</span>
              {templateStarts[template.id] ? (
                <span className="template-starts">
                  <strong>Starts with:</strong> {templateStarts[template.id]}
                </span>
              ) : null}
              <span className="chip-row">
                {template.actions.slice(0, 4).map((action) => (
                  <span className="chip" key={action}>
                    {action}
                  </span>
                ))}
              </span>
              {template.status === "coming-soon" ? (
                <span className="locked-line">
                  <LockKeyhole size={13} />
                  Planned after runtime validation
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
