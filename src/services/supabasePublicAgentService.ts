import { appConfig } from "../config/appConfig";
import type { AgentTemplate, TemplateStatus } from "../types/agent";
import {
  getProductChainByKey,
  type ProductChainKey,
} from "../config/productChains";
import type { DemoAgentInstance, DemoBackendTable, DemoRecordStatus } from "../types/backend";
import { selectPublicRows } from "./supabaseRestClient";

type PublicAgentMode = "demo" | "live";
type PublicAgentNetwork = ProductChainKey;
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
  chain_action_status: "disabled" | "ready" | "active" | "paused";
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBoundedString(
  value: unknown,
  maxLength: number,
  pattern?: RegExp,
): value is string {
  return typeof value === "string" &&
    value.trim() === value &&
    value.length > 0 &&
    value.length <= maxLength &&
    (!pattern || pattern.test(value));
}

function isStringList(
  value: unknown,
  maxItems = 32,
  maxItemLength = 96,
): value is string[] {
  return Array.isArray(value) &&
    value.length <= maxItems &&
    value.every((item) =>
      typeof item === "string" &&
      item.trim() === item &&
      item.length > 0 &&
      item.length <= maxItemLength
    );
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    value.length <= 40 &&
    !Number.isNaN(Date.parse(value));
}

function isPublicAgentSlug(value: unknown): value is string {
  return isBoundedString(
    value,
    96,
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
  );
}

function isPublicAgentProfileRow(
  value: unknown,
  expectedSlug: string,
): value is PublicAgentProfileRow {
  if (!isRecord(value)) {
    return false;
  }

  const templateStatus = value.template_status;
  const network = value.network;

  return value.public_slug === expectedSlug &&
    isPublicAgentSlug(value.public_slug) &&
    isBoundedString(value.display_name, 120) &&
    isBoundedString(value.handle, 64, /^@[A-Za-z][A-Za-z0-9_]{4,31}$/) &&
    (value.status === "online" ||
      value.status === "draft" ||
      value.status === "paused") &&
    (value.mode === "demo" || value.mode === "live") &&
    typeof network === "string" &&
    Boolean(getProductChainByKey(network as ProductChainKey)) &&
    (value.telegram_status === "mocked" ||
      value.telegram_status === "active" ||
      value.telegram_status === "queued" ||
      value.telegram_status === "review") &&
    (value.chain_action_status === "disabled" ||
      value.chain_action_status === "ready" ||
      value.chain_action_status === "active" ||
      value.chain_action_status === "paused") &&
    isIsoTimestamp(value.created_at) &&
    isIsoTimestamp(value.last_sync_at) &&
    isBoundedString(value.template_id, 48, /^[a-z0-9_-]+$/) &&
    isBoundedString(value.template_name, 80) &&
    isBoundedString(value.template_role, 160) &&
    (templateStatus === undefined ||
      templateStatus === "mvp" ||
      templateStatus === "advanced" ||
      templateStatus === "coming-soon") &&
    isBoundedString(value.template_summary, 600) &&
    isBoundedString(value.template_best_for, 300) &&
    isStringList(value.template_actions) &&
    isStringList(value.template_modules);
}

function asStringArray(value: unknown): string[] {
  if (!isStringList(value)) {
    return [];
  }

  return value;
}

function mapRecordStatus(status: PublicAgentRouteStatus): DemoRecordStatus {
  return status;
}

function mapChainActionRouteStatus(
  status: PublicAgentProfileRow["chain_action_status"],
): DemoRecordStatus {
  if (status === "active") return "active";
  if (status === "ready") return "review";
  return "queued";
}


function buildPublicAgentQuery(agentSlug: string) {
  return `public_agent_profiles?select=*&public_slug=eq.${encodeURIComponent(agentSlug)}&limit=1`;
}

function mapPublicAgentProfile(row: PublicAgentProfileRow): PublicAgentProfile {
  const chain = getProductChainByKey(row.network);

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
    mode: "backend-connected",
    chainKey: row.network,
    network: chain?.name ?? "Unsupported network",
    chainActionStatus: row.chain_action_status,
    telegramStatus: mapRecordStatus(row.telegram_status),
    chainRouteStatus: mapChainActionRouteStatus(row.chain_action_status),
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
): Promise<PublicAgentProfileResult> {
  if (!isPublicAgentSlug(agentSlug)) {
    return {
      ok: false,
      status: "empty",
      profile: null,
      error: "No public Supabase agent profile found for this route.",
    };
  }


  if (!appConfig.supabase.configured) {
    return {
      ok: false,
      status: "not-configured",
      profile: null,
      error: "Supabase environment variables are not configured.",
    };
  }

  try {
    const rows = await selectPublicRows<unknown>(
      buildPublicAgentQuery(agentSlug),
    );

    if (!rows[0] || !isPublicAgentProfileRow(rows[0], agentSlug)) {
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
  } catch {
    return {
      ok: false,
      status: "error",
      profile: null,
      error: "This public agent is temporarily unavailable.",
    };
  }
}
