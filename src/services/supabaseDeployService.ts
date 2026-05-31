import { appConfig } from "../config/appConfig";
import { demoScenarios } from "../data/demoScenarios";
import type { AgentTemplate } from "../types/agent";
import type { KyraDatabase, KyraTableName } from "../types/database";
import type { KyraAuthSession } from "./supabaseAuthService";

type TableRow<TName extends KyraTableName> = KyraDatabase["public"]["Tables"][TName]["Row"];
type TableInsert<TName extends KyraTableName> = KyraDatabase["public"]["Tables"][TName]["Insert"];

type WorkspaceRow = TableRow<"workspaces">;
type AgentInstanceRow = TableRow<"agent_instances">;
type WalletPolicyRow = TableRow<"wallet_policies">;

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

function getSupabaseApiKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || "";
}

function getRestUrl(path: string) {
  return `${appConfig.supabase.url.replace(/\/$/, "")}/rest/v1/${path.replace(/^\//, "")}`;
}

function getJsonHeaders(session: KyraAuthSession, prefer?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: getSupabaseApiKey(),
    Authorization: `Bearer ${session.accessToken}`,
  };

  if (prefer) {
    headers.Prefer = prefer;
  }

  return headers;
}

function sanitizeMessage(message: string) {
  return message
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "sb_publishable_[hidden]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "jwt_[hidden]")
    .slice(0, 240);
}

async function parseSupabaseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Supabase request failed with ${response.status}.`);
  }

  return text ? (JSON.parse(text) as T) : ([] as T);
}

async function selectRows<T>(session: KyraAuthSession, path: string): Promise<T[]> {
  const response = await fetch(getRestUrl(path), {
    headers: getJsonHeaders(session),
  });

  return parseSupabaseResponse<T[]>(response);
}

async function insertRow<TName extends KyraTableName>(
  session: KyraAuthSession,
  tableName: TName,
  payload: TableInsert<TName>,
): Promise<TableRow<TName>> {
  const response = await fetch(getRestUrl(tableName), {
    method: "POST",
    headers: getJsonHeaders(session, "return=representation"),
    body: JSON.stringify(payload),
  });
  const rows = await parseSupabaseResponse<TableRow<TName>[]>(response);

  if (!rows[0]) {
    throw new Error(`Supabase did not return a ${tableName} row.`);
  }

  return rows[0];
}

async function insertRows<TName extends KyraTableName>(
  session: KyraAuthSession,
  tableName: TName,
  payload: TableInsert<TName>[],
) {
  if (payload.length === 0) {
    return;
  }

  const response = await fetch(getRestUrl(tableName), {
    method: "POST",
    headers: getJsonHeaders(session),
    body: JSON.stringify(payload),
  });

  await parseSupabaseResponse(response);
}

async function patchRow<TName extends KyraTableName>(
  session: KyraAuthSession,
  tableName: TName,
  id: string,
  payload: KyraDatabase["public"]["Tables"][TName]["Update"],
) {
  const response = await fetch(getRestUrl(`${tableName}?id=eq.${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: getJsonHeaders(session),
    body: JSON.stringify(payload),
  });

  await parseSupabaseResponse(response);
}

async function ensureWorkspace(session: KyraAuthSession): Promise<WorkspaceRow> {
  const existing = await selectRows<WorkspaceRow>(
    session,
    "workspaces?select=id,owner_user_id,name,mode,created_at&mode=eq.demo&order=created_at.asc&limit=1",
  );

  if (existing[0]) {
    return existing[0];
  }

  return insertRow(session, "workspaces", {
    owner_user_id: session.user.id,
    name: "Kyra demo workspace",
    mode: "demo",
  });
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
          ? sanitizeMessage(error.message)
          : "Supabase deployment persistence failed.",
      workspaceId: null,
      agentId: null,
      publicSlug: null,
    };
  }
}
