// Owner settings for a deployed agent. Limits mirror
// supabase/functions/_shared/agent-settings.ts, which is the source of truth.

export type AgentPersona = "professional" | "friendly" | "concise" | "bold";
export type AgentRiskProfile = "conservative" | "balanced" | "aggressive";

export interface AgentSettingsDraft {
  persona: AgentPersona;
  instructions: string;
  knowledge: string;
  // Empty means every template action stays on.
  enabledActions: string[];
  // Empty means the template's own module stack.
  enabledModules: string[];
  riskProfile: AgentRiskProfile;
  // Kept as text while editing; empty means no limit.
  maxReviewUsd: string;
}

export const maxAgentInstructionsLength = 1000;
export const maxAgentKnowledgeLength = 4000;

export const agentPersonaOptions: ReadonlyArray<{
  id: AgentPersona;
  label: string;
  hint: string;
}> = [
  { id: "professional", label: "Professional", hint: "Clear and measured" },
  { id: "friendly", label: "Friendly", hint: "Warm and encouraging" },
  { id: "concise", label: "Concise", hint: "Short bullets, no fluff" },
  { id: "bold", label: "Bold", hint: "Confident, never hype" },
];

export const agentRiskOptions: ReadonlyArray<{
  id: AgentRiskProfile;
  label: string;
  hint: string;
}> = [
  { id: "conservative", label: "Conservative", hint: "Flags every material risk" },
  { id: "balanced", label: "Balanced", hint: "Weighs risk against goals" },
  { id: "aggressive", label: "Aggressive", hint: "Direct, accepts more risk" },
];

export const agentModuleOptions: ReadonlyArray<{ id: string; label: string }> = [
  { id: "NIRA-01", label: "NIRA-01 · Lead" },
  { id: "VEXA-02", label: "VEXA-02 · Recon" },
  { id: "ASTRA-03", label: "ASTRA-03 · Research" },
  { id: "NOVA-04", label: "NOVA-04 · Data" },
  { id: "NYX-05", label: "NYX-05 · Security" },
];

// Templates whose label promises project answers or a custom setup get the
// knowledge field up front; every template can still use it.
export const knowledgeFirstTemplateIds = new Set(["steward", "strategist", "custom"]);
export const safetyLimitTemplateIds = new Set(["operator", "executor", "custom"]);

export function createDefaultAgentSettings(): AgentSettingsDraft {
  return {
    persona: "professional",
    instructions: "",
    knowledge: "",
    enabledActions: [],
    enabledModules: [],
    riskProfile: "balanced",
    maxReviewUsd: "",
  };
}

// Every template can use every feature; these starting points give each one
// its own feel. Owners can change them in the wizard or the dashboard.
const templateSettingDefaults: Record<
  string,
  Pick<AgentSettingsDraft, "persona" | "riskProfile">
> = {
  operator: { persona: "professional", riskProfile: "balanced" },
  scout: { persona: "concise", riskProfile: "balanced" },
  steward: { persona: "friendly", riskProfile: "balanced" },
  executor: { persona: "concise", riskProfile: "conservative" },
  strategist: { persona: "bold", riskProfile: "balanced" },
  custom: { persona: "professional", riskProfile: "balanced" },
};

// What each template turns on or leans into from day one, shown on the
// template cards and in the deploy wizard.
export const templateStarts: Record<string, string> = {
  operator: "wallet checks, /watch and /alert, balanced risk",
  scout: "launch digests on, token checks, concise replies",
  steward: "friendly tone, project knowledge, community mode for your group",
  executor: "conservative risk, DCA and stop-loss swap prompts",
  strategist: "bold tone, campaign plans and launch copy",
  custom: "your own prompt, modules, and safety limits",
};

export function getTemplateSettingDefaults(templateId: string) {
  return templateSettingDefaults[templateId] ??
    { persona: "professional" as const, riskProfile: "balanced" as const };
}

export function readAgentSettingsDraft(value: unknown): AgentSettingsDraft {
  const draft = createDefaultAgentSettings();

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return draft;
  }

  const row = value as Record<string, unknown>;
  const persona = row.persona;
  const risk = row.riskProfile ?? row.risk_profile;
  const actions = row.enabledActions ?? row.enabled_actions;
  const modules = row.enabledModules ?? row.enabled_modules;
  const limit = row.maxReviewUsd ?? row.max_review_usd;

  if (agentPersonaOptions.some((option) => option.id === persona)) {
    draft.persona = persona as AgentPersona;
  }
  if (agentRiskOptions.some((option) => option.id === risk)) {
    draft.riskProfile = risk as AgentRiskProfile;
  }
  if (typeof row.instructions === "string") {
    draft.instructions = row.instructions;
  }
  if (typeof row.knowledge === "string") {
    draft.knowledge = row.knowledge;
  }
  if (Array.isArray(actions)) {
    draft.enabledActions = actions.filter((item): item is string => typeof item === "string");
  }
  if (Array.isArray(modules)) {
    draft.enabledModules = modules.filter((item): item is string => typeof item === "string");
  }
  if (typeof limit === "number" && Number.isInteger(limit) && limit > 0) {
    draft.maxReviewUsd = String(limit);
  }

  return draft;
}

export function getAgentSettingsProblem(draft: AgentSettingsDraft) {
  if (draft.instructions.length > maxAgentInstructionsLength) {
    return `Instructions can be at most ${maxAgentInstructionsLength} characters.`;
  }

  if (draft.knowledge.length > maxAgentKnowledgeLength) {
    return `Project knowledge can be at most ${maxAgentKnowledgeLength} characters.`;
  }

  const limit = draft.maxReviewUsd.trim();

  if (limit && (!/^\d+$/.test(limit) || Number(limit) < 1 || Number(limit) > 10_000_000)) {
    return "The review limit must be a whole number of US dollars, 1 or more.";
  }

  return null;
}

export function toAgentSettingsPayload(draft: AgentSettingsDraft) {
  const limit = draft.maxReviewUsd.trim();

  return {
    persona: draft.persona,
    instructions: draft.instructions.trim(),
    knowledge: draft.knowledge.trim(),
    enabledActions: draft.enabledActions,
    enabledModules: draft.enabledModules,
    riskProfile: draft.riskProfile,
    maxReviewUsd: limit ? Number(limit) : null,
  };
}
