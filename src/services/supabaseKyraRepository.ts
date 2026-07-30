import { appConfig } from "../config/appConfig";
import { agentTemplates as fallbackAgentTemplates } from "../data/templates";
import type { AgentTemplate } from "../types/agent";
import type { KyraDatabase, KyraTableName } from "../types/database";

export const supabaseKyraTables: KyraTableName[] = [
  "workspaces",
  "agent_templates",
  "agent_instances",
  "wallet_policies",
  "approval_requests",
  "activity_logs",
  "telegram_sessions",
];

export interface SupabaseAdapterStatus {
  configured: boolean;
  urlPresent: boolean;
  anonKeyPresent: boolean;
  tables: KyraTableName[];
  executionEnabled: false;
}

export type SupabaseConnectionStatus =
  | "not-configured"
  | "checking"
  | "connected"
  | "error";

export interface SupabaseTemplateCatalogResult {
  ok: boolean;
  status: SupabaseConnectionStatus;
  templates: AgentTemplate[];
  error: string | null;
  checkedAt: string;
}

export function getSupabaseAdapterStatus(): SupabaseAdapterStatus {
  return {
    configured: appConfig.supabase.configured,
    urlPresent: Boolean(appConfig.supabase.url),
    anonKeyPresent: appConfig.supabase.hasAnonKey,
    tables: supabaseKyraTables,
    executionEnabled: false,
  };
}

export type SupabaseTableRow<TName extends KyraTableName> =
  KyraDatabase["public"]["Tables"][TName]["Row"];

type SupabaseTemplateRow = SupabaseTableRow<"agent_templates">;

const templateOrder = [
  "operator",
  "scout",
  "steward",
  "executor",
  "strategist",
  "custom",
];
const obsoleteTemplateIds = new Set(["launcher"]);
const safetyReviewedTemplateById = new Map(
  fallbackAgentTemplates.map((template) => [template.id, template]),
);

function getSupabaseApiKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || "";
}

function getSupabaseRestUrl(query: string) {
  return `${appConfig.supabase.url.replace(/\/$/, "")}/rest/v1/${query}`;
}

function getSupabaseHeaders() {
  const apiKey = getSupabaseApiKey();
  const headers: Record<string, string> = {
    Accept: "application/json",
    apikey: apiKey,
  };

  if (apiKey && !apiKey.startsWith("sb_")) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

function asStringArray(value: SupabaseTemplateRow["actions"]): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function isBoundedString(value: unknown, maxLength: number): value is string {
  return typeof value === "string" && value.trim() === value && value.length > 0 &&
    value.length <= maxLength;
}

function isBoundedStringArray(
  value: unknown,
  maxItems: number,
  maxItemLength: number,
): value is string[] {
  return Array.isArray(value) && value.length <= maxItems &&
    value.every((item) => isBoundedString(item, maxItemLength));
}

function isTemplateRow(value: unknown): value is SupabaseTemplateRow {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const row = value as Record<string, unknown>;
  return Object.keys(row).sort().join(",") ===
      "actions,best_for,id,modules,name,role,status,summary,terminal_seed" &&
    typeof row.id === "string" && safetyReviewedTemplateById.has(row.id) &&
    isBoundedString(row.name, 80) &&
    isBoundedString(row.role, 120) &&
    (row.status === "mvp" || row.status === "advanced" || row.status === "coming-soon") &&
    isBoundedString(row.summary, 600) &&
    isBoundedString(row.best_for, 300) &&
    isBoundedStringArray(row.actions, 32, 96) &&
    isBoundedStringArray(row.modules, 16, 64) &&
    isBoundedString(row.terminal_seed, 160);
}

function mapTemplateRow(row: SupabaseTemplateRow): AgentTemplate {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    status: row.status,
    summary: row.summary,
    bestFor: row.best_for,
    actions: asStringArray(row.actions),
    modules: asStringArray(row.modules),
    terminalSeed: row.terminal_seed,
  };
}

function sortTemplates(templates: AgentTemplate[]) {
  return [...templates].sort((left, right) => {
    const leftIndex = templateOrder.indexOf(left.id);
    const rightIndex = templateOrder.indexOf(right.id);

    if (leftIndex === -1 && rightIndex === -1) {
      return left.name.localeCompare(right.name);
    }

    if (leftIndex === -1) {
      return 1;
    }

    if (rightIndex === -1) {
      return -1;
    }

    return leftIndex - rightIndex;
  });
}

function normalizeTemplateCatalog(templates: AgentTemplate[]) {
  const activeTemplates = templates
    .filter((template) => !obsoleteTemplateIds.has(template.id))
    .map((template) => {
      const safetyReviewedTemplate = safetyReviewedTemplateById.get(
        template.id,
      );

      if (!safetyReviewedTemplate) {
        return template;
      }

      return {
        ...template,
        name: safetyReviewedTemplate.name,
        role: safetyReviewedTemplate.role,
        summary: safetyReviewedTemplate.summary,
        bestFor: safetyReviewedTemplate.bestFor,
        actions: safetyReviewedTemplate.actions,
        modules: safetyReviewedTemplate.modules,
        terminalSeed: safetyReviewedTemplate.terminalSeed,
      };
    });

  if (activeTemplates.some((template) => template.id === "strategist")) {
    return activeTemplates;
  }

  const strategistFallback = fallbackAgentTemplates.find((template) =>
    template.id === "strategist"
  );

  return strategistFallback
    ? [...activeTemplates, strategistFallback]
    : activeTemplates;
}


async function fetchSupabaseJson(query: string): Promise<unknown> {
  if (!appConfig.supabase.configured) {
    throw new Error("Supabase URL or publishable key is missing.");
  }

  const response = await fetch(getSupabaseRestUrl(query), {
    headers: getSupabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed with HTTP ${response.status}.`);
  }

  return response.json() as Promise<unknown>;
}

export async function fetchSupabaseTemplates(): Promise<
  SupabaseTemplateCatalogResult
> {
  const checkedAt = new Date().toISOString();

  if (!appConfig.supabase.configured) {
    return {
      ok: false,
      status: "not-configured",
      templates: [],
      error: "Supabase environment variables are not configured.",
      checkedAt,
    };
  }

  try {
    const payload = await fetchSupabaseJson(
      "agent_templates?select=id,name,role,status,summary,best_for,actions,modules,terminal_seed",
    );
    if (!Array.isArray(payload) || !payload.every(isTemplateRow)) {
      throw new Error("Template catalog response is invalid.");
    }

    return {
      ok: true,
      status: "connected",
      templates: sortTemplates(
        normalizeTemplateCatalog(payload.map(mapTemplateRow)),
      ),
      error: null,
      checkedAt,
    };
  } catch {
    return {
      ok: false,
      status: "error",
      templates: [],
      error: "Template catalog is temporarily unavailable.",
      checkedAt,
    };
  }
}
