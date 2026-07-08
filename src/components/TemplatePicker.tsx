import { CheckCircle2, Clock3, LockKeyhole, Sparkles } from "lucide-react";
import type { AgentTemplate } from "../types/agent";
import type { SupabaseConnectionStatus } from "../services/supabaseKyraRepository";

interface TemplatePickerProps {
  templates: AgentTemplate[];
  selectedId: string;
  onSelect: (templateId: string) => void;
  catalogStatus: SupabaseConnectionStatus;
  catalogError: string | null;
}

const statusLabel = {
  mvp: "Ready",
  advanced: "Pro",
  "coming-soon": "Soon",
};

const statusIcon = {
  mvp: CheckCircle2,
  advanced: Sparkles,
  "coming-soon": Clock3,
};

function getCatalogTone(status: SupabaseConnectionStatus) {
  if (status === "connected") {
    return "ready";
  }

  return status === "error" ? "error" : "standby";
}

function getCatalogLabel(status: SupabaseConnectionStatus) {
  if (status === "connected") {
    return "Catalog: Connected";
  }

  if (status === "error") {
    return "Catalog: Built-in fallback";
  }

  return status === "checking" ? "Catalog: Checking" : "Catalog: Built-in";
}

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
        <h2>Start from a role users already understand.</h2>
        <p>
          Templates keep the product simple. Kyra modules handle orchestration, research, data, and security underneath.
        </p>
        <div className="catalog-status-row">
          <span className={`readiness-chip readiness-${getCatalogTone(catalogStatus)}`}>
            {getCatalogLabel(catalogStatus)}
          </span>
          {catalogError ? (
            <small>Connected catalog is temporarily offline. Built-in Kyra templates are loaded safely.</small>
          ) : null}
        </div>
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
