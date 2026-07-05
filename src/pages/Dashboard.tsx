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
  Radio,
  RotateCcw,
  Server,
  ShieldCheck,
  Terminal,
  Trash2,
  WalletCards,
  X,
} from "lucide-react";
import { AuthSessionPanel } from "../components/AuthSessionPanel";
import {
  BaseAccountConnectionPanel,
  type BaseAccountConnectionStatus,
} from "../components/BaseAccountConnectionPanel";
import { Phase8ControlledSubmitter } from "../components/Phase8ControlledSubmitter";
import type { AgentTemplate } from "../types/agent";
import { appConfig } from "../config/appConfig";
import { demoAgentLimits } from "../config/demoLimits";
import { coreModules } from "../data/modules";
import { kyraRepositoryRuntime } from "../services/repositoryFactory";
import {
  type DeployFunctionHealthStatus,
  fetchDeployFunctionHealth,
  getDeployFunctionHealthLabel,
  getDeployFunctionHealthTone,
} from "../services/deployFunctionHealthService";
import {
  fetchSupabaseDashboardData,
  resetSupabaseDemoWorkspace,
  type SupabaseDashboardData,
  type SupabaseDashboardStatus,
} from "../services/supabaseDashboardService";
import type {
  KyraAuthSession,
  KyraAuthStatus,
} from "../services/supabaseAuthService";
import { ensureFreshAuthSession } from "../services/supabaseAuthService";
import {
  type BackendEvent,
  type BackendEventStatus,
  getBackendEvents,
  recordBackendEvent,
  subscribeBackendEvents,
} from "../services/backendObservabilityService";
import {
  getSupabaseAdapterStatus,
  type SupabaseConnectionStatus,
} from "../services/supabaseKyraRepository";
import {
  fetchTelegramDashboardStatuses,
  type TelegramDashboardStatusRecord,
} from "../services/telegramDashboardStatusService";
import {
  prepareBaseMcpStatusCheck,
  type BaseMcpDashboardStatus,
} from "../services/baseMcpPrepareService";
import type { BaseMcpPreparedActionSummary } from "../types/baseMcp";
import { reviewPreparedActionAllowlist } from "../types/preparedAction";
import { evaluatePreparedActionPolicy } from "../types/preparedActionPolicy";
import {
  evaluateDualApprovalExecution,
  freezeReviewedPreparedAction,
} from "../types/dualApprovalExecution";
import { evaluateResultMonitoringCloseout } from "../types/resultMonitoringCloseout";
import { evaluateControlledLiveTransactionGate } from "../types/controlledLiveTransactionGate";
import { evaluateExecutionLaunchReadiness } from "../types/executionLaunchReadiness";
import { evaluatePhase8ControlledExecution } from "../types/phase8ControlledExecution";
import { evaluatePhase8LiveWindowPreparation } from "../types/phase8LiveWindowPreparation";
import { evaluatePhase8WalletPromptOpening } from "../types/phase8WalletPromptOpening";
import {
  evaluatePhase8ControlledSubmission,
  type Phase8ControlledSubmissionResultEvent,
} from "../types/phase8ControlledSubmission";
import { evaluatePhase8OwnerLiveWindowActivation } from "../types/phase8OwnerLiveWindowActivation";
import { createPhase8OwnerActionCandidate } from "../types/phase8OwnerActionCandidate";
import { evaluatePhase8RuntimeEnablementPreflight } from "../types/phase8RuntimeEnablementPreflight";
import { baseChainId } from "../types/unsignedTransactionHandoff";
import { maskBaseAccountAddress } from "../types/baseAccountConnection";
import type { DataProvider } from "../types/api";
import type {
  DemoActivityLog,
  DemoApprovalRequest,
  DemoExecutionResult,
  DemoPreparedActionPreview,
  DemoRecordStatus,
  DemoTelegramSessionSummary,
  DemoTelegramWebhookStatus,
  DemoWalletProviderStatus,
  DemoWalletReadiness,
  DemoWalletReadinessState,
} from "../types/backend";
import {
  evaluateWalletPromptEligibility,
  getWalletPromptBlockMessage,
} from "../types/walletPromptEligibility";

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
  onSelectTemplate: (templateId: string) => void;
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

  return request.status === "read_only_ready" || request.status === "approved"
    ? "ok"
    : "review";
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

function getWalletReadinessFallback(
  signedIn: boolean,
  hasAgentRecord: boolean,
): DemoWalletReadiness {
  return {
    state: "not_connected",
    label: hasAgentRecord ? "Execution disabled" : "No wallet record",
    addressLabel: "Not connected",
    network: "Base pending",
    approvalGate: "Not created",
    execution: "Disabled",
    nextAction: signedIn
      ? "Deploy an agent before wallet readiness checks."
      : "Sign in to load owner-only wallet readiness.",
    privacyNote:
      "Wallet data stays owner-only and never appears on public profiles.",
  };
}

function getWalletReadinessTone(state: DemoWalletReadinessState) {
  if (state === "connected_ready_for_approval") {
    return "ready";
  }

  if (state === "connected_wrong_network") {
    return "error";
  }

  return state === "execution_disabled" ? "locked" : "standby";
}

function getWalletProviderStatusFallback(): DemoWalletProviderStatus {
  const connectionEnabled =
    appConfig.integrations.walletConnection === "owner_click_only";

  return {
    providerStack: "Wagmi + Viem",
    dependencyStatus: "installed",
    runtimeGate: connectionEnabled ? "enabled" : "disabled",
    promptAccess: connectionEnabled ? "owner_click_only" : "disabled",
    connectorPriority: ["Base Account"],
    safetyNote: connectionEnabled
      ? "Connection is owner-initiated. Signing and transactions remain disabled."
      : "Base Account connection is disabled.",
  };
}

function getPreparedActionPreviewFallback(
  signedIn: boolean,
): DemoPreparedActionPreview {
  return {
    id: "base_mcp_status_check_preview",
    status: "blocked",
    actionKind: "base_mcp_status_check",
    title: "Base MCP status check",
    chain: "Base",
    routeSummary:
      "Read-only capability check before any transaction preparation.",
    valueSummary: "No token spend, no gas request, no calldata.",
    risk: "read-only",
    expiresLabel: "Not issued",
    approvalRequirement: signedIn
      ? "Deploy an agent before preparation."
      : "Sign in before owner-scoped preparation.",
    ownerScope: "Signed-in dashboard owner only",
    safetyNote: "No wallet prompt, no signing, no transaction submission.",
  };
}

function getPreparedActionTone(status: DemoPreparedActionPreview["status"]) {
  if (status === "preview_ready") {
    return "ready";
  }

  return status === "draft" ? "locked" : "standby";
}

function createBaseMcpPreparedActionPreview(
  summary: BaseMcpPreparedActionSummary,
): DemoPreparedActionPreview {
  return {
    id: "base_mcp_status_check_live_preview",
    status: "preview_ready",
    actionKind: summary.actionKind,
    title: "Base MCP status check",
    chain: summary.chain,
    routeSummary: summary.routeSummary,
    valueSummary: summary.valueSummary,
    risk: summary.risk,
    expiresLabel: summary.expiryIso
      ? new Date(summary.expiryIso).toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
      : "No expiry",
    approvalRequirement: "Read-only result. No wallet approval was requested.",
    ownerScope: "Signed-in dashboard owner only",
    safetyNote: "No storage write, wallet prompt, signing, or transaction submission.",
  };
}

function getExecutionResultFallback(
  signedIn: boolean,
): DemoExecutionResult[] {
  return [
    {
      id: "execution_pending_fallback",
      preparedActionId: "base_mcp_status_check_preview",
      agentId: "no-agent",
      status: "pending",
      label: signedIn ? "No execution record" : "Sign-in required",
      summary: signedIn
        ? "Deploy an agent before Kyra can show owner-only execution states."
        : "Execution results are hidden until an account session is active.",
      txHashLabel: "Not submitted",
      failureReason: null,
      visibility: "owner-only",
      updatedAt: "--:--:--",
    },
  ];
}

function getExecutionResultTone(status: DemoExecutionResult["status"]) {
  if (status === "confirmed" || status === "approved") {
    return "ready";
  }

  if (status === "failed" || status === "rejected") {
    return "error";
  }

  return status === "submitted" ? "locked" : "standby";
}

function formatActivityLog(log: DemoActivityLog) {
  const sourceLabel = {
    agent_instances: "agent",
    telegram_sessions: "telegram",
    base_mcp_routes: "base action",
    approval_requests: "approval",
    execution_results: "execution",
    wallet_policies: "wallet policy",
    activity_logs: "activity",
  }[log.source] ?? "backend";

  return `[${log.timestamp}] ${sourceLabel}: ${log.message}`;
}

function getCatalogValue(
  status: SupabaseConnectionStatus,
  templateCount: number,
) {
  if (status === "connected") {
    return `${templateCount} connected templates`;
  }

  if (status === "error") {
    return "local fallback";
  }

  return status === "checking" ? "checking" : "local";
}

type DeployChecklistState = "complete" | "active" | "blocked" | "todo";
type TelegramDashboardStatusLoadState =
  | "idle"
  | "loading"
  | "ready"
  | "unavailable";

interface TelegramSessionDisplayStatus {
  agentId: string;
  botHandle: string | null;
  webhookStatus: DemoTelegramWebhookStatus;
  ownerChatLinked?: boolean;
  ownerLinkAvailable?: boolean;
  lastEventAt: string | null;
}

interface DeployChecklistItem {
  label: string;
  detail: string;
  state: DeployChecklistState;
}

function getDeployChecklistState(
  status: DeployFunctionHealthStatus,
): DeployChecklistState {
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

function getDashboardChecklistState(
  status: SupabaseDashboardStatus,
): DeployChecklistState {
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

function getDiagnosticTone(
  status: BackendEventStatus | "ready" | "standby" | "locked",
) {
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

function getTelegramSessionLabel(
  session: TelegramSessionDisplayStatus | null,
  fallbackStatus?: DemoRecordStatus,
) {
  if (!session) {
    return fallbackStatus
      ? formatRuntimeValue(fallbackStatus)
      : "not connected";
  }

  if (session.webhookStatus === "active") {
    return "webhook active";
  }

  if (session.webhookStatus === "queued") {
    return "webhook queued";
  }

  if (session.webhookStatus === "paused") {
    return "webhook paused";
  }

  return "demo session";
}

function getTelegramSessionHeadline(
  session: TelegramSessionDisplayStatus | null,
) {
  if (!session) {
    return "Telegram not connected";
  }

  if (session.webhookStatus === "active") {
    return "Telegram connected";
  }

  if (session.webhookStatus === "queued") {
    return "Webhook activation queued";
  }

  if (session.webhookStatus === "paused") {
    return "Telegram paused";
  }

  return "Telegram demo session";
}

function getTelegramSessionDescription(
  session: TelegramSessionDisplayStatus | null,
) {
  if (!session) {
    return "Use the deploy flow with a valid BotFather token to create a backend-only Telegram session for this agent.";
  }

  if (session.ownerChatLinked) {
    return "Owner chat is linked. Read-only Telegram commands can use the authorized chat when delivery is enabled.";
  }

  if (session.webhookStatus === "active") {
    return "Backend-only bot session and webhook are active. Link the owner chat before read-only Telegram commands are enabled.";
  }

  if (session.webhookStatus === "queued") {
    return "Connect validation passed. Webhook activation still needs backend finalization.";
  }

  if (session.webhookStatus === "paused") {
    return "Telegram delivery is paused for this agent. Deploy again with a valid BotFather token when ready.";
  }

  return "This agent is still on a simulated Telegram demo session.";
}

function getTelegramOwnerPairingLabel(
  active: boolean,
  ownerChatLinked = false,
) {
  if (ownerChatLinked) {
    return "Owner chat linked";
  }

  return active ? "Owner chat pending" : "Waiting for bot";
}

function getTelegramCommandAccessLabel(
  active: boolean,
  ownerChatLinked = false,
) {
  if (ownerChatLinked) {
    return "Read-only enabled";
  }

  return active ? "Pairing pending" : "Disabled";
}

function getTelegramSessionRank(session: DemoTelegramSessionSummary) {
  if (session.webhookStatus === "active") {
    return 0;
  }

  if (session.webhookStatus === "queued") {
    return 1;
  }

  if (session.webhookStatus === "paused") {
    return 2;
  }

  return 3;
}

function selectTelegramSessionForAgent(
  sessions: DemoTelegramSessionSummary[] | undefined,
  agentId: string | undefined,
) {
  if (!sessions?.length || !agentId) {
    return null;
  }

  return (
    sessions
      .filter((session) => session.agentId === agentId)
      .sort((left, right) => {
        const rankDifference = getTelegramSessionRank(left) -
          getTelegramSessionRank(right);

        if (rankDifference !== 0) {
          return rankDifference;
        }

        return Date.parse(right.createdAt) - Date.parse(left.createdAt);
      })[0] ?? null
  );
}

function selectTelegramDashboardStatusForAgent(
  statuses: TelegramDashboardStatusRecord[],
  agentId: string | undefined,
) {
  if (!agentId) {
    return null;
  }

  return statuses.find((status) => status.agentId === agentId) ?? null;
}

interface Phase8OwnerArmingState {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  freezeKey: string;
  promptNonce: string;
  submissionNonce: string;
  armedAt: string;
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
  onSelectTemplate,
}: DashboardProps) {
  const agentTemplates = templates;
  const [dashboardStatus, setDashboardStatus] = useState<
    SupabaseDashboardStatus
  >(
    authSession ? "loading" : "empty",
  );
  const [dashboardData, setDashboardData] = useState<
    SupabaseDashboardData | null
  >(null);
  const [dashboardError, setDashboardError] = useState<string | null>(null);
  const [dashboardReloadKey, setDashboardReloadKey] = useState(0);
  const [adminActionStatus, setAdminActionStatus] = useState<
    "idle" | "running" | "success" | "error"
  >("idle");
  const [adminActionMessage, setAdminActionMessage] = useState(
    "Admin actions are scoped to this signed-in demo workspace.",
  );
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [activeDashboardSectionId, setActiveDashboardSectionId] = useState<
    DashboardSectionId
  >(() =>
    typeof window === "undefined"
      ? "overview"
      : getDashboardSectionIdFromPath(window.location.pathname)
  );
  const isAdmin = authSession?.user.app_metadata?.role === "admin";
  const postResetRefreshPendingRef = useRef(false);
  const [backendEvents, setBackendEvents] = useState<BackendEvent[]>(() =>
    getBackendEvents()
  );
  const [lastDashboardRefreshAt, setLastDashboardRefreshAt] = useState<
    string | null
  >(null);
  const [deployFunctionStatus, setDeployFunctionStatus] = useState<
    DeployFunctionHealthStatus
  >(
    appConfig.functions.deployAgentConfigured ? "checking" : "not-configured",
  );
  const [deployFunctionMessage, setDeployFunctionMessage] = useState("");
  const [selectedDashboardAgentId, setSelectedDashboardAgentId] = useState<
    string | null
  >(null);
  const [telegramDashboardStatusState, setTelegramDashboardStatusState] =
    useState<TelegramDashboardStatusLoadState>("idle");
  const [telegramDashboardStatusMessage, setTelegramDashboardStatusMessage] =
    useState(
      "Dashboard Telegram status read model is gated.",
    );
  const [telegramDashboardStatuses, setTelegramDashboardStatuses] = useState<
    TelegramDashboardStatusRecord[]
  >([]);
  const [baseMcpStatusState, setBaseMcpStatusState] = useState<
    "idle" | "checking" | "ready" | "blocked" | "error"
  >("idle");
  const [baseMcpStatusCode, setBaseMcpStatusCode] = useState<
    BaseMcpDashboardStatus | null
  >(null);
  const [baseMcpStatusMessage, setBaseMcpStatusMessage] = useState(
    "Run an owner-only read-only capability check.",
  );
  const [baseMcpPreparedSummary, setBaseMcpPreparedSummary] = useState<
    BaseMcpPreparedActionSummary | null
  >(null);
  const [baseAccountConnectionStatus, setBaseAccountConnectionStatus] =
    useState<BaseAccountConnectionStatus>({
      connected: false,
      address: null,
      chainId: null,
      connectorId: null,
    });
  const [phase8OwnerArming, setPhase8OwnerArming] =
    useState<Phase8OwnerArmingState | null>(null);
  const [phase8SubmitterResult, setPhase8SubmitterResult] =
    useState<Phase8ControlledSubmissionResultEvent | null>(null);
  const baseMcpRequestSequenceRef = useRef(0);
  const supabaseStatus = getSupabaseAdapterStatus();

  useEffect(() => {
    return subscribeBackendEvents(() => setBackendEvents(getBackendEvents()));
  }, []);

  useEffect(() => {
    function syncDashboardSectionFromLocation() {
      setActiveDashboardSectionId(
        getDashboardSectionIdFromPath(window.location.pathname),
      );
    }

    window.addEventListener("popstate", syncDashboardSectionFromLocation);
    return () =>
      window.removeEventListener("popstate", syncDashboardSectionFromLocation);
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
      setDashboardStatus(
        appConfig.supabase.configured ? "empty" : "not-configured",
      );
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
          status: result.ok || result.status === "empty"
            ? "success"
            : result.status === "error"
            ? "error"
            : "info",
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
            `Reset succeeded, but dashboard refresh failed: ${
              result.error ?? "records unavailable"
            }`,
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
        status: result.status === "ready"
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
  const dashboardAgentIdsKey = useMemo(
    () => agentRecords.map((agent) => agent.id).join(","),
    [agentRecords],
  );

  useEffect(() => {
    if (
      !authSession ||
      !agentRecords.length ||
      !appConfig.featureFlags.telegramDashboardStatusReadModel
    ) {
      setTelegramDashboardStatusState("idle");
      setTelegramDashboardStatusMessage(
        "Dashboard Telegram status read model is gated.",
      );
      setTelegramDashboardStatuses([]);
      return;
    }

    let active = true;
    const sessionToLoad = authSession;
    const agentIds = agentRecords.map((agent) => agent.id);

    async function loadTelegramDashboardStatuses() {
      setTelegramDashboardStatusState("loading");
      setTelegramDashboardStatusMessage(
        "Loading dashboard-safe Telegram status...",
      );

      const freshAuth = await ensureFreshAuthSession(sessionToLoad);

      if (!active) {
        return;
      }

      syncFreshAuthSession(sessionToLoad, freshAuth);

      if (!freshAuth.session) {
        setTelegramDashboardStatusState("unavailable");
        setTelegramDashboardStatusMessage(freshAuth.message);
        setTelegramDashboardStatuses([]);
        return;
      }

      const result = await fetchTelegramDashboardStatuses({
        session: freshAuth.session,
        agentIds,
      });

      if (!active) {
        return;
      }

      setTelegramDashboardStatusState(result.ok ? "ready" : "unavailable");
      setTelegramDashboardStatusMessage(result.message);
      setTelegramDashboardStatuses(result.ok ? result.telegramStatuses : []);
    }

    void loadTelegramDashboardStatuses();

    return () => {
      active = false;
    };
  }, [agentRecords, authSession, dashboardAgentIdsKey]);

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

  useEffect(() => {
    baseMcpRequestSequenceRef.current += 1;
    setBaseMcpStatusState("idle");
    setBaseMcpStatusCode(null);
    setBaseMcpStatusMessage(
      "Run an owner-only read-only capability check.",
    );
    setBaseMcpPreparedSummary(null);
  }, [authSession?.user.id, selectedDashboardAgentId]);

  const agentRecord =
    agentRecords.find((agent) => agent.id === selectedDashboardAgentId) ??
      dashboardData?.latestAgent ??
      null;

  const selectedTelegramSession = useMemo(() => {
    return selectTelegramSessionForAgent(
      dashboardData?.telegramSessions,
      agentRecord?.id,
    );
  }, [agentRecord, dashboardData?.telegramSessions]);
  const selectedTelegramDashboardStatus = useMemo(() => {
    return selectTelegramDashboardStatusForAgent(
      telegramDashboardStatuses,
      agentRecord?.id,
    );
  }, [agentRecord?.id, telegramDashboardStatuses]);
  const selectedTelegramStatus = selectedTelegramDashboardStatus ??
    selectedTelegramSession;
  const selectedTelegramActive =
    selectedTelegramStatus?.webhookStatus === "active";
  const selectedTelegramOwnerChatLinked =
    selectedTelegramDashboardStatus?.ownerChatLinked ?? false;
  const telegramDashboardStatusEnabled =
    appConfig.featureFlags.telegramDashboardStatusReadModel;
  const dashboardAgentCount = agentRecords.length;
  const activeTemplate = useMemo(
    () =>
      agentTemplates.find((template) =>
        template.id === agentRecord?.templateId
      ) ??
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
  const walletReadiness = dashboardData?.walletReadiness ??
    getWalletReadinessFallback(Boolean(authSession), Boolean(agentRecord));
  const walletProviderStatus = dashboardData?.walletProviderStatus ??
    getWalletProviderStatusFallback();
  const walletReadinessTone = getWalletReadinessTone(walletReadiness.state);
  const walletPromptEligibility = useMemo(
    () =>
      evaluateWalletPromptEligibility({
        walletExecutionEnabled:
          appConfig.integrations.walletExecution !== "disabled",
        promptSource: "owner_dashboard_click",
        ownerSignedIn: Boolean(authSession),
        privateDashboard: true,
        selectedAgent: Boolean(agentRecord),
        baseAccountConnected: baseAccountConnectionStatus.connected,
        chainId: baseAccountConnectionStatus.chainId,
        preparedActionReviewed: false,
        riskReviewReady: false,
        ownerApprovalRecorded: false,
        handoffValid: false,
        handoffExpired: false,
      }),
    [
      agentRecord,
      authSession,
      baseAccountConnectionStatus.chainId,
      baseAccountConnectionStatus.connected,
    ],
  );
  const preparedActionPreview = baseMcpPreparedSummary
    ? createBaseMcpPreparedActionPreview(baseMcpPreparedSummary)
    : dashboardData?.preparedActionPreview ??
      getPreparedActionPreviewFallback(Boolean(authSession));
  const preparedActionAllowlistReview = useMemo(
    () =>
      reviewPreparedActionAllowlist({
        source: "owner_dashboard",
        walletExecutionEnabled:
          appConfig.integrations.walletExecution !== "disabled",
        actionKind: "base_reviewed_transaction",
        chainId: baseChainId,
        recipient: "0x1111111111111111111111111111111111111111",
        valueWei: "0",
        data: "0x",
        routeSummary: "Owner reviewed Base transaction preview.",
        valueSummary: "No token spend in Phase 7F.",
      }),
    [],
  );
  const preparedActionPolicyReview = useMemo(
    () =>
      evaluatePreparedActionPolicy({
        source: "owner_dashboard",
        walletExecutionEnabled:
          appConfig.integrations.walletExecution !== "disabled",
        ownerSignedIn: Boolean(authSession),
        selectedAgent: Boolean(agentRecord),
        preparedActionStorageEnabled: false,
        ownerApprovalRecorded: false,
        actionKind: "base_reviewed_transaction",
        chainId: baseChainId,
        recipient: "0x1111111111111111111111111111111111111111",
        valueWei: "0",
        data: "0x",
        routeSummary: "Owner reviewed Base transaction preview.",
        valueSummary: "No token spend in Phase 7G policy review.",
      }),
    [agentRecord, authSession],
  );
  const phase8OwnerActionCandidate = useMemo(
    () =>
      createPhase8OwnerActionCandidate({
        ownerUserId: authSession?.user.id,
        workspaceId: dashboardData?.workspace.id,
        agentId: agentRecord?.id,
        baseAccountConnected: baseAccountConnectionStatus.connected,
        baseAccountAddress: baseAccountConnectionStatus.address,
        chainId: baseAccountConnectionStatus.chainId,
      }),
    [
      agentRecord?.id,
      authSession?.user.id,
      baseAccountConnectionStatus.address,
      baseAccountConnectionStatus.chainId,
      baseAccountConnectionStatus.connected,
      dashboardData?.workspace.id,
    ],
  );
  const dualApprovalReview = useMemo(
    () =>
      evaluateDualApprovalExecution({
        policyReview: preparedActionPolicyReview,
        ownerDecision: { decision: "pending" },
        frozenAction: null,
        baseAccountConnected: baseAccountConnectionStatus.connected,
        handoffValid: false,
        walletExecutionEnabled:
          appConfig.integrations.walletExecution !== "disabled",
        walletSigningEnabled: false,
        officialMcpEnabled: false,
      }),
    [baseAccountConnectionStatus.connected, preparedActionPolicyReview],
  );
  const phase8FrozenAction = useMemo(() => {
    const ownerUserId = authSession?.user.id;
    const workspaceId = dashboardData?.workspace.id;
    const agentId = agentRecord?.id;
    const canonical = phase8OwnerActionCandidate.ok
      ? reviewPreparedActionAllowlist({
        source: "owner_dashboard",
        walletExecutionEnabled: true,
        actionKind: phase8OwnerActionCandidate.candidate.actionKind,
        chainId: baseChainId,
        recipient: phase8OwnerActionCandidate.candidate.recipient,
        valueWei: phase8OwnerActionCandidate.candidate.valueWei,
        data: phase8OwnerActionCandidate.candidate.data,
        routeSummary: phase8OwnerActionCandidate.candidate.routeSummary,
        valueSummary: phase8OwnerActionCandidate.candidate.valueSummary,
      }).canonical
      : null;

    if (!ownerUserId || !workspaceId || !agentId || !canonical) {
      return null;
    }

    return freezeReviewedPreparedAction({
      requestId: `phase8-${agentId}`,
      ownerUserId,
      workspaceId,
      agentId,
      approvalId: `phase8-owner-${agentId}`,
      approvedAt: "phase8-owner-live-window",
      canonical,
    });
  }, [
    agentRecord?.id,
    authSession?.user.id,
    dashboardData?.workspace.id,
    phase8OwnerActionCandidate,
  ]);

  const phase8OwnerArmingCurrent = useMemo(
    () => {
      const frozenAction = phase8FrozenAction;

      return Boolean(
        phase8OwnerArming &&
          frozenAction &&
          authSession?.user.id === phase8OwnerArming.ownerUserId &&
          dashboardData?.workspace.id === phase8OwnerArming.workspaceId &&
          agentRecord?.id === phase8OwnerArming.agentId &&
          frozenAction.freezeKey === phase8OwnerArming.freezeKey,
      );
    },
    [
      agentRecord?.id,
      authSession?.user.id,
      dashboardData?.workspace.id,
      phase8FrozenAction,
      phase8OwnerArming,
    ],
  );
  const activePhase8OwnerArming = phase8OwnerArmingCurrent
    ? phase8OwnerArming
    : null;

  useEffect(() => {
    if (!activePhase8OwnerArming && phase8SubmitterResult) {
      setPhase8SubmitterResult(null);
    }
  }, [activePhase8OwnerArming, phase8SubmitterResult]);

  function createPhase8Nonce(prefix: string) {
    const randomId = globalThis.crypto?.randomUUID?.() ??
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

    return `${prefix}-${randomId}`;
  }

  function armPhase8OwnerLiveWindow() {
    const frozenAction = phase8FrozenAction;
    const ownerUserId = authSession?.user.id;
    const workspaceId = dashboardData?.workspace.id;
    const agentId = agentRecord?.id;

    if (!frozenAction || !ownerUserId || !workspaceId || !agentId) {
      return;
    }

    setPhase8SubmitterResult(null);
    setPhase8OwnerArming({
      ownerUserId,
      workspaceId,
      agentId,
      freezeKey: frozenAction.freezeKey,
      promptNonce: createPhase8Nonce("phase8-prompt"),
      submissionNonce: createPhase8Nonce("phase8-submit"),
      armedAt: new Date().toISOString(),
    });
  }

  function resetPhase8OwnerLiveWindow() {
    setPhase8SubmitterResult(null);
    setPhase8OwnerArming(null);
  }
  const preparedActionTone = getPreparedActionTone(
    preparedActionPreview.status,
  );
  const executionResults = dashboardData?.executionResults.length
    ? dashboardData.executionResults
    : getExecutionResultFallback(Boolean(authSession));
  const resultMonitoringCloseout = useMemo(
    () =>
      evaluateResultMonitoringCloseout({
        ownerUserId: authSession?.user.id ?? "",
        workspaceId: dashboardData?.workspace.id ?? "",
        agentId: agentRecord?.id ?? "",
        preparedActionId: phase8FrozenAction?.requestId ?? executionResults[0]?.preparedActionId ?? "",
        providerStatus: phase8SubmitterResult ? "provider_submitted" : "not_started",
        txHash: phase8SubmitterResult?.txHash ?? null,
        confirmationId: null,
        failureCode: null,
        disconnectRequested: false,
        emergencyDisabled: false,
        visibleInPublicProfile: false,
      }),
    [
      agentRecord?.id,
      authSession?.user.id,
      dashboardData?.workspace.id,
      executionResults,
      phase8FrozenAction?.requestId,
      phase8SubmitterResult,
    ],
  );
  const controlledLiveTransactionGate = useMemo(() => {
    const liveCandidate = phase8OwnerActionCandidate.ok
      ? reviewPreparedActionAllowlist({
        source: "owner_dashboard",
        walletExecutionEnabled: true,
        actionKind: phase8OwnerActionCandidate.candidate.actionKind,
        chainId: baseChainId,
        recipient: phase8OwnerActionCandidate.candidate.recipient,
        valueWei: phase8OwnerActionCandidate.candidate.valueWei,
        data: phase8OwnerActionCandidate.candidate.data,
        routeSummary: phase8OwnerActionCandidate.candidate.routeSummary,
        valueSummary: phase8OwnerActionCandidate.candidate.valueSummary,
      })
      : null;

    return evaluateControlledLiveTransactionGate({
      ownerUserId: authSession?.user.id ?? "",
      workspaceId: dashboardData?.workspace.id ?? "",
      agentId: agentRecord?.id ?? "",
      baseAccountConnected: baseAccountConnectionStatus.connected,
      chainId: baseAccountConnectionStatus.chainId,
      preparedActionCount: phase8OwnerActionCandidate.ok ? 1 : 0,
      actionAllowlisted: liveCandidate?.allowed ?? false,
      actionRisk: liveCandidate?.allowed ? "low" : "blocked",
      dualApproval: dualApprovalReview,
      resultMonitoring: resultMonitoringCloseout,
      rollbackReady: true,
      emergencyDisableReady: true,
      postTransactionAuditReady: true,
      liveWindowApproved: false,
      visibleInPublicProfile: false,
      telegramCanAuthorize: false,
      walletPromptRuntimeEnabled: false,
      walletSigningRuntimeEnabled: false,
      transactionSubmissionRuntimeEnabled: false,
    });
  }, [
    agentRecord?.id,
    authSession?.user.id,
    baseAccountConnectionStatus.chainId,
    baseAccountConnectionStatus.connected,
    dashboardData?.workspace.id,
    dualApprovalReview,
    phase8OwnerActionCandidate,
    resultMonitoringCloseout,
  ]);
  const executionLaunchReadiness = useMemo(
    () =>
      evaluateExecutionLaunchReadiness({
        ownerSignedIn: Boolean(authSession),
        selectedAgent: Boolean(agentRecord),
        baseAccountConnected: baseAccountConnectionStatus.connected,
        controlledGate: controlledLiveTransactionGate,
        officialMcpAdapter: "no-go",
        telegramExecutionDisabled: true,
        publicExecutionHidden: true,
        walletExecutionRuntime: "disabled",
        walletSigningRuntime: "disabled",
        transactionSubmissionRuntime: "disabled",
        productionDeployHealthy: deployFunctionStatus !== "error",
        supabaseHealthy: dashboardStatus !== "error",
        rollbackReady: true,
        emergencyDisableReady: true,
        postTransactionAuditReady: true,
        ownerLaunchDecision: "not_requested",
      }),
    [
      agentRecord,
      authSession,
      baseAccountConnectionStatus.connected,
      controlledLiveTransactionGate,
      dashboardStatus,
      deployFunctionStatus,
    ],
  );
  const phase8ControlledExecution = useMemo(
    () =>
      evaluatePhase8ControlledExecution({
        ownerSignedIn: Boolean(authSession),
        selectedAgent: Boolean(agentRecord),
        baseAccountConnected: baseAccountConnectionStatus.connected,
        executionLaunch: executionLaunchReadiness,
        runtimeEnablement: String(appConfig.integrations.walletExecution) === "enabled"
          ? "enabled"
          : "disabled",
        ownerClickedExecute: false,
        frozenAction: phase8FrozenAction,
        baseAccountPromptState: "not_requested",
        resultMonitoring: resultMonitoringCloseout,
        rollbackReady: true,
        emergencyDisableReady: true,
        postTransactionAuditReady: true,
        telegramCanAuthorize: false,
        visibleInPublicProfile: false,
      }),
    [
      agentRecord,
      authSession,
      baseAccountConnectionStatus.connected,
      phase8FrozenAction,
      executionLaunchReadiness,
      resultMonitoringCloseout,
    ],
  );
  const phase8LiveWindowPreparation = useMemo(
    () => {
      const ownerUserId = authSession?.user.id ?? "";
      const workspaceId = dashboardData?.workspace.id ?? "";
      const selectedAgentId = agentRecord?.id ?? "";
      const nowIso = new Date().toISOString();

      return evaluatePhase8LiveWindowPreparation({
        ownerUserId,
        sessionUserId: ownerUserId,
        workspaceId,
        selectedWorkspaceId: workspaceId,
        selectedAgentId,
        chainId: baseAccountConnectionStatus.chainId,
        baseAccountConnected: baseAccountConnectionStatus.connected,
        liveWindow: {
          status: activePhase8OwnerArming ? "approved" : "not_requested",
          approvedByUserId: activePhase8OwnerArming?.ownerUserId ?? null,
          workspaceId: activePhase8OwnerArming?.workspaceId ?? null,
          agentId: activePhase8OwnerArming?.agentId ?? null,
          approvedAt: activePhase8OwnerArming?.armedAt ?? null,
          expiresAt: activePhase8OwnerArming
            ? new Date(Date.parse(activePhase8OwnerArming.armedAt) + 10 * 60 * 1000).toISOString()
            : null,
          revokedAt: null,
        },
        executeIntent: {
          source: "private_dashboard",
          ownerClickedExecute: Boolean(activePhase8OwnerArming),
          ownerUserId,
          workspaceId,
          agentId: selectedAgentId,
          requestedAt: activePhase8OwnerArming?.armedAt ?? null,
        },
        frozenAction: phase8FrozenAction,
        baseAccountPromptReadiness: baseAccountConnectionStatus.connected
          ? "ready"
          : "not_ready",
        nowIso,
        visibleInPublicProfile: false,
      });
    },
    [
      activePhase8OwnerArming,
      agentRecord?.id,
      authSession?.user.id,
      baseAccountConnectionStatus.chainId,
      baseAccountConnectionStatus.connected,
      dashboardData?.workspace.id,
      phase8FrozenAction,
    ],
  );
  const phase8WalletPromptOpening = useMemo(
    () => {
      const ownerUserId = authSession?.user.id ?? "";
      const workspaceId = dashboardData?.workspace.id ?? "";
      const selectedAgentId = agentRecord?.id ?? "";

      return evaluatePhase8WalletPromptOpening({
        liveWindowPreparation: phase8LiveWindowPreparation,
        ownerUserId,
        workspaceId,
        selectedAgentId,
        frozenAction: phase8FrozenAction,
        promptIntent: {
          source: "private_dashboard",
          ownerClickedOpenPrompt: Boolean(activePhase8OwnerArming),
          ownerUserId,
          workspaceId,
          agentId: selectedAgentId,
          frozenActionFreezeKey: phase8FrozenAction?.freezeKey ?? null,
          promptNonce: activePhase8OwnerArming?.promptNonce ?? null,
          promptNonceUsed: false,
          requestedAt: activePhase8OwnerArming?.armedAt ?? null,
        },
        promptState: activePhase8OwnerArming ? "approved" : "not_requested",
        auditEvents: activePhase8OwnerArming
          ? [{
            type: "prompt_approved",
            ownerOnly: true,
            sanitized: true,
            message: "Owner approved Batch 7 browser-session prompt readiness.",
            createdAt: activePhase8OwnerArming.armedAt,
          }]
          : [],
        visibleInPublicProfile: false,
      });
    },
    [
      activePhase8OwnerArming,
      agentRecord?.id,
      authSession?.user.id,
      dashboardData?.workspace.id,
      phase8FrozenAction,
      phase8LiveWindowPreparation,
    ],
  );
  const phase8ControlledSubmission = useMemo(
    () => {
      const ownerUserId = authSession?.user.id ?? "";
      const workspaceId = dashboardData?.workspace.id ?? "";
      const selectedAgentId = agentRecord?.id ?? "";

      return evaluatePhase8ControlledSubmission({
        walletPromptOpening: phase8WalletPromptOpening,
        ownerUserId,
        workspaceId,
        selectedAgentId,
        frozenAction: phase8FrozenAction,
        chain: baseAccountConnectionStatus.chainId === baseChainId ? "Base" : "Other",
        baseAccountApprovalRecorded: phase8WalletPromptOpening.walletApprovalRecorded,
        submissionIntent: {
          source: "private_dashboard",
          ownerClickedSubmit: Boolean(activePhase8OwnerArming),
          ownerUserId,
          workspaceId,
          agentId: selectedAgentId,
          frozenActionFreezeKey: phase8FrozenAction?.freezeKey ?? null,
          submissionNonce: activePhase8OwnerArming?.submissionNonce ?? null,
          submissionNonceUsed: false,
          requestedAt: activePhase8OwnerArming?.armedAt ?? null,
        },
        submissionState: phase8SubmitterResult
          ? phase8SubmitterResult.state
          : activePhase8OwnerArming
          ? "ready"
          : "not_submitted",
        resultEvents: phase8SubmitterResult ? [phase8SubmitterResult] : [],
        rollbackReady: true,
        emergencyDisableReady: true,
        postTransactionAuditReady: true,
        visibleInPublicProfile: false,
      });
    },
    [
      activePhase8OwnerArming,
      agentRecord?.id,
      authSession?.user.id,
      baseAccountConnectionStatus.chainId,
      dashboardData?.workspace.id,
      phase8FrozenAction,
      phase8SubmitterResult,
      phase8WalletPromptOpening,
    ],
  );
  const phase8OwnerLiveWindowActivation = useMemo(
    () => evaluatePhase8OwnerLiveWindowActivation({
      runtimeWindowEnabled:
        appConfig.integrations.phase8ControlledSubmission === "owner_approved_window",
      controlledSubmission: phase8ControlledSubmission,
      operatorAcknowledged: Boolean(activePhase8OwnerArming),
      rollbackReady: true,
      emergencyDisableReady: true,
      postTransactionAuditReady: true,
      ownerDashboardSource: true,
    }),
    [activePhase8OwnerArming, phase8ControlledSubmission],
  );
  const phase8RuntimeEnablementPreflight = useMemo(
    () => evaluatePhase8RuntimeEnablementPreflight({
      runtimeFlagEnabled:
        appConfig.integrations.phase8ControlledSubmission === "owner_approved_window",
      ownerSignedIn: Boolean(authSession),
      selectedAgent: Boolean(agentRecord),
      baseAccountConnected: baseAccountConnectionStatus.connected,
      controlledSubmission: phase8ControlledSubmission,
      liveWindowActivation: phase8OwnerLiveWindowActivation,
      resultCloseoutRecorded: phase8ControlledSubmission.resultCloseoutRecorded,
      privateDashboardSource: true,
      telegramCanAuthorize: false,
      visibleInPublicProfile: false,
    }),
    [
      agentRecord,
      authSession,
      baseAccountConnectionStatus.connected,
      phase8ControlledSubmission,
      phase8OwnerLiveWindowActivation,
    ],
  );
  const backendTables = dashboardData?.backendTables ?? [];
  const hasPublicRoute = Boolean(agentRecord?.publicPath);
  const latestDeployEvent = getLatestEvent(backendEvents, "deploy");
  const latestResetEvent = getLatestEvent(backendEvents, "reset");
  const latestRefreshEvent = getLatestEvent(backendEvents, "dashboard-refresh");
  const lastBackendIssue =
    backendEvents.find((event) =>
      event.status === "error" || event.status === "blocked"
    ) ?? null;
  const workspace = dashboardData?.workspace ??
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
      value: authSession || dashboardStatus === "connected"
        ? `${dashboardAgentCount}/${demoAgentLimits.maxAgentsPerWorkspace}`
        : `max ${demoAgentLimits.maxAgentsPerWorkspace}`,
      tone: dashboardAgentCount >= demoAgentLimits.maxAgentsPerWorkspace
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
      value: appConfig.integrations.walletExecution === "disabled"
        ? "simulated"
        : appConfig.integrations.walletExecution,
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
      state: deployFunctionStatus === "ready"
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
      detail:
        `Demo workspace is capped at ${demoAgentLimits.maxAgentsPerWorkspace} agents.`,
      state: "complete",
    },
    {
      label: "Receipt source",
      detail:
        "Successful deploy receipts should show Backend when persistence is ready.",
      state: getDeployChecklistState(deployFunctionStatus),
    },
  ];
  const isAdminActionRunning = adminActionStatus === "running";
  const canRunBaseMcpStatusCheck = Boolean(
    authSession &&
      agentRecord &&
      appConfig.functions.baseMcpPrepareConfigured &&
      baseMcpStatusState !== "checking",
  );

  const diagnosticRows = [
    {
      label: "Deploy function",
      value: getDeployFunctionHealthLabel(deployFunctionStatus),
      detail: deployFunctionMessage || "Waiting for health check.",
      tone: getDeployFunctionHealthTone(deployFunctionStatus),
    },
    {
      label: "Reset function",
      value: appConfig.functions.resetDemoWorkspaceConfigured
        ? "configured"
        : "not configured",
      detail: appConfig.functions.resetDemoWorkspaceConfigured
        ? "Admin reset requests use the backend endpoint."
        : "Reset endpoint URL is missing.",
      tone: appConfig.functions.resetDemoWorkspaceConfigured
        ? "ready"
        : "standby",
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
      detail: dashboardError ??
        `${dashboardAgentCount} persisted demo agent records loaded.`,
      tone: getDashboardReadinessTone(dashboardStatus),
    },
    {
      label: "Last refresh",
      value: formatDiagnosticTimestamp(lastDashboardRefreshAt),
      detail: latestRefreshEvent?.message ??
        "No dashboard refresh event recorded yet.",
      tone: getDiagnosticTone(latestRefreshEvent?.status ?? "standby"),
    },
    {
      label: "Last deploy",
      value: latestDeployEvent ? latestDeployEvent.status : "not recorded",
      detail: latestDeployEvent?.message ??
        "No deploy attempt recorded in this browser yet.",
      tone: getDiagnosticTone(latestDeployEvent?.status ?? "standby"),
    },
    {
      label: "Last reset",
      value: latestResetEvent ? latestResetEvent.status : "not recorded",
      detail: latestResetEvent?.message ??
        "No reset attempt recorded in this browser yet.",
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

  async function handleBaseMcpStatusCheck() {
    if (!authSession || !agentRecord || baseMcpStatusState === "checking") {
      return;
    }

    setBaseMcpStatusState("checking");
    setBaseMcpStatusCode(null);
    setBaseMcpStatusMessage("Checking owner session and Base MCP capability...");
    setBaseMcpPreparedSummary(null);

    const requestSequence = ++baseMcpRequestSequenceRef.current;
    const freshAuth = await ensureFreshAuthSession(authSession);

    if (requestSequence !== baseMcpRequestSequenceRef.current) {
      return;
    }

    syncFreshAuthSession(authSession, freshAuth);

    if (!freshAuth.session) {
      setBaseMcpStatusState("error");
      setBaseMcpStatusCode("unauthorized");
      setBaseMcpStatusMessage(freshAuth.message);
      return;
    }

    const result = await prepareBaseMcpStatusCheck({
      session: freshAuth.session,
      agentId: agentRecord.id,
      workspaceId: agentRecord.workspaceId,
    });

    if (requestSequence !== baseMcpRequestSequenceRef.current) {
      return;
    }

    setBaseMcpStatusCode(result.status);
    setBaseMcpStatusMessage(result.message);
    setBaseMcpPreparedSummary(result.summary);
    setBaseMcpStatusState(
      result.ok
        ? "ready"
        : result.status === "base_mcp_disabled" ||
            result.status === "base_mcp_not_configured" ||
            result.status === "base_mcp_rate_limited"
        ? "blocked"
        : "error",
    );
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
    setAdminActionMessage(
      result.ok
        ? "Reset succeeded. Refreshing dashboard records..."
        : result.message,
    );
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

  function handleSelectDashboardAgent(agentId: string) {
    const nextAgent = agentRecords.find((agent) => agent.id === agentId);

    if (nextAgent) {
      onSelectTemplate(nextAgent.templateId);
    }

    setSelectedDashboardAgentId(agentId);
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
            className={activeDashboardSectionId === "overview"
              ? "is-active"
              : undefined}
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
            className={activeDashboardSectionId === "auth"
              ? "is-active"
              : undefined}
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
            className={activeDashboardSectionId === "approvals"
              ? "is-active"
              : undefined}
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
            className={activeDashboardSectionId === "logs"
              ? "is-active"
              : undefined}
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
            className={activeDashboardSectionId === "modules"
              ? "is-active"
              : undefined}
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
            className={activeDashboardSectionId === "backend"
              ? "is-active"
              : undefined}
            href="/dashboard/backend"
            onClick={(event) => {
              event.preventDefault();
              openDashboardSection("backend");
            }}
          >
            <Server size={16} />
            Readiness
          </a>
          {isAdmin
            ? (
              <a
                className={activeDashboardSectionId === "admin-actions"
                  ? "is-active"
                  : undefined}
                href="/dashboard/admin-actions"
                onClick={(event) => {
                  event.preventDefault();
                  openDashboardSection("admin-actions");
                }}
              >
                <Trash2 size={16} />
                Admin
              </a>
            )
            : null}
        </nav>

        <button
          className="button button-ghost dashboard-back"
          type="button"
          onClick={onBackHome}
        >
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
          {agentRecord
            ? (
              <button
                className="button button-primary"
                type="button"
                onClick={() =>
                  onOpenAgent({
                    templateId: agentRecord.templateId,
                    publicPath: agentRecord.publicPath,
                  })}
              >
                Open Public Agent
                <ExternalLink size={16} />
              </button>
            )
            : (
              <button className="button button-primary" type="button" disabled>
                Public Agent Unavailable
                <ExternalLink size={16} />
              </button>
            )}
        </div>

        {agentRecords.length
          ? (
            <section
              className="dashboard-agent-selector"
              aria-label="Dashboard agent selector"
            >
              <div className="panel-title">
                <span>Selected agent</span>
                <span>
                  {agentRecords.length}/{demoAgentLimits.maxAgentsPerWorkspace}
                  {" "}
                  deployed
                </span>
              </div>
              <p>
                Choose which deployed agent powers the dashboard panels below.
                Telegram status, approvals, public route, and owner pairing
                follow the selected agent.
              </p>
              <div className="dashboard-agent-strip" role="list">
                {agentRecords.map((agent) => {
                  const template = agentTemplates.find((item) =>
                    item.id === agent.templateId
                  ) ??
                    selectedTemplate;
                  const selected = agent.id === agentRecord?.id;
                  const telegramSession = selectTelegramSessionForAgent(
                    dashboardData?.telegramSessions,
                    agent.id,
                  );
                  const telegramDashboardStatus =
                    selectTelegramDashboardStatusForAgent(
                      telegramDashboardStatuses,
                      agent.id,
                    );
                  const telegramStatus = telegramDashboardStatus ??
                    telegramSession;

                  return (
                    <button
                      className={`dashboard-agent-pill ${
                        selected ? "is-active" : ""
                      }`}
                      type="button"
                      key={agent.id}
                      onClick={() =>
                        handleSelectDashboardAgent(agent.id)}
                      aria-pressed={selected}
                      aria-label={`View ${agent.displayName} dashboard`}
                    >
                      <span>
                        <strong>{agent.displayName}</strong>
                        <small>{template.name}</small>
                      </span>
                      <span>
                        <small>{agent.handle}</small>
                        <em>
                          {getTelegramSessionLabel(
                            telegramStatus,
                            agent.telegramStatus,
                          )}
                        </em>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          )
          : null}

        <section className="dashboard-kpi-grid" id="overview">
          <article>
            <span>Template</span>
            <strong>{agentRecord ? activeTemplate.name : "None yet"}</strong>
            <small>
              {agentRecord ? activeTemplate.status : "deploy required"}
            </small>
          </article>
          <article>
            <span>Platform</span>
            <strong>{agentRecord ? "Telegram" : "Not connected"}</strong>
            <small>
              {agentRecord ? agentRecord.handle : "deploy creates handle"}
            </small>
          </article>
          <article>
            <span>Wallet</span>
            <strong>{walletReadiness.label}</strong>
            <small>{walletReadiness.addressLabel}</small>
          </article>
          <article>
            <span>Approval policy</span>
            <strong>{walletReadiness.approvalGate}</strong>
            <small>{walletReadiness.execution.toLowerCase()}</small>
          </article>
        </section>

        <div className="dashboard-content-grid">
          <section className="dashboard-panel agent-overview-panel">
            <div className="panel-title">
              <span>Agent overview</span>
              <span>{agentRecord ? agentRecord.id : "empty"}</span>
            </div>
            {agentRecord
              ? (
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
              )
              : (
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
              <span>
                {agentRecord
                  ? getTelegramSessionLabel(selectedTelegramStatus)
                  : "locked"}
              </span>
            </div>
            <div className="telegram-status-card">
              <span className="telegram-status-icon">
                <Bot size={18} />
              </span>
              <div>
                <small>
                  {selectedTelegramStatus?.botHandle ?? "Telegram status"}
                </small>
                <strong>
                  {getTelegramSessionHeadline(selectedTelegramStatus)}
                </strong>
                <p>{getTelegramSessionDescription(selectedTelegramStatus)}</p>
              </div>
            </div>
            {authSession && agentRecord
              ? (
                <>
                  <div className="telegram-connect-gate">
                    <div className="telegram-status-readout">
                      <span>
                        <small>Bot session</small>
                        <strong>
                          {getTelegramSessionLabel(selectedTelegramStatus)}
                        </strong>
                      </span>
                      <span>
                        <small>Owner chat</small>
                        <strong>
                          {getTelegramOwnerPairingLabel(
                            selectedTelegramActive,
                            selectedTelegramOwnerChatLinked,
                          )}
                        </strong>
                      </span>
                      <span>
                        <small>Command access</small>
                        <strong>
                          {getTelegramCommandAccessLabel(
                            selectedTelegramActive,
                            selectedTelegramOwnerChatLinked,
                          )}
                        </strong>
                      </span>
                    </div>
                    <p className="telegram-connect-message telegram-connect-idle">
                      Dashboard is status-only. BotFather token validation,
                      backend token storage, webhook activation, and owner
                      pairing happen during deploy or an owner-approved backend
                      flow.
                    </p>
                    {telegramDashboardStatusEnabled &&
                        telegramDashboardStatusState !== "ready"
                      ? (
                        <p className="telegram-connect-message telegram-connect-idle">
                          {telegramDashboardStatusMessage}
                        </p>
                      )
                      : null}
                  </div>
                </>
              )
              : (
                <div className="telegram-status-actions">
                  <button
                    className="button button-ghost"
                    type="button"
                    disabled
                  >
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
              {visibleRequests.length
                ? (
                  visibleRequests.map((item) => (
                    <article
                      className={`queue-item queue-${getQueueTone(item)}`}
                      key={item.id}
                    >
                      <span className="queue-icon">
                        {getQueueTone(item) === "pending"
                          ? <Clock3 size={16} />
                          : <ShieldCheck size={16} />}
                      </span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.command}</small>
                      </div>
                      <em>{formatQueueStatus(item.status)}</em>
                    </article>
                  ))
                )
                : (
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
              <span>{walletReadiness.state.replace(/_/g, " ")}</span>
            </div>
            <BaseAccountConnectionPanel
              session={authSession}
              workspaceId={agentRecord?.workspaceId ?? null}
              agentId={agentRecord?.id ?? null}
              agentName={agentRecord?.displayName ?? null}
              onConnectionStateChange={setBaseAccountConnectionStatus}
              onSessionChange={onAuthSessionChange}
            />
            <div
              className={`wallet-signing-boundary ${
                walletPromptEligibility.eligible ? "is-ready" : "is-blocked"
              }`}
            >
              <div className="wallet-signing-boundary-header">
                <span className="queue-icon">
                  <ShieldCheck size={16} />
                </span>
                <div>
                  <small>Phase 7E signing boundary</small>
                  <strong>
                    {walletPromptEligibility.eligible
                      ? "Prompt eligible"
                      : "Prompt locked"}
                  </strong>
                </div>
                <span>
                  {appConfig.integrations.walletExecution === "disabled"
                    ? "execution disabled"
                    : "review required"}
                </span>
              </div>
              <p>{walletPromptEligibility.message}</p>
              <div className="wallet-signing-boundary-grid">
                <span>
                  Source
                  <strong>Owner dashboard click</strong>
                </span>
                <span>
                  Connection
                  <strong>
                    {baseAccountConnectionStatus.connected
                      ? "Base Account ready"
                      : "Required"}
                  </strong>
                </span>
                <span>
                  Prepared action
                  <strong>Reviewed only</strong>
                </span>
                <span>
                  Telegram
                  <strong>Blocked</strong>
                </span>
              </div>
              <ul>
                {walletPromptEligibility.reasons.slice(0, 4).map((reason) => (
                  <li key={reason}>{getWalletPromptBlockMessage(reason)}</li>
                ))}
              </ul>
            </div>
            <div
              className={`wallet-readiness-card readiness-${walletReadinessTone}`}
            >
              <div className="wallet-readiness-header">
                <span className="queue-icon">
                  <WalletCards size={16} />
                </span>
                <div>
                  <small>Owner wallet readiness</small>
                  <strong>{walletReadiness.label}</strong>
                </div>
              </div>
              <div className="wallet-readiness-grid">
                <span>
                  Address
                  <strong>{walletReadiness.addressLabel}</strong>
                </span>
                <span>
                  Network
                  <strong>{walletReadiness.network}</strong>
                </span>
                <span>
                  Approval
                  <strong>{walletReadiness.approvalGate}</strong>
                </span>
                <span>
                  Execution
                  <strong>{walletReadiness.execution}</strong>
                </span>
              </div>
              <p>{walletReadiness.nextAction}</p>
              <small>{walletReadiness.privacyNote}</small>
            </div>
            <div className="wallet-policy-list">
              <article>
                <span>Provider stack</span>
                <strong>{walletProviderStatus.providerStack}</strong>
                <small>
                  {walletProviderStatus.dependencyStatus}: runtime gate{" "}
                  {walletProviderStatus.runtimeGate}
                </small>
              </article>
              <article>
                <span>Prompt access</span>
                <strong>
                  {walletProviderStatus.promptAccess.replace(/_/g, " ")}
                </strong>
                <small>{walletProviderStatus.safetyNote}</small>
              </article>
              <article>
                <span>Connector priority</span>
                <strong>
                  {walletProviderStatus.connectorPriority.join(" -> ")}
                </strong>
                <small>
                  No automatic wallet prompt or Telegram-triggered signing.
                </small>
              </article>
            </div>
            <div className="wallet-policy-list">
              {walletPolicies.length
                ? (
                  walletPolicies.map((policy) => (
                    <article key={policy.id}>
                      <span>{policy.label}</span>
                      <strong>{policy.value}</strong>
                      <small>{policy.status}: {policy.description}</small>
                    </article>
                  ))
                )
                : (
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

          {isAdmin
            ? (
              <section
                className="dashboard-panel admin-actions-panel"
                id="admin-actions"
              >
                <div className="panel-title">
                  <span>Admin actions</span>
                  <span>{authSession ? "workspace owner" : "locked"}</span>
                </div>
                <p className="admin-actions-copy">
                  Reset the signed-in demo workspace when quota testing needs a
                  clean slate.
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
                    <strong>
                      {authSession
                        ? "Signed-in demo workspace"
                        : "Account session required"}
                    </strong>
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
                    disabled={!authSession || isAdminActionRunning ||
                      dashboardStatus === "loading"}
                  >
                    <RotateCcw size={16} />
                    Refresh records
                  </button>
                </div>
                <div
                  className={`admin-action-note admin-action-${adminActionStatus}`}
                >
                  <ShieldCheck size={15} />
                  <span>{adminActionMessage}</span>
                </div>
                {authSession
                  ? (
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
                            Runtime:{" "}
                            <strong>
                              {formatRuntimeValue(appConfig.mode)}
                            </strong>
                          </p>
                          <p>
                            Function health:{" "}
                            <strong>
                              {deployFunctionMessage || "checking"}
                            </strong>
                          </p>
                        </div>
                        <div className="diagnostic-status-grid">
                          {diagnosticRows.map((row) => (
                            <article
                              className={`diagnostic-status-card diagnostic-${row.tone}`}
                              key={row.label}
                            >
                              <span>{row.label}</span>
                              <strong>{formatRuntimeValue(row.value)}</strong>
                              <small>{row.detail}</small>
                            </article>
                          ))}
                        </div>
                        {lastBackendIssue
                          ? (
                            <p className="readiness-error-note">
                              Last backend issue: {lastBackendIssue.message}
                            </p>
                          )
                          : null}
                        {templateCatalogError
                          ? (
                            <p className="readiness-error-note">
                              Supabase catalog query failed:{" "}
                              {templateCatalogError}
                            </p>
                          )
                          : null}
                        {dashboardError
                          ? (
                            <p className="readiness-error-note">
                              Supabase dashboard query: {dashboardError}
                            </p>
                          )
                          : null}
                        <div
                          className="deploy-readiness-checklist"
                          aria-label="Deploy agent diagnostics checklist"
                        >
                          <div className="deploy-checklist-title">
                            <span>deploy-agent checklist</span>
                            <strong>
                              {getDeployFunctionHealthLabel(
                                deployFunctionStatus,
                              )}
                            </strong>
                          </div>
                          <div className="deploy-checklist-grid">
                            {deployChecklist.map((item) => {
                              const StatusIcon = item.state === "complete"
                                ? CheckCircle2
                                : item.state === "blocked"
                                ? LockKeyhole
                                : Clock3;

                              return (
                                <article
                                  className={`deploy-check-item deploy-check-${item.state}`}
                                  key={item.label}
                                >
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
                          {backendTables.length
                            ? (
                              backendTables.map((table) => (
                                <article key={table.name}>
                                  <span>{table.name}</span>
                                  <strong>{table.records} records</strong>
                                  <small>{table.purpose}</small>
                                </article>
                              ))
                            )
                            : (
                              <div className="dashboard-empty-state compact">
                                <Database size={18} />
                                <strong>No backend records yet.</strong>
                                <p>
                                  A fresh account session stays clean until the
                                  next demo deploy.
                                </p>
                              </div>
                            )}
                        </div>
                        <div className="backend-contract-line">
                          <span>
                            {supabaseStatus.tables.length}{" "}
                            Supabase tables mapped
                          </span>
                          <span>{agentTemplates.length} templates loaded</span>
                          <span>
                            {dashboardAgentCount
                              ? `${dashboardAgentCount} persisted demo agents`
                              : "no persisted demo agents"}
                          </span>
                          <span>
                            max {demoAgentLimits.maxAgentsPerWorkspace}{" "}
                            demo agents
                          </span>
                          <span>
                            deploy-agent{" "}
                            {getDeployFunctionHealthLabel(deployFunctionStatus)}
                          </span>
                          <span>onchain execution disabled</span>
                        </div>
                      </div>
                    </details>
                  )
                  : null}
              </section>
            )
            : null}

          <section
            className="dashboard-panel backend-readiness-panel"
            id="backend"
          >
            <div className="panel-title">
              <span>Demo readiness</span>
              <span>{authSession ? "account connected" : "preview mode"}</span>
            </div>
            <div className="readiness-summary">
              <span
                className={`readiness-chip readiness-${
                  getDashboardReadinessTone(dashboardStatus)
                }`}
              >
                <ShieldCheck size={14} />
                {dashboardStatus === "connected"
                  ? "Demo persistence active"
                  : "demo safe"}
              </span>
              <p>{kyraRepositoryRuntime.note}</p>
            </div>
            <div className="readiness-grid">
              {readinessRows.map((item) => {
                const Icon = item.icon;

                return (
                  <article
                    className={`readiness-item readiness-${item.tone}`}
                    key={item.label}
                  >
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
              <span>
                max {demoAgentLimits.maxAgentsPerWorkspace} demo agents
              </span>
              <span>approval-first workflows</span>
              <span>onchain execution disabled</span>
            </div>
          </section>

          <section className="dashboard-panel prepared-action-panel">
            <div className="panel-title">
              <span>Base MCP prep</span>
              <span>{preparedActionPreview.status.replace(/_/g, " ")}</span>
            </div>
            <div className="base-mcp-boundary-banner">
              <ShieldCheck size={16} />
              <span>
                Official Base MCP wallet authority is blocked until provider
                metadata, least-privilege scope, tool mapping, and approval
                behavior are verified.
              </span>
            </div>
            <div className="prepared-action-allowlist-grid">
              <article>
                <small>PreparedAction Allowlist</small>
                <strong>
                  {preparedActionAllowlistReview.allowed
                    ? "review schema ready"
                    : "execution locked"}
                </strong>
              </article>
              <article>
                <small>Source</small>
                <strong>owner dashboard</strong>
              </article>
              <article>
                <small>Allowed kinds</small>
                <strong>status check, reviewed transaction</strong>
              </article>
              <article>
                <small>Token spend</small>
                <strong>blocked in 7F</strong>
              </article>
              <article>
                <small>Calldata</small>
                <strong>blocked in 7F</strong>
              </article>
              <article>
                <small>Untrusted input</small>
                <strong>Telegram, LLM, provider blocked</strong>
              </article>
            </div>
            <div className="prepared-action-policy-panel">
              <div className="prepared-action-policy-header">
                <span>Phase 7G policy enforcement</span>
                <strong>{preparedActionPolicyReview.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="prepared-action-policy-grid">
                <span>
                  Storage
                  <strong>
                    {preparedActionPolicyReview.allowedForStorage
                      ? "owner scoped"
                      : "disabled"}
                  </strong>
                </span>
                <span>
                  Risk
                  <strong>
                    {preparedActionPolicyReview.riskReview?.level ?? "blocked"}
                  </strong>
                </span>
                <span>
                  Owner approval
                  <strong>
                    {preparedActionPolicyReview.reasons.includes(
                        "owner_approval_required",
                      )
                      ? "required"
                      : "recorded"}
                  </strong>
                </span>
                <span>
                  Replay
                  <strong>request id scoped</strong>
                </span>
              </div>
              <p>{preparedActionPolicyReview.message}</p>
              {preparedActionPolicyReview.reasons.length
                ? (
                  <small>
                    Blocked by: {preparedActionPolicyReview.reasons.join(", ")}
                  </small>
                )
                : (
                  <small>
                    Policy review passed. Wallet prompt remains separately
                    gated.
                  </small>
                )}
            </div>
            <div className="dual-approval-panel">
              <div className="dual-approval-header">
                <span>Phase 7H dual approval</span>
                <strong>{dualApprovalReview.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="dual-approval-steps">
                <span>
                  Kyra approval
                  <strong>
                    {dualApprovalReview.reasons.includes(
                        "owner_approval_required",
                      )
                      ? "required"
                      : "recorded"}
                  </strong>
                </span>
                <span>
                  Frozen action
                  <strong>
                    {dualApprovalReview.frozenAction ? "locked" : "not issued"}
                  </strong>
                </span>
                <span>
                  Base Account
                  <strong>
                    {baseAccountConnectionStatus.connected
                      ? "connected"
                      : "required"}
                  </strong>
                </span>
                <span>
                  Wallet prompt
                  <strong>
                    {dualApprovalReview.walletPromptAllowed
                      ? "eligible"
                      : "locked"}
                  </strong>
                </span>
              </div>
              <p>{dualApprovalReview.message}</p>
              <small>
                Transaction submission:{" "}
                {dualApprovalReview.transactionSubmissionAllowed
                  ? "allowed"
                  : "disabled"}{" "}
                - execution gate remains closed
              </small>
            </div>
            <div
              className={`prepared-action-card readiness-${preparedActionTone}`}
            >
              <div className="prepared-action-header">
                <span className="queue-icon">
                  <Server size={16} />
                </span>
                <div>
                  <small>
                    {preparedActionPreview.actionKind.replace(/_/g, " ")}
                  </small>
                  <strong>{preparedActionPreview.title}</strong>
                </div>
              </div>
              <div className="prepared-action-grid">
                <span>
                  Chain
                  <strong>{preparedActionPreview.chain}</strong>
                </span>
                <span>
                  Risk
                  <strong>{preparedActionPreview.risk}</strong>
                </span>
                <span>
                  Value
                  <strong>{preparedActionPreview.valueSummary}</strong>
                </span>
                <span>
                  Expiry
                  <strong>{preparedActionPreview.expiresLabel}</strong>
                </span>
              </div>
              <p>{preparedActionPreview.routeSummary}</p>
              <small>{preparedActionPreview.approvalRequirement}</small>
              <small>{preparedActionPreview.safetyNote}</small>
              <div className="base-mcp-status-controls">
                <button
                  className="button button-ghost"
                  disabled={!canRunBaseMcpStatusCheck}
                  onClick={handleBaseMcpStatusCheck}
                  type="button"
                >
                  <Server size={16} />
                  {baseMcpStatusState === "checking"
                    ? "Checking status"
                    : "Check Base MCP status"}
                </button>
                <span className={`base-mcp-status-note status-${baseMcpStatusState}`}>
                  <strong>
                    {baseMcpStatusCode
                      ? formatRuntimeValue(baseMcpStatusCode)
                      : "owner-only read-only"}
                  </strong>
                  <small>{baseMcpStatusMessage}</small>
                </span>
              </div>
            </div>
          </section>

          <section className="dashboard-panel execution-result-panel">
            <div className="panel-title">
              <span>Execution audit trail</span>
              <span>owner-only</span>
            </div>
            <div className="controlled-live-gate-panel">
              <div className="controlled-live-gate-header">
                <span>Phase 7J controlled live gate</span>
                <strong>
                  {controlledLiveTransactionGate.status.replace(/_/g, " ")}
                </strong>
              </div>
              <div className="controlled-live-gate-grid">
                <span>
                  Owner scope
                  <strong>{controlledLiveTransactionGate.ownerOnly ? "owner-only" : "blocked"}</strong>
                </span>
                <span>
                  Live window
                  <strong>
                    {controlledLiveTransactionGate.liveWindowApproved
                      ? "approved"
                      : "not approved"}
                  </strong>
                </span>
                <span>
                  Wallet prompt
                  <strong>
                    {controlledLiveTransactionGate.walletPromptAllowed
                      ? "allowed"
                      : "locked"}
                  </strong>
                </span>
                <span>
                  Submission
                  <strong>
                    {controlledLiveTransactionGate.transactionSubmissionAllowed
                      ? "allowed"
                      : "locked"}
                  </strong>
                </span>
              </div>
              <p>{controlledLiveTransactionGate.message}</p>
              {controlledLiveTransactionGate.reasons.length
                ? (
                  <small>
                    Blocked by: {controlledLiveTransactionGate.reasons.join(", ")}
                  </small>
                )
                : (
                  <small>
                    Gate is ready for explicit live-window approval only. Phase
                    7J still keeps wallet prompt, signing, and submission
                    locked.
                  </small>
                )}
            </div>
            <div className="execution-launch-panel">
              <div className="execution-launch-header">
                <span>Execution launch packet</span>
                <strong>{executionLaunchReadiness.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="execution-launch-grid">
                <span>
                  Primary lane
                  <strong>
                    {executionLaunchReadiness.baseAccountPrimaryLane
                      ? "Base Account"
                      : "blocked"}
                  </strong>
                </span>
                <span>
                  Official MCP
                  <strong>
                    {executionLaunchReadiness.officialMcpRequired
                      ? "required"
                      : "optional disabled"}
                  </strong>
                </span>
                <span>
                  Wallet prompt
                  <strong>
                    {executionLaunchReadiness.walletPromptAllowed
                      ? "allowed"
                      : "disabled"}
                  </strong>
                </span>
                <span>
                  Submission
                  <strong>
                    {executionLaunchReadiness.transactionSubmissionAllowed
                      ? "allowed"
                      : "disabled"}
                  </strong>
                </span>
              </div>
              <p>{executionLaunchReadiness.message}</p>
              {executionLaunchReadiness.reasons.length
                ? (
                  <small>
                    Blocked by: {executionLaunchReadiness.reasons.join(", ")}
                  </small>
                )
                : (
                  <small>
                    Owner review can be prepared. Runtime wallet prompt,
                    signing, and submission still require a separate enablement
                    window.
                  </small>
                )}
            </div>
            <div className="phase-8-execution-panel">
              <div className="phase-8-execution-header">
                <span>Phase 8 controlled execution</span>
                <strong>{phase8ControlledExecution.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-8-execution-grid">
                <span>
                  Runtime
                  <strong>
                    {String(appConfig.integrations.walletExecution) === "enabled"
                      ? "enabled"
                      : "default-off"}
                  </strong>
                </span>
                <span>
                  Wallet prompt
                  <strong>
                    {phase8ControlledExecution.walletPromptAllowed
                      ? "ready for wallet prompt"
                      : "locked"}
                  </strong>
                </span>
                <span>
                  Submission
                  <strong>
                    {phase8ControlledExecution.transactionSubmissionAllowed
                      ? "allowed"
                      : "locked"}
                  </strong>
                </span>
                <span>
                  Scope
                  <strong>
                    {phase8ControlledExecution.ownerOnly
                      ? "owner-only"
                      : "blocked"}
                  </strong>
                </span>
              </div>
              <p>{phase8ControlledExecution.message}</p>
              {phase8ControlledExecution.reasons.length
                ? (
                  <small>
                    Blocked by: {phase8ControlledExecution.reasons.join(", ")}
                  </small>
                )
                : (
                  <small>
                    Ready for wallet prompt only after an explicit owner live
                    window. Telegram and public profiles still cannot execute.
                  </small>
                )}
            </div>
            <div className="phase-8-live-window-panel">
              <div className="phase-8-live-window-header">
                <span>Phase 8 live window</span>
                <strong>{phase8LiveWindowPreparation.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-8-live-window-grid">
                <span>
                  owner-approved window
                  <strong>
                    {phase8LiveWindowPreparation.reasons.includes(
                        "live_window_approval_required",
                      )
                      ? "required"
                      : "ready"}
                  </strong>
                </span>
                <span>
                  private dashboard intent
                  <strong>
                    {phase8LiveWindowPreparation.reasons.includes(
                        "owner_click_required",
                      )
                      ? "click required"
                      : "recorded"}
                  </strong>
                </span>
                <span>
                  Frozen binding
                  <strong>
                    {phase8LiveWindowPreparation.reasons.some((reason) =>
                        reason.startsWith("frozen_action"),
                      )
                      ? "locked"
                      : "matched"}
                  </strong>
                </span>
                <span>
                  prompt readiness
                  <strong>
                    {phase8LiveWindowPreparation.walletPromptAllowed
                      ? "ready"
                      : "blocked"}
                  </strong>
                </span>
              </div>
              <p>{phase8LiveWindowPreparation.message}</p>
              {phase8LiveWindowPreparation.reasons.length
                ? (
                  <small>
                    Blocked by: {phase8LiveWindowPreparation.reasons.join(", ")}
                  </small>
                )
                : (
                  <small>
                    owner-approved window, private dashboard intent, frozen
                    action binding, and Base Account prompt readiness are ready.
                    Transaction submission remains disabled in Batch 2.
                  </small>
                )}
            </div>
            <div className="phase-8-wallet-prompt-panel">
              <div className="phase-8-wallet-prompt-header">
                <span>Phase 8 wallet prompt opening</span>
                <strong>{phase8WalletPromptOpening.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-8-wallet-prompt-grid">
                <span>
                  one-time nonce
                  <strong>
                    {phase8WalletPromptOpening.reasons.includes(
                        "one_time_prompt_nonce_required",
                      )
                      ? "required"
                      : "bound"}
                  </strong>
                </span>
                <span>
                  owner-only audit
                  <strong>
                    {phase8WalletPromptOpening.reasons.includes(
                        "owner_only_audit_required",
                      )
                      ? "required"
                      : "ready"}
                  </strong>
                </span>
                <span>
                  open allowed
                  <strong>
                    {phase8WalletPromptOpening.walletPromptOpenAllowed
                      ? "allowed"
                      : "locked"}
                  </strong>
                </span>
                <span>
                  Submission
                  <strong>
                    {phase8WalletPromptOpening.transactionSubmissionAllowed
                      ? "allowed"
                      : "disabled"}
                  </strong>
                </span>
              </div>
              <p>{phase8WalletPromptOpening.message}</p>
              {phase8WalletPromptOpening.reasons.length
                ? (
                  <small>
                    Blocked by: {phase8WalletPromptOpening.reasons.join(", ")}
                  </small>
                )
                : (
                  <small>
                    One owner-click Base Account prompt can open under
                    owner-only audit. Transaction submission remains disabled in
                    Batch 3.
                  </small>
                )}
            </div>
            <div className="phase-8-submission-panel">
              <div className="phase-8-submission-header">
                <span>Phase 8 controlled submission</span>
                <strong>{phase8ControlledSubmission.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-8-submission-grid">
                <span>
                  submission nonce
                  <strong>
                    {phase8ControlledSubmission.reasons.includes(
                        "submission_nonce_required",
                      )
                      ? "required"
                      : "bound"}
                  </strong>
                </span>
                <span>
                  Base approval
                  <strong>
                    {phase8ControlledSubmission.reasons.includes(
                        "base_account_approval_required",
                      )
                      ? "required"
                      : "recorded"}
                  </strong>
                </span>
                <span>
                  submit allowed
                  <strong>
                    {phase8ControlledSubmission.transactionSubmissionAllowed
                      ? "owner-only"
                      : "locked"}
                  </strong>
                </span>
                <span>
                  result closeout
                  <strong>
                    {phase8ControlledSubmission.resultCloseoutRecorded
                      ? "recorded"
                      : "pending"}
                  </strong>
                </span>
              </div>
              <p>{phase8ControlledSubmission.message}</p>
              {phase8ControlledSubmission.reasons.length
                ? (
                  <small>
                    Blocked by: {phase8ControlledSubmission.reasons.join(", ")}
                  </small>
                )
                : (
                  <small>
                    One owner-controlled Base submission can proceed only from
                    the private dashboard. Telegram, public profiles, token
                    approvals, swaps, calldata, and non-zero value remain
                    blocked.
                  </small>
                )}
            </div>
            <div className="phase-8-live-window-activation-panel">
              <div className="phase-8-live-window-activation-header">
                <span>Phase 8 live-window activation</span>
                <strong>{phase8OwnerLiveWindowActivation.status}</strong>
              </div>
              <div className="phase-8-live-window-activation-grid">
                <span>
                  Runtime window
                  <strong>
                    {phase8OwnerLiveWindowActivation.reasons.includes("runtime_window_disabled")
                      ? "disabled"
                      : "enabled"}
                  </strong>
                </span>
                <span>
                  Operator ack
                  <strong>
                    {phase8OwnerLiveWindowActivation.reasons.includes("operator_ack_required")
                      ? "required"
                      : "recorded"}
                  </strong>
                </span>
                <span>
                  Rollback
                  <strong>
                    {phase8OwnerLiveWindowActivation.reasons.includes("rollback_required")
                      ? "required"
                      : "ready"}
                  </strong>
                </span>
                <span>
                  Submitter
                  <strong>
                    {phase8OwnerLiveWindowActivation.transactionSubmissionAllowed
                      ? "armed"
                      : "locked"}
                  </strong>
                </span>
              </div>
              <p>{phase8OwnerLiveWindowActivation.message}</p>
              <div className="phase-8-owner-candidate-panel">
                <span>
                  Candidate
                  <strong>{phase8OwnerActionCandidate.ok ? "owner self-check" : "locked"}</strong>
                </span>
                <span>
                  Recipient
                  <strong>
                    {phase8OwnerActionCandidate.ok
                      ? maskBaseAccountAddress(phase8OwnerActionCandidate.candidate.recipient)
                      : "Base Account required"}
                  </strong>
                </span>
                <span>
                  Value
                  <strong>{phase8OwnerActionCandidate.ok ? "0 ETH" : "blocked"}</strong>
                </span>
                <span>
                  Calldata
                  <strong>{phase8OwnerActionCandidate.ok ? "none" : "blocked"}</strong>
                </span>
              </div>
              <small>{phase8OwnerActionCandidate.message}</small>
              {!phase8OwnerActionCandidate.ok && phase8OwnerActionCandidate.reasons.length
                ? <small>Candidate blocked by: {phase8OwnerActionCandidate.reasons.join(", ")}</small>
                : null}
              <div className="phase-8-live-window-activation-actions">
                <button
                  className="button button-primary"
                  disabled={!phase8FrozenAction || !authSession || !agentRecord}
                  onClick={armPhase8OwnerLiveWindow}
                  type="button"
                >
                  <ShieldCheck size={16} />
                  Arm owner live window
                </button>
                <button
                  className="button button-ghost"
                  disabled={!phase8OwnerArming}
                  onClick={resetPhase8OwnerLiveWindow}
                  type="button"
                >
                  <RotateCcw size={16} />
                  Reset window
                </button>
              </div>
              <small>
                {activePhase8OwnerArming
                  ? `Armed at ${new Date(activePhase8OwnerArming.armedAt).toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                    hour12: false,
                  })}. Browser session only.`
                  : "Not armed. Owner must acknowledge the selected agent and frozen action first."}
              </small>
              {phase8OwnerLiveWindowActivation.reasons.length
                ? (
                  <small>
                    Blocked by: {phase8OwnerLiveWindowActivation.reasons.join(", ")}
                  </small>
                )
                : (
                  <small>
                    One owner-controlled submitter window is armed. Telegram, public
                    profiles, automation, token approvals, swaps, calldata, and
                    non-zero value remain blocked.
                  </small>
                )}
            </div>
            <div className="phase-8-submission-panel">
              <div className="phase-8-submission-header">
                <span>Phase 8 runtime enablement preflight</span>
                <strong>{phase8RuntimeEnablementPreflight.status}</strong>
              </div>
              <div className="phase-8-submission-grid">
                <span>
                  runtime flag
                  <strong>
                    {appConfig.integrations.phase8ControlledSubmission === "owner_approved_window"
                      ? "enabled"
                      : "disabled"}
                  </strong>
                </span>
                <span>
                  Base Account
                  <strong>{baseAccountConnectionStatus.connected ? "connected" : "required"}</strong>
                </span>
                <span>
                  owner window
                  <strong>{phase8OwnerLiveWindowActivation.transactionSubmissionAllowed ? "armed" : "locked"}</strong>
                </span>
                <span>
                  runtime submitter
                  <strong>
                    {phase8RuntimeEnablementPreflight.runtimeSubmitterEnabled
                      ? "enabled"
                      : "locked"}
                  </strong>
                </span>
              </div>
              <p>{phase8RuntimeEnablementPreflight.message}</p>
              {phase8RuntimeEnablementPreflight.reasons.length
                ? (
                  <small>
                    Blocked by: {phase8RuntimeEnablementPreflight.reasons.join(", ")}
                  </small>
                )
                : (
                  <small>
                    Runtime is open only for the private owner dashboard, selected agent,
                    connected Base Account, and one owner-controlled zero-value submit.
                    Telegram and public profiles remain blocked.
                  </small>
                )}
            </div>
            <Phase8ControlledSubmitter
              submission={phase8ControlledSubmission}
              activation={phase8OwnerLiveWindowActivation}
              preflight={phase8RuntimeEnablementPreflight}
              baseAccountAddress={baseAccountConnectionStatus.address}
              submissionNonce={activePhase8OwnerArming?.submissionNonce ?? null}
              frozenAction={phase8FrozenAction}
              onResultCloseout={setPhase8SubmitterResult}
            />
            <div className="result-monitoring-panel">
              <div className="result-monitoring-header">
                <span>Phase 7I result monitoring</span>
                <strong>{resultMonitoringCloseout.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="result-monitoring-grid">
                <span>
                  Scope
                  <strong>{resultMonitoringCloseout.ownerOnly ? "owner-only" : "blocked"}</strong>
                </span>
                <span>
                  Tx hash
                  <strong>
                    {resultMonitoringCloseout.txHash
                      ? "provider submitted"
                      : "not persisted"}
                  </strong>
                </span>
                <span>
                  Disconnect
                  <strong>
                    {resultMonitoringCloseout.disconnectAllowed
                      ? "allowed"
                      : "locked"}
                  </strong>
                </span>
                <span>
                  Emergency
                  <strong>
                    {resultMonitoringCloseout.emergencyDisabled
                      ? "disabled"
                      : "ready"}
                  </strong>
                </span>
              </div>
              <p>{resultMonitoringCloseout.message}</p>
              {resultMonitoringCloseout.reasons.length
                ? (
                  <small>
                    Blocked by: {resultMonitoringCloseout.reasons.join(", ")}
                  </small>
                )
                : (
                  <small>
                    Result closeout is sanitized. No public result data, wallet
                    prompt, signing, or submission is enabled here.
                  </small>
                )}
            </div>
            <div className="execution-result-list">
              {executionResults.map((result) => (
                <article
                  className={`execution-result-card readiness-${
                    getExecutionResultTone(result.status)
                  }`}
                  key={result.id}
                >
                  <div className="execution-result-header">
                    <span className="queue-icon">
                      <Activity size={16} />
                    </span>
                    <div>
                      <small>{result.status.replace(/_/g, " ")}</small>
                      <strong>{result.label}</strong>
                    </div>
                    <time>{result.updatedAt}</time>
                  </div>
                  <p>{result.summary}</p>
                  <div className="execution-result-grid">
                    <span>
                      Tx hash
                      <strong>{result.txHashLabel}</strong>
                    </span>
                    <span>
                      Visibility
                      <strong>{result.visibility.replace(/-/g, " ")}</strong>
                    </span>
                  </div>
                  {result.failureReason
                    ? <small>{result.failureReason}</small>
                    : null}
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-panel" id="logs">
            <div className="panel-title">
              <span>Activity log</span>
              <span>demo replay</span>
            </div>
            <div className="dashboard-log-box">
              {activityLines.map((log) => <p key={log}>{log}</p>)}
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
                  className={template.id === activeTemplate.id
                    ? "is-active"
                    : ""}
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

      {resetConfirmOpen && isAdmin
        ? (
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
                This deletes only the signed-in demo workspace records for this
                account. It does not touch global data, real funds, wallet keys,
                private keys, Telegram tokens, or any onchain transactions.
              </p>
              <div className="reset-scope-grid">
                <span>
                  Scope
                  <strong>Signed-in demo workspace</strong>
                </span>
                <span>
                  Agent quota
                  <strong>
                    {dashboardAgentCount}/{demoAgentLimits
                      .maxAgentsPerWorkspace}
                  </strong>
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
                After reset, the dashboard should show a clean empty state until
                a new demo agent is deployed.
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
        )
        : null}
    </main>
  );
}
