import { appConfig } from "../config/appConfig";
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

export type SupabaseConnectionStatus = "not-configured" | "checking" | "connected" | "error";

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

export type SupabaseTableRow<TName extends KyraTableName> = KyraDatabase["public"]["Tables"][TName]["Row"];

type SupabaseTemplateRow = SupabaseTableRow<"agent_templates">;

const templateOrder = ["operator", "scout", "steward", "executor", "launcher", "custom"];

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

async function fetchSupabaseJson<T>(query: string): Promise<T> {
  if (!appConfig.supabase.configured) {
    throw new Error("Supabase URL or publishable key is missing.");
  }

  const response = await fetch(getSupabaseRestUrl(query), {
    headers: getSupabaseHeaders(),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Supabase request failed with ${response.status}.`);
  }

  return response.json() as Promise<T>;
}

export async function fetchSupabaseTemplates(): Promise<SupabaseTemplateCatalogResult> {
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
    const rows = await fetchSupabaseJson<SupabaseTemplateRow[]>(
      "agent_templates?select=id,name,role,status,summary,best_for,actions,modules,terminal_seed",
    );

    return {
      ok: true,
      status: "connected",
      templates: sortTemplates(rows.map(mapTemplateRow)),
      error: null,
      checkedAt,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      templates: [],
      error: error instanceof Error ? error.message : "Supabase request failed.",
      checkedAt,
    };
  }
}
