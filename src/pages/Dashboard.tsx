import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  RotateCcw,
  Server,
  Radio,
  ShieldCheck,
  Terminal,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { AuthSessionPanel } from "../components/AuthSessionPanel";
import type { AgentTemplate } from "../types/agent";
import { appConfig } from "../config/appConfig";
import { demoAgentLimits } from "../config/demoLimits";
import { coreModules } from "../data/modules";
import { kyraRepositoryRuntime } from "../services/repositoryFactory";
import {
  fetchDeployFunctionHealth,
  getDeployFunctionHealthLabel,
  getDeployFunctionHealthTone,
  type DeployFunctionHealthStatus,
} from "../services/deployFunctionHealthService";
import {
  fetchSupabaseDashboardData,
  resetSupabaseDemoWorkspace,
  type SupabaseDashboardData,
  type SupabaseDashboardStatus,
} from "../services/supabaseDashboardService";
import type { KyraAuthSession, KyraAuthStatus } from "../services/supabaseAuthService";
import { ensureFreshAuthSession } from "../services/supabaseAuthService";
import {
  getSupabaseAdapterStatus,
  type SupabaseConnectionStatus,
} from "../services/supabaseKyraRepository";
import type { DataProvider } from "../types/api";
import type { DemoActivityLog, DemoApprovalRequest } from "../types/backend";

interface DashboardProps {
  selectedTemplate: AgentTemplate;
  templates: AgentTemplate[];
  templateCatalogSource: DataProvider;
  templateCatalogStatus: SupabaseConnectionStatus;
  templateCatalogError: string | null;
  authSession: KyraAuthSession | null;
  authStatus: KyraAuthStatus;
  authMessage: string;
  onAuthSessionChange: (
    session: KyraAuthSession | null,
    status: KyraAuthStatus,
    message: string,
  ) => void;
  onBackHome: () => void;
  onOpenAgent: (target?: { templateId?: string; publicPath?: string }) => void;
}

function getQueueTone(request: DemoApprovalRequest) {
  if (request.status === "waiting_wallet") {
    return "pending";
  }

  return request.status === "read_only_ready" || request.status === "approved" ? "ok" : "review";
}

function formatQueueStatus(status: DemoApprovalRequest["status"]) {
  return status.replace(/_/g, " ");
}

function formatRuntimeValue(value: string) {
  return value.replace(/-/g, " ");
}

function getReadinessTone(status: SupabaseConnectionStatus) {
  if (status === "connected") {
    return "ready";
  }

  return status === "error" ? "error" : "standby";
}

function getDashboardReadinessTone(status: SupabaseDashboardStatus) {
  if (status === "connected") {
    return "ready";
  }

  if (status === "error") {
    return "error";
  }

  return status === "loading" ? "locked" : "standby";
}

function getDashboardReadinessLabel(status: SupabaseDashboardStatus) {
  if (status === "connected") {
    return "supabase live";
  }

  if (status === "loading") {
    return "syncing";
  }

  if (status === "error") {
    return "mock fallback";
  }

  return status === "not-configured" ? "not configured" : "no records";
}

function formatActivityLog(log: DemoActivityLog) {
  return `[${log.timestamp}] ${log.source}: ${log.message}`;
}

function getCatalogValue(status: SupabaseConnectionStatus, source: DataProvider, templateCount: number) {
  if (status === "connected") {
    return `${templateCount} from ${source}`;
  }

  if (status === "error") {
    return "mock fallback";
  }

  return status === "checking" ? "checking" : "local";
}

type DeployChecklistState = "complete" | "active" | "blocked" | "todo";

interface DeployChecklistItem {
  label: string;
  detail: string;
  state: DeployChecklistState;
}

function getDeployChecklistState(status: DeployFunctionHealthStatus): DeployChecklistState {
  if (status === "ready") {
    return "complete";
  }

  if (status === "checking") {
    return "active";
  }

  if (status === "missing-secret" || status === "error") {
    return "blocked";
  }

  return "todo";
}

function getDashboardChecklistState(status: SupabaseDashboardStatus): DeployChecklistState {
  if (status === "connected") {
    return "complete";
  }

  if (status === "loading") {
    return "active";
  }

  if (status === "error") {
    return "blocked";
  }

  return "todo";
}

export function Dashboard({
  selectedTemplate,
  templates,
  templateCatalogSource,
  templateCatalogStatus,
  templateCatalogError,
  authSession,
  authStatus,
  authMessage,
  onAuthSessionChange,
  onBackHome,
  onOpenAgent,
}: DashboardProps) {
  const agentTemplates = templates;
  const [dashboardStatus, setDashboardStatus] = useState<SupabaseDashboardStatus>(
    authSession ? "loading" : "empty",
  );
  const [dashboardData, setDashboardData] = useState<SupabaseDashboardData | null>(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardReloadKey, setDashboardReloadKey] = useState(0);
  const [adminActionStatus, setAdminActionStatus] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [adminActionMessage, setAdminActionMessage] = useState(
    "Admin actions are scoped to this signed-in demo workspace.",
  );
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [deployFunctionStatus, setDeployFunctionStatus] = useState<DeployFunctionHealthStatus>(
    appConfig.functions.deployAgentConfigured ? "checking" : "not-configured",
  );
  const [deployFunctionMessage, setDeployFunctionMessage] = useState("");
  const supabaseStatus = getSupabaseAdapterStatus();

  useEffect(() => {
    if (!authSession) {
      setDashboardStatus(appConfig.supabase.configured ? "empty" : "not-configured");
      setDashboardData(null);
      setDashboardError(null);
      return;
    }

    let active = true;
    const sessionToLoad = authSession;

    async function loadDashboardRecords() {
      setDashboardStatus("loading");
      setDashboardError(null);

      const freshAuth = await ensureFreshAuthSession(sessionToLoad);

      if (!active) {
        return;
      }

      syncFreshAuthSession(sessionToLoad, freshAuth);

      if (!freshAuth.session) {
        setDashboardStatus("error");
        setDashboardData(null);
        setDashboardError(freshAuth.message);
        return;
      }

      const result = await fetchSupabaseDashboardData(freshAuth.session);

      if (!active) {
        return;
      }

      setDashboardStatus(result.status);
      setDashboardData(result.ok ? result.data : null);
      setDashboardError(result.error);
    }

    void loadDashboardRecords();

    return () => {
      active = false;
    };
  }, [authSession, dashboardReloadKey]);

  useEffect(() => {
    let active = true;

    async function loadDeployFunctionHealth() {
      if (!appConfig.functions.deployAgentConfigured) {
        setDeployFunctionStatus("not-configured");
        setDeployFunctionMessage("Deploy function URL is not configured.");
        return;
      }

      setDeployFunctionStatus("checking");
      const result = await fetchDeployFunctionHealth();

      if (!active) {
        return;
      }

      setDeployFunctionStatus(result.status);
      setDeployFunctionMessage(result.message);
    }

    void loadDeployFunctionHealth();

    return () => {
      active = false;
    };
  }, []);

  const agentRecord = dashboardData?.latestAgent ?? null;
  const dashboardAgentCount = dashboardData?.agentInstances.length ?? 0;
  const activeTemplate = useMemo(
    () =>
      agentTemplates.find((template) => template.id === agentRecord?.templateId) ??
      selectedTemplate,
    [agentTemplates, agentRecord?.templateId, selectedTemplate],
  );
  const visibleRequests = useMemo(() => {
    if (dashboardData?.approvalRequests.length && agentRecord) {
      return [
        ...dashboardData.approvalRequests.filter(
          (request) => request.templateId === agentRecord.templateId,
        ),
        ...dashboardData.approvalRequests.filter(
          (request) => request.templateId !== agentRecord.templateId,
        ),
      ].slice(0, 3);
    }

    if (dashboardData?.approvalRequests.length) {
      return dashboardData.approvalRequests.slice(0, 3);
    }

    return [];
  }, [agentRecord, dashboardData]);
  const walletPolicies = dashboardData?.walletPolicies ?? [];
  const backendTables = dashboardData?.backendTables ?? [];
  const workspace =
    dashboardData?.workspace ??
    (authSession
      ? {
          id: "no-demo-workspace",
          name: "No demo workspace",
          owner: authSession.user.email || "Supabase user",
          mode: "backend-demo" as const,
          authProvider: "supabase" as const,
        }
      : {
          id: "signed-out-preview",
          name: "Signed-out preview",
          owner: "No Supabase session",
          mode: "backend-demo" as const,
          authProvider: "supabase" as const,
        });
  const activityLines = dashboardData?.activityLogs.length
    ? dashboardData.activityLogs.map(formatActivityLog)
    : dashboardStatus === "loading"
        ? ["[--:--:--] dashboard: loading Supabase workspace records"]
        : authSession
          ? ["[--:--:--] dashboard: no deployed demo agent records"]
          : [
              "[--:--:--] auth: sign in to load Supabase dashboard records",
              "[--:--:--] dashboard: no mock agent or public route shown while signed out",
            ];
  const readinessRows = [
    {
      label: "Dashboard data",
      value: getDashboardReadinessLabel(dashboardStatus),
      tone: getDashboardReadinessTone(dashboardStatus),
      icon: Database,
    },
    {
      label: "Template catalog",
      value: getCatalogValue(templateCatalogStatus, templateCatalogSource, agentTemplates.length),
      tone: getReadinessTone(templateCatalogStatus),
      icon: Server,
    },
    {
      label: "Agent limit",
      value:
        authSession || dashboardStatus === "connected"
          ? `${dashboardAgentCount}/${demoAgentLimits.maxAgentsPerWorkspace}`
          : `max ${demoAgentLimits.maxAgentsPerWorkspace}`,
      tone:
        dashboardAgentCount >= demoAgentLimits.maxAgentsPerWorkspace
          ? "error"
          : "ready",
      icon: ShieldCheck,
    },
    {
      label: "Supabase env",
      value: supabaseStatus.configured ? "configured" : "waiting",
      tone: supabaseStatus.configured ? "ready" : "standby",
      icon: Database,
    },
    {
      label: "Auth",
      value: authSession ? "session active" : appConfig.integrations.auth,
      tone: authSession ? "ready" : "standby",
      icon: KeyRound,
    },
    {
      label: "Database",
      value: appConfig.integrations.database,
      tone: appConfig.integrations.database === "supabase" ? "ready" : "standby",
      icon: Server,
    },
    {
      label: "Deploy API",
      value: getDeployFunctionHealthLabel(deployFunctionStatus),
      tone: getDeployFunctionHealthTone(deployFunctionStatus),
      icon: Terminal,
    },
    {
      label: "Execution",
      value: appConfig.integrations.walletExecution,
      tone: "locked",
      icon: LockKeyhole,
    },
  ];
  const deployChecklist: DeployChecklistItem[] = [
    {
      label: "Function URL",
      detail: "Frontend points to the Supabase deploy-agent endpoint.",
      state: appConfig.functions.deployAgentConfigured ? "complete" : "todo",
    },
    {
      label: "Edge function",
      detail: "Health check answers before the frontend leaves fallback mode.",
      state: getDeployChecklistState(deployFunctionStatus),
    },
    {
      label: "Server secrets",
      detail: "Service role key stays inside Supabase Function secrets only.",
      state:
        deployFunctionStatus === "ready"
          ? "complete"
          : deployFunctionStatus === "missing-secret"
            ? "blocked"
            : deployFunctionStatus === "checking"
              ? "active"
              : "todo",
    },
    {
      label: "Demo database",
      detail: "Signed-in deploy receipts persist through RLS-backed records.",
      state: getDashboardChecklistState(dashboardStatus),
    },
    {
      label: "Agent quota",
      detail: `Demo workspace is capped at ${demoAgentLimits.maxAgentsPerWorkspace} agents.`,
      state: "complete",
    },
    {
      label: "Receipt source",
      detail: "Successful deploy receipts should show edge after function rollout.",
      state: getDeployChecklistState(deployFunctionStatus),
    },
  ];
  const isAdminActionRunning = adminActionStatus === "running";

  function syncFreshAuthSession(
    currentSession: KyraAuthSession,
    result: Awaited<ReturnType<typeof ensureFreshAuthSession>>,
  ) {
    if (!result.session) {
      onAuthSessionChange(null, result.status, result.message);
      return;
    }

    if (
      result.session.accessToken !== currentSession.accessToken ||
      result.session.expiresAt !== currentSession.expiresAt
    ) {
      onAuthSessionChange(result.session, result.status, result.message);
    }
  }

  function handleOpenResetConfirmation() {
    if (!authSession || isAdminActionRunning) {
      return;
    }

    setResetConfirmOpen(true);
  }

  function handleCloseResetConfirmation() {
    if (isAdminActionRunning) {
      return;
    }

    setResetConfirmOpen(false);
  }

  async function handleConfirmResetDemoWorkspace() {
    if (!authSession || isAdminActionRunning) {
      return;
    }

    setAdminActionStatus("running");
    setAdminActionMessage("Checking Supabase session before reset...");

    const freshAuth = await ensureFreshAuthSession(authSession);

    syncFreshAuthSession(authSession, freshAuth);

    if (!freshAuth.session) {
      setAdminActionStatus("error");
      setAdminActionMessage(freshAuth.message);
      setResetConfirmOpen(false);
      return;
    }

    setAdminActionMessage("Resetting demo workspace records...");

    const result = await resetSupabaseDemoWorkspace(freshAuth.session, dashboardData?.workspace.id);

    setAdminActionStatus(result.ok ? "success" : "error");
    setAdminActionMessage(result.message);
    setResetConfirmOpen(false);

    if (result.ok) {
      setDashboardReloadKey((key) => key + 1);
    }
  }

  function handleRefreshDashboardRecords() {
    if (!authSession || isAdminActionRunning) {
      return;
    }

    setAdminActionStatus("idle");
    setAdminActionMessage("Refreshing Supabase dashboard records...");
    setDashboardReloadKey((key) => key + 1);
  }

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <span className="agent-orb">K</span>
          <div>
            <strong>Kyra Console</strong>
            <small>{workspace.name}</small>
          </div>
        </div>

        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          <a className="is-active" href="#overview">
            <Activity size={16} />
            Overview
          </a>
          <a href="#auth">
            <KeyRound size={16} />
            Auth
          </a>
          <a href="#approvals">
            <WalletCards size={16} />
            Approvals
          </a>
          <a href="#logs">
            <Terminal size={16} />
            Logs
          </a>
          <a href="#modules">
            <Radio size={16} />
            Modules
          </a>
          <a href="#backend">
            <Server size={16} />
            Backend
          </a>
          <a href="#admin-actions">
            <Trash2 size={16} />
            Admin
          </a>
        </nav>

        <button className="button button-ghost dashboard-back" type="button" onClick={onBackHome}>
          <ArrowLeft size={16} />
          Home
        </button>
      </aside>

      <section className="dashboard-main">
        <div className="dashboard-topbar">
          <div>
            <span className="demo-badge compact">
              <Bot size={14} />
              {!authSession
                ? "Signed-out preview"
                : agentRecord
                ? dashboardStatus === "connected"
                  ? "Supabase agent"
                  : "Agent online"
                : dashboardStatus === "loading"
                  ? "Syncing workspace"
                  : "No demo agent"}
            </span>
            <h1>
              {!authSession
                ? "Sign in to view demo workspace"
                : agentRecord
                  ? agentRecord.displayName
                  : "No demo agent deployed"}
            </h1>
            <p>
              {!authSession
                ? "Dashboard records are hidden until a Supabase session is active. Sign in to load quota, deployed agents, approvals, and public routes."
                : agentRecord
                ? activeTemplate.role
                : "Deploy a demo agent to create Supabase dashboard records."}
            </p>
          </div>
          {agentRecord ? (
            <button
              className="button button-primary"
              type="button"
              onClick={() =>
                onOpenAgent({
                  templateId: agentRecord.templateId,
                  publicPath: agentRecord.publicPath,
                })
              }
            >
              Open Public Agent
              <ExternalLink size={16} />
            </button>
          ) : (
            <button className="button button-primary" type="button" disabled>
              Public Agent Unavailable
              <ExternalLink size={16} />
            </button>
          )}
        </div>

        <section className="dashboard-kpi-grid" id="overview">
          <article>
            <span>Template</span>
            <strong>{agentRecord ? activeTemplate.name : "None yet"}</strong>
            <small>{agentRecord ? activeTemplate.status : "deploy required"}</small>
          </article>
          <article>
            <span>Platform</span>
            <strong>{agentRecord ? "Telegram" : "Not connected"}</strong>
            <small>{agentRecord ? agentRecord.handle : "deploy creates handle"}</small>
          </article>
          <article>
            <span>Wallet</span>
            <strong>{agentRecord ? "Demo connected" : "No demo policy"}</strong>
            <small>{agentRecord ? "no real funds touched" : "no keys, no funds, no transactions"}</small>
          </article>
          <article>
            <span>Approval policy</span>
            <strong>{agentRecord ? "Required" : "Not created"}</strong>
            <small>{agentRecord ? "Kyra prepares, wallet decides" : "created after deploy"}</small>
          </article>
        </section>

        <div className="dashboard-content-grid">
          <section className="dashboard-panel agent-overview-panel">
            <div className="panel-title">
              <span>agent.instance</span>
              <span>{agentRecord ? agentRecord.id : "empty"}</span>
            </div>
            {agentRecord ? (
              <>
                <p>{activeTemplate.summary}</p>
                <div className="dashboard-action-chips">
                  {activeTemplate.actions.map((action) => (
                    <span className="chip chip-active" key={action}>
                      <CheckCircle2 size={13} />
                      {action}
                    </span>
                  ))}
                </div>
              </>
            ) : (
              <div className="dashboard-empty-state">
                <Database size={20} />
                <strong>
                  {authSession
                    ? "No Supabase demo agent records."
                    : "Dashboard records locked until sign-in."}
                </strong>
                <p>
                  {authSession
                    ? "This signed-in workspace is clean. Deploy a demo agent from the home flow to create the dashboard, approval queue, wallet policy, logs, and public agent route."
                    : "Sign in to load RLS-backed demo workspace records. No mock agent, wallet queue, or public route is shown while signed out."}
                </p>
              </div>
            )}
          </section>

          <section className="dashboard-panel" id="approvals">
            <div className="panel-title">
              <span>approval.queue</span>
              <span>{visibleRequests.length} items</span>
            </div>
            <div className="queue-list">
              {visibleRequests.length ? (
                visibleRequests.map((item) => (
                  <article className={`queue-item queue-${getQueueTone(item)}`} key={item.id}>
                    <span className="queue-icon">
                      {getQueueTone(item) === "pending" ? (
                        <Clock3 size={16} />
                      ) : (
                        <ShieldCheck size={16} />
                      )}
                    </span>
                    <div>
                      <strong>{item.title}</strong>
                      <small>{item.command}</small>
                    </div>
                    <em>{formatQueueStatus(item.status)}</em>
                  </article>
                ))
              ) : (
                <div className="dashboard-empty-state compact">
                  <WalletCards size={18} />
                  <strong>No approval requests.</strong>
                  <p>Deploy a demo agent before Kyra creates wallet approval records.</p>
                </div>
              )}
            </div>
          </section>

          <AuthSessionPanel
            session={authSession}
            status={authStatus}
            message={authMessage}
            onSessionChange={onAuthSessionChange}
          />

          <section className="dashboard-panel">
            <div className="panel-title">
              <span>wallet.policy</span>
              <span>safe mode</span>
            </div>
            <div className="wallet-policy-list">
              {walletPolicies.length ? (
                walletPolicies.map((policy) => (
                  <article key={policy.id}>
                    <span>{policy.label}</span>
                    <strong>{policy.value}</strong>
                    <small>{policy.status}: {policy.description}</small>
                  </article>
                ))
              ) : (
                <div className="dashboard-empty-state compact">
                  <ShieldCheck size={18} />
                  <strong>No wallet policy record.</strong>
                  <p>No keys, funds, or approval settings exist until a demo agent is deployed.</p>
                </div>
              )}
            </div>
          </section>

          <section className="dashboard-panel backend-shape-panel">
            <div className="panel-title">
              <span>backend.records</span>
              <span>{authSession ? "supabase" : "signed-out"}</span>
            </div>
            <div className="backend-table-list">
              {backendTables.length ? (
                backendTables.map((table) => (
                  <article key={table.name}>
                    <span>{table.name}</span>
                    <strong>{table.records} records</strong>
                    <small>{table.purpose}</small>
                  </article>
                ))
              ) : (
                <div className="dashboard-empty-state compact">
                  <Database size={18} />
                  <strong>No backend records yet.</strong>
                  <p>Reset or a fresh sign-in leaves this dashboard clean until the next deploy.</p>
                </div>
              )}
            </div>
          </section>

          <section className="dashboard-panel admin-actions-panel" id="admin-actions">
            <div className="panel-title">
              <span>admin.actions</span>
              <span>{authSession ? "workspace owner" : "locked"}</span>
            </div>
            <p className="admin-actions-copy">
              Reset the signed-in demo workspace when quota testing needs a clean slate.
            </p>
            <div className="admin-action-metrics">
              <article>
                <span>Agent quota</span>
                <strong>
                  {authSession || dashboardStatus === "connected"
                    ? `${dashboardAgentCount}/${demoAgentLimits.maxAgentsPerWorkspace}`
                    : `max ${demoAgentLimits.maxAgentsPerWorkspace}`}
                </strong>
              </article>
              <article>
                <span>Scope</span>
                <strong>{workspace.mode}</strong>
              </article>
            </div>
            <div className="admin-action-grid">
              <button
                className="button button-ghost admin-action-button admin-action-danger"
                type="button"
                onClick={handleOpenResetConfirmation}
                disabled={!authSession || isAdminActionRunning}
              >
                <Trash2 size={16} />
                {isAdminActionRunning ? "Resetting" : "Reset demo agents"}
              </button>
              <button
                className="button button-ghost admin-action-button"
                type="button"
                onClick={handleRefreshDashboardRecords}
                disabled={!authSession || isAdminActionRunning || dashboardStatus === "loading"}
              >
                <RotateCcw size={16} />
                Refresh records
              </button>
            </div>
            <div className={`admin-action-note admin-action-${adminActionStatus}`}>
              <ShieldCheck size={15} />
              <span>{adminActionMessage}</span>
            </div>
          </section>

          <section className="dashboard-panel backend-readiness-panel" id="backend">
            <div className="panel-title">
              <span>backend.readiness</span>
              <span>{formatRuntimeValue(appConfig.mode)}</span>
            </div>
            <div className="readiness-summary">
              <span className={`readiness-chip readiness-${getDashboardReadinessTone(dashboardStatus)}`}>
                <ShieldCheck size={14} />
                {dashboardStatus === "connected" ? "Supabase records connected" : "demo safe"}
              </span>
              <p>{kyraRepositoryRuntime.note}</p>
              {templateCatalogError ? (
                <p className="readiness-error-note">
                  Supabase catalog query failed: {templateCatalogError}
                </p>
              ) : null}
              {dashboardError && authSession ? (
                <p className="readiness-error-note">
                  Supabase dashboard query: {dashboardError}
                </p>
              ) : null}
              {deployFunctionStatus !== "ready" && deployFunctionStatus !== "not-configured" ? (
                <p className="readiness-error-note">
                  Deploy function: {deployFunctionMessage}
                </p>
              ) : null}
            </div>
            <div className="readiness-grid">
              {readinessRows.map((item) => {
                const Icon = item.icon;

                return (
                  <article className={`readiness-item readiness-${item.tone}`} key={item.label}>
                    <Icon size={16} />
                    <span>
                      <small>{item.label}</small>
                      <strong>{formatRuntimeValue(item.value)}</strong>
                    </span>
                  </article>
                );
              })}
            </div>
            <div className="deploy-readiness-checklist" aria-label="Deploy agent readiness checklist">
              <div className="deploy-checklist-title">
                <span>deploy-agent checklist</span>
                <strong>{getDeployFunctionHealthLabel(deployFunctionStatus)}</strong>
              </div>
              <div className="deploy-checklist-grid">
                {deployChecklist.map((item) => {
                  const StatusIcon =
                    item.state === "complete"
                      ? CheckCircle2
                      : item.state === "blocked"
                        ? LockKeyhole
                        : Clock3;

                  return (
                    <article className={`deploy-check-item deploy-check-${item.state}`} key={item.label}>
                      <StatusIcon size={15} />
                      <span>
                        <strong>{item.label}</strong>
                        <small>{item.detail}</small>
                      </span>
                    </article>
                  );
                })}
              </div>
            </div>
            <div className="backend-contract-line">
              <span>{supabaseStatus.tables.length} Supabase tables mapped</span>
              <span>{agentTemplates.length} templates loaded</span>
              <span>
                {dashboardAgentCount
                  ? `${dashboardAgentCount} Supabase agents`
                  : "no Supabase agents"}
              </span>
              <span>max {demoAgentLimits.maxAgentsPerWorkspace} demo agents</span>
              <span>deploy-agent {getDeployFunctionHealthLabel(deployFunctionStatus)}</span>
              <span>onchain execution disabled</span>
            </div>
          </section>

          <section className="dashboard-panel" id="logs">
            <div className="panel-title">
              <span>activity.stream</span>
              <span>live replay</span>
            </div>
            <div className="dashboard-log-box">
              {activityLines.map((log) => (
                <p key={log}>{log}</p>
              ))}
            </div>
          </section>

          <section className="dashboard-panel" id="modules">
            <div className="panel-title">
              <span>kyra.modules</span>
              <span>core online</span>
            </div>
            <div className="dashboard-module-grid">
              {coreModules.map((module) => (
                <article key={module.id}>
                  <strong>{module.name}</strong>
                  <span>{module.title}</span>
                  <small>{module.status}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-panel template-switch-panel">
            <div className="panel-title">
              <span>available.templates</span>
              <span>{agentTemplates.length}</span>
            </div>
            <div className="mini-template-list">
              {agentTemplates.map((template) => (
                <article
                  className={template.id === activeTemplate.id ? "is-active" : ""}
                  key={template.id}
                >
                  <strong>{template.name}</strong>
                  <small>{template.role}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>

      {resetConfirmOpen ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="reset-demo-workspace-title"
            aria-modal="true"
            className="approval-modal reset-confirm-modal"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <span className="demo-badge compact">
                  <Trash2 size={14} />
                  Reset demo workspace
                </span>
                <h3 id="reset-demo-workspace-title">Confirm demo reset</h3>
              </div>
              <button
                aria-label="Close reset confirmation"
                className="icon-button"
                disabled={isAdminActionRunning}
                onClick={handleCloseResetConfirmation}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <p className="reset-confirm-copy">
              This deletes only the signed-in demo workspace records for this account. It does
              not touch global data, real funds, wallet keys, private keys, Telegram tokens, or
              any onchain transactions.
            </p>
            <div className="reset-scope-grid">
              <span>
                Scope
                <strong>Signed-in demo workspace</strong>
              </span>
              <span>
                Agent quota
                <strong>{dashboardAgentCount}/{demoAgentLimits.maxAgentsPerWorkspace}</strong>
              </span>
              <span>
                Funds
                <strong>Not touched</strong>
              </span>
              <span>
                Execution
                <strong>Disabled</strong>
              </span>
            </div>
            <div className="approval-warning reset-confirm-warning">
              <ShieldCheck size={17} />
              After reset, the dashboard should show a clean empty state until a new demo agent is deployed.
            </div>
            <div className="modal-actions">
              <button
                className="button button-ghost"
                disabled={isAdminActionRunning}
                onClick={handleCloseResetConfirmation}
                type="button"
              >
                Cancel
              </button>
              <button
                className="button button-primary admin-action-danger"
                disabled={isAdminActionRunning}
                onClick={handleConfirmResetDemoWorkspace}
                type="button"
              >
                <Trash2 size={16} />
                {isAdminActionRunning ? "Resetting..." : "Confirm reset"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
