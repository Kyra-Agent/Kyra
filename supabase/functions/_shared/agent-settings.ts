// Owner settings for a deployed agent (see the agent_settings migration).
// Shared by deploy-agent, agent-settings, and the Telegram webhook so the
// limits and allowed values live in one place.

export const agentPersonas = ["professional", "friendly", "concise", "bold"] as const;
export const agentRiskProfiles = ["conservative", "balanced", "aggressive"] as const;
export const agentModuleIds = [
  "NIRA-01",
  "VEXA-02",
  "ASTRA-03",
  "NOVA-04",
  "NYX-05",
] as const;

export type AgentPersona = typeof agentPersonas[number];
export type AgentRiskProfile = typeof agentRiskProfiles[number];

export interface AgentSettings {
  persona: AgentPersona;
  instructions: string;
  knowledge: string;
  enabledActions: string[];
  enabledModules: string[];
  riskProfile: AgentRiskProfile;
  maxReviewUsd: number | null;
}

export interface AgentSettingsRow {
  persona: string;
  instructions: string;
  knowledge: string;
  enabled_actions: string[];
  enabled_modules: string[];
  risk_profile: string;
  max_review_usd: number | null;
}

export type AgentSettingsValidation =
  | { ok: true; settings: AgentSettings }
  | { ok: false; field: string; message: string };

export const maxAgentInstructionsLength = 1000;
export const maxAgentKnowledgeLength = 4000;
export const maxAgentReviewUsd = 10_000_000;

const secretPatterns = [
  /\d{5,20}:[A-Za-z0-9_-]{20,128}/g,
  /sk-(?:or-v1-)?[A-Za-z0-9_-]{20,}/g,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /(?<![0-9A-Fa-fx])[0-9A-Fa-f]{64}(?![0-9A-Fa-f])/g,
];

export function defaultAgentSettings(): AgentSettings {
  return {
    persona: "professional",
    instructions: "",
    knowledge: "",
    enabledActions: [],
    enabledModules: [],
    riskProfile: "balanced",
    maxReviewUsd: null,
  };
}

// Validates owner input. Unknown fields are ignored; missing fields keep the
// defaults. Actions are limited to the template's own catalog.
export function validateAgentSettings(
  value: unknown,
  templateActions: readonly string[],
): AgentSettingsValidation {
  const settings = defaultAgentSettings();

  if (value === undefined || value === null) {
    return { ok: true, settings };
  }

  if (typeof value !== "object" || Array.isArray(value)) {
    return invalid("settings", "Settings must be an object.");
  }

  const input = value as Record<string, unknown>;

  if (input.persona !== undefined) {
    if (!isOneOf(input.persona, agentPersonas)) {
      return invalid("persona", "Choose a supported tone.");
    }
    settings.persona = input.persona;
  }

  if (input.instructions !== undefined) {
    const text = readOwnerText(input.instructions);
    if (text === null) {
      return invalid("instructions", "Instructions must be text.");
    }
    if (text.length > maxAgentInstructionsLength) {
      return invalid(
        "instructions",
        `Instructions can be at most ${maxAgentInstructionsLength} characters.`,
      );
    }
    settings.instructions = text;
  }

  if (input.knowledge !== undefined) {
    const text = readOwnerText(input.knowledge);
    if (text === null) {
      return invalid("knowledge", "Project knowledge must be text.");
    }
    if (text.length > maxAgentKnowledgeLength) {
      return invalid(
        "knowledge",
        `Project knowledge can be at most ${maxAgentKnowledgeLength} characters.`,
      );
    }
    settings.knowledge = text;
  }

  if (input.enabledActions !== undefined) {
    const actions = readStringList(input.enabledActions);
    if (!actions) {
      return invalid("enabledActions", "Actions must be a list.");
    }
    const allowed = new Set(templateActions);
    const filtered = [...new Set(actions)].filter((action) => allowed.has(action));
    if (actions.length && !filtered.length) {
      return invalid("enabledActions", "Keep at least one template action on.");
    }
    settings.enabledActions = filtered.length === allowed.size ? [] : filtered;
  }

  if (input.enabledModules !== undefined) {
    const modules = readStringList(input.enabledModules);
    if (!modules) {
      return invalid("enabledModules", "Modules must be a list.");
    }
    const filtered = [...new Set(modules)].filter((module) =>
      (agentModuleIds as readonly string[]).includes(module)
    );
    if (modules.length && !filtered.length) {
      return invalid("enabledModules", "Keep at least one module on.");
    }
    settings.enabledModules = filtered;
  }

  if (input.riskProfile !== undefined) {
    if (!isOneOf(input.riskProfile, agentRiskProfiles)) {
      return invalid("riskProfile", "Choose a supported risk profile.");
    }
    settings.riskProfile = input.riskProfile;
  }

  if (input.maxReviewUsd !== undefined && input.maxReviewUsd !== null && input.maxReviewUsd !== "") {
    const amount = Number(input.maxReviewUsd);
    if (
      !Number.isInteger(amount) || amount < 1 || amount > maxAgentReviewUsd
    ) {
      return invalid(
        "maxReviewUsd",
        "The review limit must be a whole number of US dollars, 1 or more.",
      );
    }
    settings.maxReviewUsd = amount;
  }

  return { ok: true, settings };
}

export function toAgentSettingsRow(settings: AgentSettings): AgentSettingsRow {
  return {
    persona: settings.persona,
    instructions: settings.instructions,
    knowledge: settings.knowledge,
    enabled_actions: settings.enabledActions,
    enabled_modules: settings.enabledModules,
    risk_profile: settings.riskProfile,
    max_review_usd: settings.maxReviewUsd,
  };
}

// Reads a stored row defensively; anything unexpected falls back to defaults.
export function fromAgentSettingsRow(value: unknown): AgentSettings {
  const settings = defaultAgentSettings();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return settings;
  }

  const row = value as Record<string, unknown>;

  if (isOneOf(row.persona, agentPersonas)) {
    settings.persona = row.persona;
  }
  settings.instructions = (readOwnerText(row.instructions) ?? "").slice(
    0,
    maxAgentInstructionsLength,
  );
  settings.knowledge = (readOwnerText(row.knowledge) ?? "").slice(
    0,
    maxAgentKnowledgeLength,
  );
  settings.enabledActions = readStringList(row.enabled_actions) ?? [];
  settings.enabledModules = (readStringList(row.enabled_modules) ?? []).filter(
    (module) => (agentModuleIds as readonly string[]).includes(module),
  );
  if (isOneOf(row.risk_profile, agentRiskProfiles)) {
    settings.riskProfile = row.risk_profile;
  }
  const amount = Number(row.max_review_usd);
  settings.maxReviewUsd = row.max_review_usd !== null &&
      Number.isInteger(amount) && amount >= 1 && amount <= maxAgentReviewUsd
    ? amount
    : null;

  return settings;
}

function readOwnerText(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  let text = value
    .replace(/\r\n?/g, "\n")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");

  for (const pattern of secretPatterns) {
    text = text.replace(pattern, "[redacted]");
  }

  return text.replace(/\n{3,}/g, "\n\n").trim();
}

function readStringList(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0 && item.length <= 48)
    .slice(0, 12);
}

function isOneOf<T extends string>(
  value: unknown,
  options: readonly T[],
): value is T {
  return typeof value === "string" && (options as readonly string[]).includes(value);
}

function invalid(field: string, message: string): AgentSettingsValidation {
  return { ok: false, field, message };
}
