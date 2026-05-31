import { appConfig } from "../config/appConfig";
import { demoAgentLimits } from "../config/demoLimits";
import { demoScenarios } from "../data/demoScenarios";
import type { AgentTemplate } from "../types/agent";
import type { KyraTableName } from "../types/database";
import {
  insertRow,
  insertRows,
  patchRow,
  sanitizeSupabaseMessage,
  selectRows,
  type SupabaseTableInsert,
  type SupabaseTableRow,
} from "./supabaseRestClient";
import type { KyraAuthSession } from "./supabaseAuthService";

type TableRow<TName extends KyraTableName> = SupabaseTableRow<TName>;
type TableInsert<TName extends KyraTableName> = SupabaseTableInsert<TName>;

type WorkspaceRow = TableRow<"workspaces">;
type AgentInstanceRow = TableRow<"agent_instances">;
type WalletPolicyRow = TableRow<"wallet_policies">;
type AgentCountRow = Pick<AgentInstanceRow, "id">;

export type DeployPersistenceStatus = "skipped" | "saved" | "error";

export interface DeployPersistenceInput {
  session: KyraAuthSession | null;
  template: AgentTemplate;
  agentName: string;
  selectedActions: string[];
}

export interface DeployPersistenceResult {
  status: DeployPersistenceStatus;
  message: string;
  workspaceId: string | null;
  agentId: string | null;
  publicSlug: string | null;
}

export interface DemoAgentQuota {
  used: number;
  limit: number;
  remaining: number;
  reached: boolean;
  source: "supabase" | "local";
  message: string;
}

function createQuota(used: number, source: DemoAgentQuota["source"]): DemoAgentQuota {
  const limit = demoAgentLimits.maxAgentsPerWorkspace;
  const normalizedUsed = Math.max(0, used);
  const remaining = Math.max(0, limit - normalizedUsed);

  return {
    used: normalizedUsed,
    limit,
    remaining,
    reached: normalizedUsed >= limit,
    source,
    message:
      normalizedUsed >= limit
        ? `Demo agent limit reached (${normalizedUsed}/${limit}).`
        : `${remaining} demo agent slot${remaining === 1 ? "" : "s"} available.`,
  };
}

async function getExistingWorkspace(session: KyraAuthSession): Promise<WorkspaceRow | null> {
  const existing = await selectRows<WorkspaceRow>(
    session,
    "workspaces?select=id,owner_user_id,name,mode,created_at&mode=eq.demo&order=created_at.asc&limit=1",
  );

  return existing[0] ?? null;
}

async function ensureWorkspace(session: KyraAuthSession): Promise<WorkspaceRow> {
  const existing = await getExistingWorkspace(session);

  if (existing) {
    return existing;
  }

  return insertRow(session, "workspaces", {
    owner_user_id: session.user.id,
    name: "Kyra demo workspace",
    mode: "demo",
  });
}

async function getQuotaForWorkspace(
  session: KyraAuthSession,
  workspaceId: string,
): Promise<DemoAgentQuota> {
  const rows = await selectRows<AgentCountRow>(
    session,
    `agent_instances?select=id&workspace_id=eq.${encodeURIComponent(workspaceId)}&limit=${
      demoAgentLimits.maxAgentsPerWorkspace + 1
    }`,
  );

  return createQuota(rows.length, "supabase");
}

export async function fetchSupabaseDemoAgentQuota(
  session: KyraAuthSession | null,
): Promise<DemoAgentQuota> {
  if (!session || !appConfig.supabase.configured) {
    return createQuota(0, "local");
  }

  const workspace = await getExistingWorkspace(session);

  if (!workspace) {
    return createQuota(0, "supabase");
  }

  return getQuotaForWorkspace(session, workspace.id);
}

function createPublicSlug(templateId: string, session: KyraAuthSession) {
  const userPart = session.user.id.replace(/-/g, "").slice(0, 8);
  return `${templateId}-${userPart}-${Date.now().toString(36)}`;
}

function createTelegramHandle(templateId: string, publicSlug: string) {
  return `@kyra_${templateId}_${publicSlug.slice(-5)}`;
}

function getScenarioForTemplate(templateId: string) {
  return demoScenarios.find((scenario) => scenario.templateId === templateId) ?? demoScenarios[0];
}

function createActivityLogs(
  workspaceId: string,
  agentId: string,
  template: AgentTemplate,
): TableInsert<"activity_logs">[] {
  return [
    {
      workspace_id: workspaceId,
      agent_id: agentId,
      source: "agent_instances",
      level: "info",
      message: `created ${template.name} demo agent from frontend deploy flow`,
    },
    {
      workspace_id: workspaceId,
      agent_id: agentId,
      source: "telegram_sessions",
      level: "notice",
      message: "Telegram interface stored as simulated session",
    },
    {
      workspace_id: workspaceId,
      agent_id: agentId,
      source: "approval_requests",
      level: "notice",
      message: "demo approval request persisted with wallet approval required",
    },
  ];
}

async function createAgent(
  session: KyraAuthSession,
  workspace: WorkspaceRow,
  template: AgentTemplate,
  agentName: string,
): Promise<AgentInstanceRow> {
  const displayName = agentName.trim() || `Kyra ${template.name}`;
  const publicSlug = createPublicSlug(template.id, session);

  return insertRow(session, "agent_instances", {
    workspace_id: workspace.id,
    template_id: template.id,
    display_name: displayName,
    handle: createTelegramHandle(template.id, publicSlug),
    public_slug: publicSlug,
    status: template.status === "coming-soon" ? "draft" : "online",
    mode: "demo",
    network: "base",
    telegram_status: "mocked",
    base_mcp_status: "mocked",
  });
}

async function createWalletPolicy(
  session: KyraAuthSession,
  workspaceId: string,
  agentId: string,
  selectedActions: string[],
): Promise<WalletPolicyRow> {
  return insertRow(session, "wallet_policies", {
    workspace_id: workspaceId,
    agent_id: agentId,
    wallet_label: "Demo Base Account",
    wallet_address: null,
    daily_limit_usdc: 100,
    approval_required: true,
    allowed_actions: selectedActions,
    status: "simulated",
  });
}

async function createApprovalRequest(
  session: KyraAuthSession,
  workspaceId: string,
  agentId: string,
  template: AgentTemplate,
) {
  const scenario = getScenarioForTemplate(template.id);
  const risk = scenario?.risk ?? "review";

  return insertRow(session, "approval_requests", {
    workspace_id: workspaceId,
    agent_id: agentId,
    scenario_id: scenario?.id ?? null,
    title: `${template.name} demo action`,
    command: template.terminalSeed || scenario?.command || "prepare demo action",
    route: scenario?.route ?? "Demo route prepared by Kyra",
    risk,
    status: scenario?.approvalRequired
      ? "waiting_wallet"
      : risk === "read-only"
        ? "read_only_ready"
        : "review_required",
    fee_payer: "connected_wallet",
    requires_wallet: scenario?.approvalRequired ?? true,
    prepared_tx: {
      demo: true,
      template_id: template.id,
      onchain_execution: "disabled",
    },
  });
}

async function createTelegramSession(session: KyraAuthSession, agentId: string, handle: string) {
  return insertRow(session, "telegram_sessions", {
    agent_id: agentId,
    bot_handle: handle,
    webhook_status: "mocked",
    token_secret_ref: null,
  });
}

export async function saveSupabaseDemoDeployment({
  session,
  template,
  agentName,
  selectedActions,
}: DeployPersistenceInput): Promise<DeployPersistenceResult> {
  if (!session) {
    return {
      status: "skipped",
      message: "Demo ran locally. Sign in from the dashboard to persist deployments.",
      workspaceId: null,
      agentId: null,
      publicSlug: null,
    };
  }

  if (!appConfig.supabase.configured) {
    return {
      status: "skipped",
      message: "Supabase is not configured, so this deploy stayed local.",
      workspaceId: null,
      agentId: null,
      publicSlug: null,
    };
  }

  try {
    const workspace = await ensureWorkspace(session);
    const quota = await getQuotaForWorkspace(session, workspace.id);

    if (quota.reached) {
      return {
        status: "error",
        message: `${quota.message} Max ${quota.limit} agents per demo workspace.`,
        workspaceId: workspace.id,
        agentId: null,
        publicSlug: null,
      };
    }

    const agent = await createAgent(session, workspace, template, agentName);
    const policy = await createWalletPolicy(session, workspace.id, agent.id, selectedActions);
    await patchRow(session, "agent_instances", agent.id, {
      approval_policy_id: policy.id,
    });
    await createApprovalRequest(session, workspace.id, agent.id, template);
    await createTelegramSession(session, agent.id, agent.handle);
    await insertRows(session, "activity_logs", createActivityLogs(workspace.id, agent.id, template));

    return {
      status: "saved",
      message: "Demo deployment persisted to Supabase.",
      workspaceId: workspace.id,
      agentId: agent.id,
      publicSlug: agent.public_slug,
    };
  } catch (error) {
    return {
      status: "error",
      message:
        error instanceof Error
          ? sanitizeSupabaseMessage(error.message)
          : "Supabase deployment persistence failed.",
      workspaceId: null,
      agentId: null,
      publicSlug: null,
    };
  }
}
