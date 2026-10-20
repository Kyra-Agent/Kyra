import { CheckCircle2, Circle } from "lucide-react";
import {
  agentModuleOptions,
  agentPersonaOptions,
  agentRiskOptions,
  type AgentSettingsDraft,
  knowledgeFirstTemplateIds,
  maxAgentInstructionsLength,
  maxAgentKnowledgeLength,
  safetyLimitTemplateIds,
} from "../config/agentSettings";
import type { AgentTemplate } from "../types/agent";

interface AgentSettingsFieldsProps {
  idPrefix: string;
  template: AgentTemplate;
  value: AgentSettingsDraft;
  onChange: (next: AgentSettingsDraft) => void;
  disabled?: boolean;
}

const knowledgePlaceholders: Record<string, string> = {
  steward:
    "Token: ABC on Robinhood Chain\nContract: 0x...\nUnlock: March 1, 10% per month\nWebsite and X links\nFAQ: How do I claim? ...",
  strategist:
    "Project, audience, launch date, key message, what makes it different, channels you use.",
  custom:
    "Anything your agent should know: your project, your rules, links, FAQ answers.",
};

const instructionPlaceholders: Record<string, string> = {
  custom: "Example: You are our launch desk. Focus on campaign timing and community questions. Always end with one next step.",
  steward: "Example: Answer like our community manager. Point people to the website for anything not in the knowledge.",
};

// Owner settings for an agent: tone, actions, focus, project knowledge, and
// safety limits. Used in the deploy wizard and the dashboard.
export function AgentSettingsFields({
  idPrefix,
  template,
  value,
  onChange,
  disabled = false,
}: AgentSettingsFieldsProps) {
  const activeActions = value.enabledActions.length
    ? new Set(value.enabledActions)
    : new Set(template.actions);
  const activeModules = value.enabledModules.length
    ? new Set(value.enabledModules)
    : new Set(template.modules);
  const isCustom = template.id === "custom";
  const showSafety = safetyLimitTemplateIds.has(template.id);
  const knowledgeFirst = knowledgeFirstTemplateIds.has(template.id);

  function update(patch: Partial<AgentSettingsDraft>) {
    onChange({ ...value, ...patch });
  }

  function toggleAction(action: string) {
    const next = new Set(activeActions);

    if (next.has(action)) {
      if (next.size === 1) {
        return;
      }
      next.delete(action);
    } else {
      next.add(action);
    }

    update({
      enabledActions: next.size === template.actions.length
        ? []
        : template.actions.filter((item) => next.has(item)),
    });
  }

  function toggleModule(moduleId: string) {
    const next = new Set(activeModules);

    if (next.has(moduleId)) {
      if (next.size === 1) {
        return;
      }
      next.delete(moduleId);
    } else {
      next.add(moduleId);
    }

    update({
      enabledModules: agentModuleOptions
        .map((option) => option.id)
        .filter((id) => next.has(id)),
    });
  }

  return (
    <div className="agent-settings-fields">
      <fieldset className="agent-settings-group" disabled={disabled}>
        <legend>Tone</legend>
        <div className="agent-settings-options" role="radiogroup" aria-label="Agent tone">
          {agentPersonaOptions.map((option) => (
            <button
              aria-checked={value.persona === option.id}
              className={value.persona === option.id ? "is-selected" : undefined}
              key={option.id}
              onClick={() => update({ persona: option.id })}
              role="radio"
              type="button"
            >
              <strong>{option.label}</strong>
              <small>{option.hint}</small>
            </button>
          ))}
        </div>
      </fieldset>

      {/* Custom's catalog entries describe these settings, not chat actions. */}
      {isCustom ? null : (
      <fieldset className="agent-settings-group" disabled={disabled}>
        <legend>Actions</legend>
        <p className="agent-settings-hint">Tap to switch an action off. At least one stays on.</p>
        <div className="chip-row">
          {template.actions.map((action) => {
            const on = activeActions.has(action);

            return (
              <button
                aria-pressed={on}
                className={`chip agent-settings-chip${on ? " chip-active" : ""}`}
                key={action}
                onClick={() => toggleAction(action)}
                type="button"
              >
                {on ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                {action}
              </button>
            );
          })}
        </div>
      </fieldset>
      )}

      {isCustom ? (
        <fieldset className="agent-settings-group" disabled={disabled}>
          <legend>Modules</legend>
          <p className="agent-settings-hint">Pick the Kyra modules this agent runs on.</p>
          <div className="chip-row">
            {agentModuleOptions.map((option) => {
              const on = activeModules.has(option.id);

              return (
                <button
                  aria-pressed={on}
                  className={`chip agent-settings-chip${on ? " chip-active" : ""}`}
                  key={option.id}
                  onClick={() => toggleModule(option.id)}
                  type="button"
                >
                  {on ? <CheckCircle2 size={13} /> : <Circle size={13} />}
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      ) : null}

      <label className="field agent-settings-text" htmlFor={`${idPrefix}-instructions`}>
        <span>
          {isCustom ? "Custom prompt" : "Instructions"}
          <small>{value.instructions.length}/{maxAgentInstructionsLength}</small>
        </span>
        <textarea
          disabled={disabled}
          id={`${idPrefix}-instructions`}
          maxLength={maxAgentInstructionsLength}
          onChange={(event) => update({ instructions: event.target.value })}
          placeholder={instructionPlaceholders[template.id] ??
            "Example: Focus on swap reviews for USDC and ETH. Keep answers under ten lines."}
          rows={3}
          value={value.instructions}
        />
      </label>

      <label className="field agent-settings-text" htmlFor={`${idPrefix}-knowledge`}>
        <span>
          Project knowledge{knowledgeFirst ? "" : " (optional)"}
          <small>{value.knowledge.length}/{maxAgentKnowledgeLength}</small>
        </span>
        <textarea
          disabled={disabled}
          id={`${idPrefix}-knowledge`}
          maxLength={maxAgentKnowledgeLength}
          onChange={(event) => update({ knowledge: event.target.value })}
          placeholder={knowledgePlaceholders[template.id] ??
            "Facts your agent can rely on: tokens you track, your rules, useful links."}
          rows={knowledgeFirst ? 6 : 3}
          value={value.knowledge}
        />
        <small className="agent-settings-hint">
          Your agent answers project questions only from this text. Never paste private keys, seed phrases, or passwords.
        </small>
      </label>

      {showSafety ? (
        <fieldset className="agent-settings-group" disabled={disabled}>
          <legend>Safety limits</legend>
          <div className="agent-settings-options" role="radiogroup" aria-label="Risk profile">
            {agentRiskOptions.map((option) => (
              <button
                aria-checked={value.riskProfile === option.id}
                className={value.riskProfile === option.id ? "is-selected" : undefined}
                key={option.id}
                onClick={() => update({ riskProfile: option.id })}
                role="radio"
                type="button"
              >
                <strong>{option.label}</strong>
                <small>{option.hint}</small>
              </button>
            ))}
          </div>
          <label className="field agent-settings-limit" htmlFor={`${idPrefix}-limit`}>
            <span>Review limit per action (USD, optional)</span>
            <input
              id={`${idPrefix}-limit`}
              inputMode="numeric"
              onChange={(event) =>
                update({ maxReviewUsd: event.target.value.replace(/[^\d]/g, "").slice(0, 8) })}
              placeholder="e.g. 500"
              value={value.maxReviewUsd}
            />
          </label>
        </fieldset>
      ) : null}
    </div>
  );
}
