import { appConfig } from "../config/appConfig";
import type {
  DemoActivityLog,
  DemoAgentInstance,
  DemoApprovalRequest,
  DemoBackendTable,
  DemoRecordStatus,
  DemoTelegramSessionSummary,
  DemoTelegramWebhookStatus,
  DemoWalletPolicy,
  DemoWorkspaceRecord,
} from "../types/backend";
import type { KyraDatabase } from "../types/database";
import {
  getSupabaseApiKey,
  sanitizeSupabaseMessage,
  selectRows,
  type SupabaseTableRow,
} from "./supabaseRestClient";
import type { KyraAuthSession } from "./supabaseAuthService";

type WorkspaceRow = SupabaseTableRow<"workspaces">;
type AgentInstanceRow = SupabaseTableRow<"agent_instances">;
type ApprovalRequestRow = SupabaseTableRow<"approval_requests">;
type WalletPolicyRow = SupabaseTableRow<"wallet_policies">;
type ActivityLogRow = SupabaseTableRow<"activity_logs">;
type ApprovalStatus = KyraDatabase["public"]["Tables"]["approval_requests"]["Row"]["status"];

interface TelegramSessionSummaryRow {
  id: string;
  agent_id: string;
  bot_handle: string | null;
  webhook_status: DemoTelegramWebhookStatus;
  created_at: string;
  last_event_at: string | null;
}

export type SupabaseDashboardStatus = "not-configured" | "loading" | "connected" | "empty" | "error";

export interface SupabaseDashboardData {
  workspace: DemoWorkspaceRecord;
  agentInstances: DemoAgentInstance[];
  approvalRequests: DemoApprovalRequest[];
  walletPolicies: DemoWalletPolicy[];
  backendTables: DemoBackendTable[];
  activityLogs: DemoActivityLog[];
  telegramSessions: DemoTelegramSessionSummary[];
  latestAgent: DemoAgentInstance | null;
  loadedAt: string;
}

export interface SupabaseDashboardResult {
  ok: boolean;
  status: Exclude<SupabaseDashboardStatus, "loading">;
  data: SupabaseDashboardData | null;
  error: string | null;
}

export interface ResetSupabaseDemoWorkspaceResult {
  ok: boolean;
  message: string;
  recordsRemoved: boolean;
  code?: string;
  failureKind?: "session" | "admin" | "backend" | "configuration" | "unknown";
}

interface ResetDemoWorkspaceFunctionResponse {
  ok?: boolean;
  status?: string;
  message?: string;
  reset?: {
    recordsRemoved?: boolean;
  };
}

function parseResetDemoWorkspaceFunctionResponse(text: string): ResetDemoWorkspaceFunctionResponse {
  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as ResetDemoWorkspaceFunctionResponse;
  } catch {
    return {
      message: "Backend reset endpoint returned an invalid response.",
    };
  }
}

function getResetFailureKind(statusCode: number, code: string) {
  if (statusCode === 401 || code === "unauthorized") {
    return "session" as const;
  }

  if (statusCode === 403 || code === "forbidden") {
    return "admin" as const;
  }

  if (code === "missing_env" || code === "function_not_configured") {
    return "configuration" as const;
  }

  if (statusCode === 404 || statusCode >= 500) {
    return "backend" as const;
  }

  return "unknown" as const;
}

function getResetFailureMessage(statusCode: number, code: string, fallback: string) {
  const safeFallback = sanitizeSupabaseMessage(fallback);

  switch (getResetFailureKind(statusCode, code)) {
    case "session":
      return "Account session expired or is invalid. Sign in again before resetting demo agents.";
    case "admin":
      return "Admin role is required for demo workspace reset.";
    case "configuration":
      return "Backend reset endpoint is not fully configured.";
    case "backend":
      return "Kyra reset backend is unavailable. No demo workspace records were deleted.";
    case "unknown":
    default:
      return safeFallback || "Demo workspace reset failed.";
  }
}

function encodeFilter(value: string) {
  return encodeURIComponent(value);
}

function mapRecordStatus(status: AgentInstanceRow["telegram_status"]): DemoRecordStatus {
  return status === "review" ? "review" : status;
}

function mapWorkspace(row: WorkspaceRow, session: KyraAuthSession): DemoWorkspaceRecord {
  return {
    id: row.id,
    name: row.name,
    owner: "Signed-in account",
    mode: "backend-demo",
    authProvider: "supabase",
  };
}

function mapAgent(row: AgentInstanceRow): DemoAgentInstance {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    templateId: row.template_id,
    displayName: row.display_name,
    handle: row.handle,
    publicPath: `/agents/${row.public_slug}`,
    status: row.status,
    mode: "backend-demo",
    network: "Base",
    telegramStatus: mapRecordStatus(row.telegram_status),
    baseMcpStatus: mapRecordStatus(row.base_mcp_status),
    approvalPolicyId: row.approval_policy_id ?? "",
    createdAt: row.created_at,
    lastSyncAt: row.last_sync_at,
  };
}

function normalizeApprovalStatus(status: ApprovalStatus): DemoApprovalRequest["status"] {
  if (status === "approved" || status === "rejected") {
    return status;
  }

  return status;
}

function mapApprovalRequest(
  row: ApprovalRequestRow,
  agentTemplateLookup: Map<string, string>,
): DemoApprovalRequest {
  return {
    id: row.id,
    agentId: row.agent_id,
    templateId: agentTemplateLookup.get(row.agent_id) ?? "operator",
    scenarioId: row.scenario_id ?? "supabase-demo",
    title: row.title,
    command: row.command,
    route: row.route,
    risk: row.risk,
    status: normalizeApprovalStatus(row.status),
    feePayer: row.fee_payer,
    requiresWallet: row.requires_wallet,
    createdAt: row.created_at,
  };
}

function shortenAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function mapWalletPolicy(row: WalletPolicyRow): DemoWalletPolicy[] {
  return [
    {
      id: `${row.id}_account`,
      label: row.wallet_label,
      value: row.wallet_address ? shortenAddress(row.wallet_address) : "Demo connected",
      status: row.status === "active" ? "active" : "simulated",
      description: "Persisted demo policy record, no real funds touched.",
    },
    {
      id: `${row.id}_limit`,
      label: "Daily limit",
      value: row.daily_limit_usdc ? `${row.daily_limit_usdc} USDC` : "No cap set",
      status: "simulated",
      description: "Stored spending cap for future wallet policy enforcement.",
    },
    {
      id: `${row.id}_approval`,
      label: "Approval gate",
      value: row.approval_required ? "Required" : "Optional",
      status: row.approval_required ? "active" : "simulated",
      description: "Every write action remains behind wallet approval.",
    },
  ];
}

function formatTimestamp(value: string) {
  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function mapActivityLog(row: ActivityLogRow): DemoActivityLog {
  return {
    id: row.id,
    timestamp: formatTimestamp(row.created_at),
    source: row.source,
    level: row.level,
    message: row.message,
  };
}

function mapTelegramSessionSummary(row: TelegramSessionSummaryRow): DemoTelegramSessionSummary {
  return {
    id: row.id,
    agentId: row.agent_id,
    botHandle: row.bot_handle,
    webhookStatus: row.webhook_status,
    createdAt: row.created_at,
    lastEventAt: row.last_event_at,
  };
}

function countTable<T>(rows: T[], status: DemoRecordStatus, purpose: string, name: string): DemoBackendTable {
  return {
    name,
    records: rows.length,
    status,
    purpose,
  };
}

function createBackendTables(
  workspaces: WorkspaceRow[],
  agents: AgentInstanceRow[],
  approvals: ApprovalRequestRow[],
  policies: WalletPolicyRow[],
  logs: ActivityLogRow[],
  telegramSessions: TelegramSessionSummaryRow[],
): DemoBackendTable[] {
  return [
    countTable(workspaces, "active", "Account owner, auth mode, and workspace scope.", "workspaces"),
    countTable(agents, "active", "Template, handle, public route, status, and Base network.", "agent_instances"),
    countTable(
      approvals,
      "active",
      "Command, route, risk, fee payer, and wallet approval state.",
      "approval_requests",
    ),
    countTable(policies, "active", "Connected wallet label, spending limit, and approval gate.", "wallet_policies"),
    countTable(logs, "active", "Replayable server-style logs for the dashboard stream.", "activity_logs"),
    countTable(telegramSessions, "active", "Telegram handle, webhook state, and bot session metadata.", "telegram_sessions"),
  ];
}

export async function fetchSupabaseDashboardData(
  session: KyraAuthSession | null,
): Promise<SupabaseDashboardResult> {
  if (!session) {
    return {
      ok: false,
      status: "empty",
      data: null,
      error: "Sign in to load demo workspace records.",
    };
  }

  if (!appConfig.supabase.configured) {
    return {
      ok: false,
      status: "not-configured",
      data: null,
      error: "Backend environment is not configured.",
    };
  }

  try {
    const workspaces = await selectRows<WorkspaceRow>(
      session,
      "workspaces?select=id,owner_user_id,name,mode,created_at&mode=eq.demo&order=created_at.asc&limit=1",
    );
    const workspace = workspaces[0];

    if (!workspace) {
      return {
        ok: false,
        status: "empty",
        data: null,
        error: "No demo workspace exists yet. Deploy a demo agent first.",
      };
    }

    const workspaceFilter = encodeFilter(workspace.id);
    const [agents, walletPolicies, approvalRequests, activityLogs] = await Promise.all([
      selectRows<AgentInstanceRow>(
        session,
        `agent_instances?select=*&workspace_id=eq.${workspaceFilter}&order=created_at.desc&limit=20`,
      ),
      selectRows<WalletPolicyRow>(
        session,
        `wallet_policies?select=*&workspace_id=eq.${workspaceFilter}&order=created_at.desc&limit=20`,
      ),
      selectRows<ApprovalRequestRow>(
        session,
        `approval_requests?select=*&workspace_id=eq.${workspaceFilter}&order=created_at.desc&limit=20`,
      ),
      selectRows<ActivityLogRow>(
        session,
        `activity_logs?select=*&workspace_id=eq.${workspaceFilter}&order=created_at.desc&limit=30`,
      ),
    ]);

    const agentIds = agents.map((agent) => agent.id);
    const telegramSessions =
      agentIds.length > 0
        ? await selectRows<TelegramSessionSummaryRow>(
            session,
            `telegram_session_summaries?select=id,agent_id,bot_handle,webhook_status,created_at,last_event_at&agent_id=in.(${agentIds.map(encodeFilter).join(",")})&order=created_at.desc&limit=20`,
          )
        : [];
    const mappedAgents = agents.map(mapAgent);
    const agentTemplateLookup = new Map(agents.map((agent) => [agent.id, agent.template_id]));
    const latestAgent = mappedAgents[0] ?? null;

    return {
      ok: true,
      status: "connected",
      data: {
        workspace: mapWorkspace(workspace, session),
        agentInstances: mappedAgents,
        approvalRequests: approvalRequests.map((request) =>
          mapApprovalRequest(request, agentTemplateLookup),
        ),
        walletPolicies: walletPolicies.flatMap(mapWalletPolicy).slice(0, 6),
        backendTables: createBackendTables(
          workspaces,
          agents,
          approvalRequests,
          walletPolicies,
          activityLogs,
          telegramSessions,
        ),
        activityLogs: activityLogs.map(mapActivityLog),
        telegramSessions: telegramSessions.map(mapTelegramSessionSummary),
        latestAgent,
        loadedAt: new Date().toISOString(),
      },
      error: null,
    };
  } catch (error) {
    return {
      ok: false,
      status: "error",
      data: null,
      error:
        error instanceof Error
          ? sanitizeSupabaseMessage(error.message)
          : "Demo workspace query failed.",
    };
  }
}

export async function resetSupabaseDemoWorkspace(
  session: KyraAuthSession | null,
): Promise<ResetSupabaseDemoWorkspaceResult> {
  if (!session) {
    return {
      ok: false,
      message: "Sign in before resetting demo agents.",
      recordsRemoved: false,
      code: "sign_in_required",
      failureKind: "session",
    };
  }

  if (!appConfig.functions.resetDemoWorkspaceConfigured) {
    return {
      ok: false,
      message: "Backend reset endpoint is not configured.",
      recordsRemoved: false,
      code: "function_not_configured",
      failureKind: "configuration",
    };
  }

  try {
    const response = await fetch(appConfig.functions.resetDemoWorkspaceUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: getSupabaseApiKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({}),
    });
    const text = await response.text();
    const payload = parseResetDemoWorkspaceFunctionResponse(text);

    if (!response.ok || payload.ok === false) {
      const code = payload.status ?? (response.status === 404 ? "function_not_found" : "function_error");

      return {
        ok: false,
        message: getResetFailureMessage(
          response.status,
          code,
          payload.message ?? "Backend reset endpoint is unavailable.",
        ),
        recordsRemoved: false,
        code,
        failureKind: getResetFailureKind(response.status, code),
      };
    }

    return {
      ok: true,
      message: payload.message ?? "Demo workspace reset. Agent quota is clear.",
      recordsRemoved: payload.reset?.recordsRemoved ?? false,
      code: "reset_complete",
    };
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? getResetFailureMessage(503, "function_error", error.message)
          : "Kyra reset backend is unavailable. No demo workspace records were deleted.",
      recordsRemoved: false,
      code: "function_error",
      failureKind: "backend",
    };
  }
}
