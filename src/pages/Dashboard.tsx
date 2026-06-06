import { useEffect, useMemo, useRef, useState } from "react";
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
  getBackendEvents,
  recordBackendEvent,
  subscribeBackendEvents,
  type BackendEvent,
  type BackendEventStatus,
} from "../services/backendObservabilityService";
import {
  getSupabaseAdapterStatus,
  type SupabaseConnectionStatus,
} from "../services/supabaseKyraRepository";
import {
  issueTelegramOwnerLink,
  type TelegramLinkStatus,
} from "../services/telegramLinkService";
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

const dashboardSectionIds = [
  "overview",
  "auth",
  "approvals",
  "logs",
  "modules",
  "backend",
  "admin-actions",
] as const;

type DashboardSectionId = (typeof dashboardSectionIds)[number];

function getDashboardSectionIdFromPath(pathname: string): DashboardSectionId {
  const sectionId = pathname.match(/^\/dashboard\/([^/]+)\/?$/)?.[1];

  return dashboardSectionIds.includes(sectionId as DashboardSectionId)
    ? (sectionId as DashboardSectionId)
    : "overview";
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
    return "active";
  }

  if (status === "loading") {
    return "syncing";
  }

  if (status === "error") {
    return "fallback ready";
  }

  return status === "not-configured" ? "not configured" : "no records";
}

function formatActivityLog(log: DemoActivityLog) {
  const sourceLabel =
    {
      agent_instances: "agent",
      telegram_sessions: "telegram",
      base_mcp_routes: "base action",
      approval_requests: "approval",
      wallet_policies: "wallet policy",
      activity_logs: "activity",
    }[log.source] ?? "backend";

  return `[${log.timestamp}] ${sourceLabel}: ${log.message}`;
}

function getCatalogValue(status: SupabaseConnectionStatus, templateCount: number) {
  if (status === "connected") {
    return `${templateCount} connected templates`;
  }

  if (status === "error") {
    return "local fallback";
  }

  return status === "checking" ? "checking" : "local";
}

type DeployChecklistState = "complete" | "active" | "blocked" | "todo";
type TelegramOwnerLinkUiStatus = "idle" | "running" | "success" | "error";

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

function getDiagnosticTone(status: BackendEventStatus | "ready" | "standby" | "locked") {
  if (status === "success" || status === "ready") {
    return "ready";
  }

  if (status === "error" || status === "blocked") {
    return "error";
  }

  if (status === "running" || status === "locked") {
    return "locked";
  }

  return "standby";
}

function formatDiagnosticTimestamp(value: string | null) {
  if (!value) {
    return "not recorded";
  }

  return new Date(value).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function getLatestEvent(events: BackendEvent[], kind: BackendEvent["kind"]) {
  return events.find((event) => event.kind === kind) ?? null;
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
  const [activeDashboardSectionId, setActiveDashboardSectionId] = useState<DashboardSectionId>(() =>
    typeof window === "undefined" ? "overview" : getDashboardSectionIdFromPath(window.location.pathname),
  );
  const isAdmin = authSession?.user.app_metadata?.role === "admin";
  const postResetRefreshPendingRef = useRef(false);
  const [backendEvents, setBackendEvents] = useState<BackendEvent[]>(() => getBackendEvents());
  const [lastDashboardRefreshAt, setLastDashboardRefreshAt] = useState<string | null>(null);
  const [deployFunctionStatus, setDeployFunctionStatus] = useState<DeployFunctionHealthStatus>(
    appConfig.functions.deployAgentConfigured ? "checking" : "not-configured",
  );
  const [deployFunctionMessage, setDeployFunctionMessage] = useState("");
  const [selectedDashboardAgentId, setSelectedDashboardAgentId] = useState<string | null>(null);
  const [telegramOwnerLinkStatus, setTelegramOwnerLinkStatus] =
    useState<TelegramOwnerLinkUiStatus>("idle");
  const [telegramOwnerLinkMessage, setTelegramOwnerLinkMessage] = useState(
    "Owner chat linking is available after the selected Telegram session is active.",
  );
  const [telegramOwnerLinkUrl, setTelegramOwnerLinkUrl] = useState<string | null>(null);
  const [telegramOwnerLinkExpiresAt, setTelegramOwnerLinkExpiresAt] = useState<string | null>(null);
  const supabaseStatus = getSupabaseAdapterStatus();

  useEffect(() => {
    return subscribeBackendEvents(() => setBackendEvents(getBackendEvents()));
  }, []);

  useEffect(() => {
    function syncDashboardSectionFromLocation() {
      setActiveDashboardSectionId(getDashboardSectionIdFromPath(window.location.pathname));
    }

    window.addEventListener("popstate", syncDashboardSectionFromLocation);
    return () => window.removeEventListener("popstate", syncDashboardSectionFromLocation);
  }, []);

  useEffect(() => {
    window.setTimeout(() => {
      document
        .getElementById(activeDashboardSectionId)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }, [activeDashboardSectionId]);

  function openDashboardSection(sectionId: DashboardSectionId) {
    setActiveDashboardSectionId(sectionId);
    window.history.pushState({}, "", `/dashboard/${sectionId}`);
  }

  useEffect(() => {
    if (!authSession) {
      setDashboardStatus(appConfig.supabase.configured ? "empty" : "not-configured");
      setDashboardData(null);
      setDashboardError(null);
      setLastDashboardRefreshAt(null);
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
      setLastDashboardRefreshAt(new Date().toISOString());

      if (isAdmin) {
        recordBackendEvent({
          kind: "dashboard-refresh",
          status: result.ok || result.status === "empty" ? "success" : result.status === "error" ? "error" : "info",
          message: result.ok
            ? "Dashboard records loaded."
            : result.error ?? "Dashboard has no persisted demo records.",
          source: "dashboard",
          code: result.status,
        });
      }

      if (postResetRefreshPendingRef.current) {
        postResetRefreshPendingRef.current = false;

        if (result.status === "error") {
          setAdminActionStatus("error");
          setAdminActionMessage(
            `Reset succeeded, but dashboard refresh failed: ${result.error ?? "records unavailable"}`,
          );
        } else {
          setAdminActionStatus("success");
          setAdminActionMessage("Demo workspace reset. Agent quota is clear.");
        }
      }
    }

    void loadDashboardRecords();

    return () => {
      active = false;
    };
  }, [authSession, dashboardReloadKey, isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

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
      recordBackendEvent({
        kind: "function-health",
        status:
          result.status === "ready"
            ? "success"
            : result.status === "missing-secret" || result.status === "error"
              ? "error"
              : "info",
        message: result.message,
        source: "deploy-agent",
        code: result.status,
      });
    }

    void loadDeployFunctionHealth();

    return () => {
      active = false;
    };
  }, [isAdmin]);

  const agentRecords = useMemo(
    () => dashboardData?.agentInstances ?? [],
    [dashboardData?.agentInstances],
  );

  useEffect(() => {
    if (!agentRecords.length) {
      if (selectedDashboardAgentId) {
        setSelectedDashboardAgentId(null);
      }
      return;
    }

    if (
      !selectedDashboardAgentId ||
      !agentRecords.some((agent) => agent.id === selectedDashboardAgentId)
    ) {
      setSelectedDashboardAgentId(agentRecords[0].id);
    }
  }, [agentRecords, selectedDashboardAgentId]);

  const agentRecord =
    agentRecords.find((agent) => agent.id === selectedDashboardAgentId) ??
    dashboardData?.latestAgent ??
    null;
  const dashboardAgentCount = agentRecords.length;
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
          (request) => request.agentId === agentRecord.id,
        ),
        ...dashboardData.approvalRequests.filter(
          (request) => request.agentId !== agentRecord.id,
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
  const hasPublicRoute = Boolean(agentRecord?.publicPath);
  const latestDeployEvent = getLatestEvent(backendEvents, "deploy");
  const latestResetEvent = getLatestEvent(backendEvents, "reset");
  const latestRefreshEvent = getLatestEvent(backendEvents, "dashboard-refresh");
  const lastBackendIssue =
    backendEvents.find((event) => event.status === "error" || event.status === "blocked") ?? null;
  const workspace =
    dashboardData?.workspace ??
    (authSession
      ? {
          id: "no-demo-workspace",
          name: "No demo workspace",
          owner: "Signed-in account",
          mode: "backend-demo" as const,
          authProvider: "supabase" as const,
        }
      : {
          id: "signed-out-preview",
          name: "Signed-out preview",
          owner: "No account session",
          mode: "backend-demo" as const,
          authProvider: "supabase" as const,
        });
  const activityLines = dashboardData?.activityLogs.length
    ? dashboardData.activityLogs.map(formatActivityLog)
    : dashboardStatus === "loading"
        ? ["[--:--:--] dashboard: loading demo workspace records"]
        : authSession
          ? ["[--:--:--] dashboard: no deployed demo agent records"]
          : [
              "[--:--:--] account: sign in to load demo workspace records",
              "[--:--:--] dashboard: no sample agent or public route shown while signed out",
            ];
  const readinessRows = [
    {
      label: "Demo records",
      value: getDashboardReadinessLabel(dashboardStatus),
      tone: getDashboardReadinessTone(dashboardStatus),
      icon: Database,
    },
    {
      label: "Template catalog",
      value: getCatalogValue(templateCatalogStatus, agentTemplates.length),
      tone: getReadinessTone(templateCatalogStatus),
      icon: Bot,
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
      label: "Account",
      value: authSession ? "active" : "sign in to persist",
      tone: authSession ? "ready" : "standby",
      icon: KeyRound,
    },
    {
      label: "Public route",
      value: hasPublicRoute ? "available" : "not created",
      tone: hasPublicRoute ? "ready" : "standby",
      icon: ExternalLink,
    },
    {
      label: "Safety",
      value: "approval-first",
      tone: "ready",
      icon: ShieldCheck,
    },
    {
      label: "Execution",
      value: appConfig.integrations.walletExecution === "disabled" ? "simulated" : appConfig.integrations.walletExecution,
      tone: "locked",
      icon: LockKeyhole,
    },
  ];
  const deployChecklist: DeployChecklistItem[] = [
    {
      label: "Function URL",
      detail: "Frontend points to the deploy-agent endpoint.",
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
      detail: "Successful deploy receipts should show Backend when persistence is ready.",
      state: getDeployChecklistState(deployFunctionStatus),
    },
  ];
  const isAdminActionRunning = adminActionStatus === "running";
  const diagnosticRows = [
    {
      label: "Deploy function",
      value: getDeployFunctionHealthLabel(deployFunctionStatus),
      detail: deployFunctionMessage || "Waiting for health check.",
      tone: getDeployFunctionHealthTone(deployFunctionStatus),
    },
    {
      label: "Reset function",
      value: appConfig.functions.resetDemoWorkspaceConfigured ? "configured" : "not configured",
      detail: appConfig.functions.resetDemoWorkspaceConfigured
        ? "Admin reset requests use the backend endpoint."
        : "Reset endpoint URL is missing.",
      tone: appConfig.functions.resetDemoWorkspaceConfigured ? "ready" : "standby",
    },
    {
      label: "Catalog",
      value: getCatalogValue(templateCatalogStatus, agentTemplates.length),
      detail: templateCatalogError ?? "Template catalog state is available.",
      tone: getReadinessTone(templateCatalogStatus),
    },
    {
      label: "Dashboard records",
      value: getDashboardReadinessLabel(dashboardStatus),
      detail: dashboardError ?? `${dashboardAgentCount} persisted demo agent records loaded.`,
      tone: getDashboardReadinessTone(dashboardStatus),
    },
    {
      label: "Last refresh",
      value: formatDiagnosticTimestamp(lastDashboardRefreshAt),
      detail: latestRefreshEvent?.message ?? "No dashboard refresh event recorded yet.",
      tone: getDiagnosticTone(latestRefreshEvent?.status ?? "standby"),
    },
    {
      label: "Last deploy",
      value: latestDeployEvent ? latestDeployEvent.status : "not recorded",
      detail: latestDeployEvent?.message ?? "No deploy attempt recorded in this browser yet.",
      tone: getDiagnosticTone(latestDeployEvent?.status ?? "standby"),
    },
    {
      label: "Last reset",
      value: latestResetEvent ? latestResetEvent.status : "not recorded",
      detail: latestResetEvent?.message ?? "No reset attempt recorded in this browser yet.",
      tone: getDiagnosticTone(latestResetEvent?.status ?? "standby"),
    },
  ];

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
    if (!isAdmin || !authSession || isAdminActionRunning) {
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
    if (!isAdmin || !authSession || isAdminActionRunning) {
      return;
    }

    setAdminActionStatus("running");
    setAdminActionMessage("Checking account session before reset...");
    recordBackendEvent({
      kind: "reset",
      status: "running",
      message: "Admin reset requested.",
      source: "reset-demo-workspace",
    });

    const freshAuth = await ensureFreshAuthSession(authSession);

    syncFreshAuthSession(authSession, freshAuth);

    if (!freshAuth.session) {
      setAdminActionStatus("error");
      setAdminActionMessage(freshAuth.message);
      recordBackendEvent({
        kind: "reset",
        status: "blocked",
        message: freshAuth.message,
        source: "account session",
        code: "session_refresh_failed",
      });
      setResetConfirmOpen(false);
      return;
    }

    setAdminActionMessage("Resetting demo workspace records...");

    const result = await resetSupabaseDemoWorkspace(freshAuth.session);

    setAdminActionStatus(result.ok ? "success" : "error");
    setAdminActionMessage(result.ok ? "Reset succeeded. Refreshing dashboard records..." : result.message);
    recordBackendEvent({
      kind: "reset",
      status: result.ok ? "success" : "error",
      message: result.message,
      source: "reset-demo-workspace",
      code: result.code,
    });
    setResetConfirmOpen(false);

    if (result.ok) {
      postResetRefreshPendingRef.current = true;
      setDashboardReloadKey((key) => key + 1);
    }
  }

  function handleRefreshDashboardRecords() {
    if (!isAdmin || !authSession || isAdminActionRunning) {
      return;
    }

    setAdminActionStatus("idle");
    setAdminActionMessage("Refreshing demo workspace records...");
    recordBackendEvent({
      kind: "dashboard-refresh",
      status: "running",
      message: "Manual dashboard refresh requested.",
      source: "admin actions",
    });
    setDashboardReloadKey((key) => key + 1);
  }

  function getTelegramOwnerLinkTone(status: TelegramLinkStatus) {
    return status === "link_ready" ? "success" : "error";
  }

  function formatTelegramOwnerLinkExpiry(value: string | null) {
    if (!value) {
      return "";
    }

    return new Date(value).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function clearTelegramOwnerLink() {
    setTelegramOwnerLinkUrl(null);
    setTelegramOwnerLinkExpiresAt(null);
  }

  function handleSelectDashboardAgent(agentId: string) {
    setSelectedDashboardAgentId(agentId);
    clearTelegramOwnerLink();
    setTelegramOwnerLinkStatus("idle");
    setTelegramOwnerLinkMessage(
      "Owner chat linking is available after the selected Telegram session is active.",
    );
  }

  async function handleIssueTelegramOwnerLink() {
    if (!authSession || !agentRecord) {
      clearTelegramOwnerLink();
      setTelegramOwnerLinkStatus("error");
      setTelegramOwnerLinkMessage("Sign in and deploy a demo agent before linking Telegram chat.");
      return;
    }

    clearTelegramOwnerLink();
    setTelegramOwnerLinkStatus("running");
    setTelegramOwnerLinkMessage("Generating a one-time Telegram owner link...");

    try {
      const freshAuth = await ensureFreshAuthSession(authSession);

      syncFreshAuthSession(authSession, freshAuth);

      if (!freshAuth.session) {
        setTelegramOwnerLinkStatus("error");
        setTelegramOwnerLinkMessage(freshAuth.message);
        return;
      }

      const result = await issueTelegramOwnerLink({
        session: freshAuth.session,
        agentId: agentRecord.id,
      });

      setTelegramOwnerLinkStatus(getTelegramOwnerLinkTone(result.status));

      if (result.ok && result.telegramLink) {
        setTelegramOwnerLinkUrl(result.telegramLink);
        setTelegramOwnerLinkExpiresAt(result.expiresAt);
        setTelegramOwnerLinkMessage(
          result.expiresAt
            ? `Owner link ready until ${formatTelegramOwnerLinkExpiry(result.expiresAt)}.`
            : result.message,
        );
        return;
      }

      setTelegramOwnerLinkMessage(result.message);
    } catch {
      setTelegramOwnerLinkStatus("error");
      setTelegramOwnerLinkMessage("Telegram owner-link request failed safely.");
    }
  }

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <span className="agent-orb">
            <img src="/brand/kyra.jpg" alt="" aria-hidden="true" />
          </span>
          <div>
            <strong>Kyra Console</strong>
            <small>{workspace.name}</small>
          </div>
        </div>

        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          <a
            className={activeDashboardSectionId === "overview" ? "is-active" : undefined}
            href="/dashboard/overview"
            onClick={(event) => {
              event.preventDefault();
              openDashboardSection("overview");
            }}
          >
            <Activity size={16} />
            Overview
          </a>
          <a
            className={activeDashboardSectionId === "auth" ? "is-active" : undefined}
            href="/dashboard/auth"
            onClick={(event) => {
              event.preventDefault();
              openDashboardSection("auth");
            }}
          >
            <KeyRound size={16} />
            Account
          </a>
          <a
            className={activeDashboardSectionId === "approvals" ? "is-active" : undefined}
            href="/dashboard/approvals"
            onClick={(event) => {
              event.preventDefault();
              openDashboardSection("approvals");
            }}
          >
            <WalletCards size={16} />
            Approvals
          </a>
          <a
            className={activeDashboardSectionId === "logs" ? "is-active" : undefined}
            href="/dashboard/logs"
            onClick={(event) => {
              event.preventDefault();
              openDashboardSection("logs");
            }}
          >
            <Terminal size={16} />
            Logs
          </a>
          <a
            className={activeDashboardSectionId === "modules" ? "is-active" : undefined}
            href="/dashboard/modules"
            onClick={(event) => {
              event.preventDefault();
              openDashboardSection("modules");
            }}
          >
            <Radio size={16} />
            Modules
          </a>
          <a
            className={activeDashboardSectionId === "backend" ? "is-active" : undefined}
            href="/dashboard/backend"
            onClick={(event) => {
              event.preventDefault();
              openDashboardSection("backend");
            }}
          >
            <Server size={16} />
            Readiness
          </a>
          {isAdmin ? (
            <a
              className={activeDashboardSectionId === "admin-actions" ? "is-active" : undefined}
              href="/dashboard/admin-actions"
              onClick={(event) => {
                event.preventDefault();
                openDashboardSection("admin-actions");
              }}
            >
              <Trash2 size={16} />
              Admin
            </a>
          ) : null}
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
                  ? "Persisted demo agent"
                  : "Demo agent ready"
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
                ? "Dashboard records are hidden until an account session is active. Sign in to load quota, deployed agents, approvals, and public routes."
                : agentRecord
                ? activeTemplate.role
                : "Deploy a demo agent to create persisted dashboard records."}
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

        {agentRecords.length ? (
          <section className="dashboard-agent-selector" aria-label="Dashboard agent selector">
            <div className="panel-title">
              <span>Viewing agent</span>
              <span>{agentRecords.length}/{demoAgentLimits.maxAgentsPerWorkspace}</span>
            </div>
            <div className="dashboard-agent-strip" role="list">
              {agentRecords.map((agent) => {
                const template =
                  agentTemplates.find((item) => item.id === agent.templateId) ??
                  selectedTemplate;
                const selected = agent.id === agentRecord?.id;

                return (
                  <button
                    className={`dashboard-agent-pill ${selected ? "is-active" : ""}`}
                    type="button"
                    key={agent.id}
                    onClick={() => handleSelectDashboardAgent(agent.id)}
                    aria-pressed={selected}
                  >
                    <span>
                      <strong>{agent.displayName}</strong>
                      <small>{template.name}</small>
                    </span>
                    <span>
                      <small>{agent.handle}</small>
                      <em>{formatRuntimeValue(agent.telegramStatus)}</em>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ) : null}

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
              <span>Agent overview</span>
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
                    ? "No persisted demo agent records."
                    : "Dashboard records locked until sign-in."}
                </strong>
                <p>
                  {authSession
                    ? "This signed-in workspace is clean. Deploy a demo agent from the home flow to create the dashboard, approval queue, wallet policy, logs, and public agent route."
                    : "Sign in to load account-scoped demo workspace records. No sample agent, wallet queue, or public route is shown while signed out."}
                </p>
              </div>
            )}
          </section>

          <section className="dashboard-panel telegram-status-panel">
            <div className="panel-title">
              <span>Telegram connection</span>
              <span>{agentRecord ? "selected agent" : "locked"}</span>
            </div>
            <div className="telegram-status-card">
              <span className="telegram-status-icon">
                <Bot size={18} />
              </span>
              <div>
                <small>Telegram live connect</small>
                <strong>Owner chat not linked</strong>
                <p>
                  Bot connection uses backend-only token handling. Link the owner chat
                  before read-only Telegram commands are enabled.
                </p>
              </div>
            </div>
            {authSession && agentRecord ? (
              <>
                <div className="telegram-connect-gate">
                  <div className="telegram-status-actions">
                    <button className="button button-ghost" type="button" disabled>
                      <LockKeyhole size={16} />
                      Reconnect Telegram
                    </button>
                    <span>Deploy flow next</span>
                  </div>
                  <p className="telegram-connect-message telegram-connect-idle">
                    Connection changes belong in deploy or reconnect flow. Dashboard only shows
                    selected-agent status and owner pairing.
                  </p>
                </div>
                <div className="telegram-owner-link-gate">
                  <div>
                    <small>Owner pairing</small>
                    <strong>Link signed-in owner chat</strong>
                  </div>
                  <div className="telegram-status-actions">
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={handleIssueTelegramOwnerLink}
                      disabled={telegramOwnerLinkStatus === "running"}
                    >
                      <KeyRound size={16} />
                      {telegramOwnerLinkStatus === "running" ? "Generating" : "Generate owner link"}
                    </button>
                    {telegramOwnerLinkUrl ? (
                      <>
                        <a
                          className="button button-primary telegram-open-link"
                          href={telegramOwnerLinkUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open Telegram
                          <ExternalLink size={16} />
                        </a>
                        <button
                          className="button button-ghost telegram-cancel-button"
                          type="button"
                          onClick={clearTelegramOwnerLink}
                          aria-label="Clear Telegram owner link"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : null}
                  </div>
                  <p className={`telegram-connect-message telegram-connect-${telegramOwnerLinkStatus}`}>
                    {telegramOwnerLinkMessage}
                  </p>
                </div>
              </>
            ) : (
              <div className="telegram-status-actions">
                <button className="button button-ghost" type="button" disabled>
                  <LockKeyhole size={16} />
                  Select an agent
                </button>
                <span>Status only</span>
              </div>
            )}
          </section>

          <section className="dashboard-panel" id="approvals">
            <div className="panel-title">
              <span>Approval queue</span>
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
                  <p>
                    {authSession
                      ? "Deploy a demo agent before Kyra creates wallet approval records."
                      : "Sign in to load account-scoped approval records. Nothing is mocked while signed out."}
                  </p>
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
              <span>Wallet policy</span>
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
                  <p>
                    {authSession
                      ? "No keys, funds, or approval settings exist until a demo agent is deployed."
                      : "Sign in and deploy a demo agent before Kyra shows wallet policy records."}
                  </p>
                </div>
              )}
            </div>
          </section>

          {isAdmin ? (
            <section className="dashboard-panel admin-actions-panel" id="admin-actions">
            <div className="panel-title">
              <span>Admin actions</span>
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
                <strong>{authSession ? "Signed-in demo workspace" : "Account session required"}</strong>
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
            {authSession ? (
              <details className="backend-diagnostics">
                <summary>
                  <span>
                    <Server size={16} />
                    Backend Diagnostics
                  </span>
                  <small>Technical details</small>
                </summary>
                <div className="backend-diagnostics-content">
                  <div className="diagnostic-note-grid">
                    <p>
                      Provider: <strong>{templateCatalogSource}</strong>
                    </p>
                    <p>
                      Runtime: <strong>{formatRuntimeValue(appConfig.mode)}</strong>
                    </p>
                    <p>
                      Function health: <strong>{deployFunctionMessage || "checking"}</strong>
                    </p>
                  </div>
                  <div className="diagnostic-status-grid">
                    {diagnosticRows.map((row) => (
                      <article className={`diagnostic-status-card diagnostic-${row.tone}`} key={row.label}>
                        <span>{row.label}</span>
                        <strong>{formatRuntimeValue(row.value)}</strong>
                        <small>{row.detail}</small>
                      </article>
                    ))}
                  </div>
                  {lastBackendIssue ? (
                    <p className="readiness-error-note">
                      Last backend issue: {lastBackendIssue.message}
                    </p>
                  ) : null}
                  {templateCatalogError ? (
                    <p className="readiness-error-note">
                      Supabase catalog query failed: {templateCatalogError}
                    </p>
                  ) : null}
                  {dashboardError ? (
                    <p className="readiness-error-note">
                      Supabase dashboard query: {dashboardError}
                    </p>
                  ) : null}
                  <div className="deploy-readiness-checklist" aria-label="Deploy agent diagnostics checklist">
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
                        <p>A fresh account session stays clean until the next demo deploy.</p>
                      </div>
                    )}
                  </div>
                  <div className="backend-contract-line">
                    <span>{supabaseStatus.tables.length} Supabase tables mapped</span>
                    <span>{agentTemplates.length} templates loaded</span>
                    <span>
                      {dashboardAgentCount
                        ? `${dashboardAgentCount} persisted demo agents`
                        : "no persisted demo agents"}
                    </span>
                    <span>max {demoAgentLimits.maxAgentsPerWorkspace} demo agents</span>
                    <span>deploy-agent {getDeployFunctionHealthLabel(deployFunctionStatus)}</span>
                    <span>onchain execution disabled</span>
                  </div>
                </div>
              </details>
            ) : null}
            </section>
          ) : null}

          <section className="dashboard-panel backend-readiness-panel" id="backend">
            <div className="panel-title">
              <span>Demo readiness</span>
              <span>{authSession ? "account connected" : "preview mode"}</span>
            </div>
            <div className="readiness-summary">
              <span className={`readiness-chip readiness-${getDashboardReadinessTone(dashboardStatus)}`}>
                <ShieldCheck size={14} />
                {dashboardStatus === "connected" ? "Demo persistence active" : "demo safe"}
              </span>
              <p>{kyraRepositoryRuntime.note}</p>
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
            <div className="backend-contract-line">
              <span>{agentTemplates.length} connected templates</span>
              <span>
                {dashboardAgentCount
                  ? `${dashboardAgentCount} persisted demo agents`
                  : "no persisted demo agents"}
              </span>
              <span>max {demoAgentLimits.maxAgentsPerWorkspace} demo agents</span>
              <span>approval-first workflows</span>
              <span>onchain execution disabled</span>
            </div>
          </section>

          <section className="dashboard-panel" id="logs">
            <div className="panel-title">
              <span>Activity log</span>
              <span>demo replay</span>
            </div>
            <div className="dashboard-log-box">
              {activityLines.map((log) => (
                <p key={log}>{log}</p>
              ))}
            </div>
          </section>

          <section className="dashboard-panel" id="modules">
            <div className="panel-title">
              <span>Kyra modules</span>
              <span>core ready</span>
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
              <span>Available templates</span>
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

      {resetConfirmOpen && isAdmin ? (
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
