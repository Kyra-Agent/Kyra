import { appConfig } from "../config/appConfig";
import type { AgentTemplate, TemplateStatus } from "../types/agent";
import type { DemoAgentInstance, DemoBackendTable, DemoRecordStatus } from "../types/backend";
import { sanitizeSupabaseMessage, selectPublicRows } from "./supabaseRestClient";

type PublicAgentMode = "demo" | "live";
type PublicAgentNetwork = "base";
type PublicAgentStatus = "online" | "draft" | "paused";
type PublicAgentRouteStatus = "mocked" | "active" | "queued" | "review";

interface PublicAgentProfileRow {
  public_slug: string;
  display_name: string;
  handle: string;
  status: PublicAgentStatus;
  mode: PublicAgentMode;
  network: PublicAgentNetwork;
  telegram_status: PublicAgentRouteStatus;
  base_mcp_status: PublicAgentRouteStatus;
  created_at: string;
  last_sync_at: string;
  template_id: string;
  template_name: string;
  template_role: string;
  template_status?: TemplateStatus;
  template_summary: string;
  template_best_for: string;
  template_actions: unknown;
  template_modules: unknown;
}

export type PublicAgentProfileStatus = "not-configured" | "loading" | "connected" | "empty" | "error";

export interface PublicAgentProfile {
  agent: DemoAgentInstance;
  template: AgentTemplate;
  backendTables: DemoBackendTable[];
}

export interface PublicAgentProfileResult {
  ok: boolean;
  status: Exclude<PublicAgentProfileStatus, "loading">;
  profile: PublicAgentProfile | null;
  error: string | null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string");
}

function mapRecordStatus(status: PublicAgentRouteStatus): DemoRecordStatus {
  return status;
}

function getTemplateIdFromSlug(agentSlug: string, fallbackTemplateId: string) {
  if (agentSlug.endsWith("-demo")) {
    return agentSlug.replace(/-demo$/, "");
  }

  const firstSegment = agentSlug.split("-")[0];
  return firstSegment || fallbackTemplateId;
}

function buildPublicAgentQuery(agentSlug: string, fallbackTemplateId: string) {
  if (agentSlug.endsWith("-demo")) {
    const templateId = getTemplateIdFromSlug(agentSlug, fallbackTemplateId);
    return `public_agent_profiles?select=*&template_id=eq.${encodeURIComponent(templateId)}&order=created_at.desc&limit=1`;
  }

  return `public_agent_profiles?select=*&public_slug=eq.${encodeURIComponent(agentSlug)}&limit=1`;
}

function mapPublicAgentProfile(row: PublicAgentProfileRow): PublicAgentProfile {
  const template: AgentTemplate = {
    id: row.template_id,
    name: row.template_name,
    role: row.template_role,
    status: row.template_status ?? "mvp",
    summary: row.template_summary,
    bestFor: row.template_best_for,
    actions: asStringArray(row.template_actions),
    modules: asStringArray(row.template_modules),
    terminalSeed: row.template_actions ? asStringArray(row.template_actions)[0] ?? "" : "",
  };
  const agent: DemoAgentInstance = {
    id: row.public_slug,
    workspaceId: "public_profile",
    templateId: row.template_id,
    displayName: row.display_name,
    handle: row.handle,
    publicPath: `/agents/${row.public_slug}`,
    status: row.status,
    mode: row.mode === "demo" ? "backend-demo" : "backend-demo",
    network: row.network === "base" ? "Base" : "Base",
    telegramStatus: mapRecordStatus(row.telegram_status),
    baseMcpStatus: mapRecordStatus(row.base_mcp_status),
    approvalPolicyId: "public_approval_required",
    createdAt: row.created_at,
    lastSyncAt: row.last_sync_at,
  };

  return {
    agent,
    template,
    backendTables: [
      {
        name: "public_agent_profiles",
        records: 1,
        status: "active",
        purpose: "Share-safe Supabase view for public agent identity.",
      },
      {
        name: "agent_templates",
        records: 1,
        status: "active",
        purpose: "Template summary, modules, and available actions.",
      },
    ],
  };
}

export async function fetchPublicAgentProfile(
  agentSlug: string,
  fallbackTemplateId: string,
): Promise<PublicAgentProfileResult> {
  if (!appConfig.supabase.configured) {
    return {
      ok: false,
      status: "not-configured",
      profile: null,
      error: "Supabase environment variables are not configured.",
    };
  }

  try {
    const rows = await selectPublicRows<PublicAgentProfileRow>(
      buildPublicAgentQuery(agentSlug, fallbackTemplateId),
    );

    if (!rows[0]) {
      return {
        ok: false,
        status: "empty",
        profile: null,
        error: "No public Supabase agent profile found for this route.",
      };
    }

    return {
      ok: true,
      status: "connected",
      profile: mapPublicAgentProfile(rows[0]),
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      profile: null,
      error:
        error instanceof Error
          ? sanitizeSupabaseMessage(error.message)
          : "Supabase public agent query failed.",
    };
  }
}
