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
import { useBalance, useWaitForTransactionReceipt } from "wagmi";
import { AuthSessionPanel } from "../components/AuthSessionPanel";
import {
  OwnerWalletConnectionPanel,
  type OwnerWalletConnectionStatus,
} from "../components/OwnerWalletConnectionPanel";
import { Phase8ControlledSubmitter } from "../components/Phase8ControlledSubmitter";
import { Phase8LowValueSubmitter } from "../components/Phase8LowValueSubmitter";
import type { AgentTemplate } from "../types/agent";
import { appConfig } from "../config/appConfig";
import {
  currentGasDisplayName,
  currentProductChain,
  currentWalletDisplayName,
} from "../config/productChains";
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
import {
  prepareChainActionStatusCheck,
  type ChainActionDashboardStatus,
  type ChainActionPreparedSummary,
} from "../services/chainActionPrepareService";
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
import { evaluatePhase8SmokeCloseout } from "../types/phase8SmokeCloseout";
import { evaluatePhase8TransactionVerification } from "../types/phase8TransactionVerification";
import { evaluateRobinhoodTestnetCloseout } from "../types/robinhoodTestnetCloseout";
import { evaluatePhase8SecurityAbuseHardening } from "../types/phase8SecurityAbuseHardening";
import { evaluatePhase8ProductionCloseout } from "../types/phase8ProductionCloseout";
import { evaluatePhase9ExecutionEligibility } from "../types/phase9ExecutionEligibility";
import { evaluatePhase9AbuseRateLimit } from "../types/phase9AbuseRateLimit";
import { evaluatePhase9IncidentControls } from "../types/phase9IncidentControls";
import { evaluatePhase9MonitoringSupport } from "../types/phase9MonitoringSupport";
import { evaluatePhase9PublicPrivacyRelease } from "../types/phase9PublicPrivacyRelease";
import { evaluatePhase9Closeout } from "../types/phase9Closeout";
import { evaluatePhase8UserExecutionFlow } from "../types/phase8UserExecutionFlow";
import { evaluatePhase8UserSafeTransactionPolicy } from "../types/phase8UserSafeTransactionPolicy";
import { formatPhase8BaseEth } from "../types/phase8FundingReadiness";
import { evaluatePhase8LowValueTransactionReadiness } from "../types/phase8LowValueTransactionReadiness";
import { createPhase8LowValueSubmitRequest } from "../types/phase8LowValueSubmitRequest";
import {
  createPhase8PersistedExecutionResult,
  getPhase8ResultPersistenceFailureMessage,
  mapPhase8PersistedResultToDemoExecutionResult,
  reconcilePhase8PersistedExecutionResult,
  type Phase8PersistedExecutionResult,
} from "../types/phase8ResultPersistence";
import {
  loadPhase8PersistedExecutionResults,
  savePhase8PersistedExecutionResult,
} from "../services/phase8ResultPersistenceStore";
import { baseChainId } from "../types/unsignedTransactionHandoff";
import { maskOwnerWalletAddress } from "../types/ownerWalletConnection";
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
import { isTransactionHash } from "../types/walletSigning";

type DashboardPrepareStatus =
  | BaseMcpDashboardStatus
  | ChainActionDashboardStatus;
type DashboardPreparedSummary =
  | BaseMcpPreparedActionSummary
  | ChainActionPreparedSummary;

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
function formatGateReasons(reasons: readonly string[]) {
  if (!reasons.length) {
    return "";
  }

  const labels = new Map<string, string>([
    ["owner_session_required", "sign in to the owner account"],
    ["selected_agent_required", "select a deployed agent"],
    ["deployed_agent_required", "publish an agent first"],
    ["base_account_required", `connect ${currentWalletDisplayName}`],
    ["base_account_address_required", `connect ${currentWalletDisplayName}`],
    ["base_chain_required", `switch to ${currentProductChain.name}`],
    ["controlled_submission_required", "prepare the reviewed transaction"],
    ["operator_ack_required", "confirm owner review"],
    ["live_window_activation_required", "open the owner transaction window"],
    ["live_window_approval_required", "approve the owner transaction window"],
    ["runtime_window_disabled", "enable the owner runtime window"],
    ["owner_click_required", "confirm with an owner click"],
    ["owner_approval_required", "record owner approval"],
    ["base_account_approval_required", `confirm in ${currentWalletDisplayName}`],
    ["submission_nonce_required", "bind the one-time submit session"],
    ["one_time_prompt_nonce_required", "bind the one-time wallet prompt"],
    ["owner_only_audit_required", "record private owner audit evidence"],
    ["controlled_submission_runtime_disabled", "Submitter is disabled"],
    ["runtime_submitter_disabled", "Submitter is disabled"],
    ["private_dashboard_required", "use the private dashboard"],
    ["telegram_authority_forbidden", "Telegram cannot execute this action"],
    ["public_visibility_forbidden", "public profiles cannot execute this action"],
    ["result_closeout_required", "complete result closeout"],
    ["owner_closeout_required", "complete owner closeout"],
    ["receipt_verification_required", "verify the transaction receipt"],
    ["kyra_approval_required", "record Kyra approval"],
    ["rollback_required", "keep rollback ready"],
    ["gas_required", `fund ${currentGasDisplayName} for gas`],
    ["base_eth_gas_required", `fund ${currentGasDisplayName} for gas`],
    ["execution_eligibility_required", "complete execution safety review"],
    ["abuse_rate_limit_required", "complete abuse and rate-limit controls"],
    ["incident_controls_required", "complete incident controls"],
    ["monitoring_support_required", "complete monitoring and support readiness"],
    ["public_privacy_release_required", "complete public privacy review"],
    ["phase10_readiness_required", "complete release readiness review"],
    ["owner_scope_required", "use the private owner workspace"],
  ]);

  const readable = reasons.map((reason) => {
    if (labels.has(reason)) {
      return labels.get(reason);
    }

    if (reason.startsWith("frozen_action")) {
      return "prepare the reviewed action";
    }

    return reason.replace(/_/g, " ");
  }).filter(Boolean);

  return Array.from(new Set(readable)).join(", ");
}

function formatGateHint(reasons: readonly string[]) {
  const formatted = formatGateReasons(reasons);
  return formatted ? `To continue: ${formatted}.` : "";
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
    return "protected mode";
  }

  return status === "not-configured" ? "not connected" : "no records";
}

function getWalletReadinessFallback(
  signedIn: boolean,
  hasAgentRecord: boolean,
): DemoWalletReadiness {
  return {
    state: "not_connected",
    label: hasAgentRecord ? "Execution disabled" : "No wallet record",
    addressLabel: "Not connected",
    network: currentProductChain.name + " pending",
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
    connectorPriority: [currentWalletDisplayName],
    safetyNote: connectionEnabled
      ? "Connection is owner-initiated. Signing and transactions remain disabled."
      : `${currentWalletDisplayName} connection is disabled.`,
  };
}

function getPreparedActionPreviewFallback(
  signedIn: boolean,
): DemoPreparedActionPreview {
  return {
    id: "chain_status_check_preview",
    status: "blocked",
    actionKind: "base_mcp_status_check",
    title: currentProductChain.name + " status check",
    chain: currentProductChain.name,
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

function createChainActionPreparedActionPreview(
  summary: ChainActionPreparedSummary,
): DemoPreparedActionPreview {
  return {
    id: "chain_status_check_live_preview",
    status: "preview_ready",
    actionKind: summary.actionKind,
    title: summary.chainName + " status check",
    chain: summary.chainName,
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
    safetyNote: "No wallet prompt, signing, or transaction submission.",
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
    base_mcp_routes: "chain action",
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
    return "local preview";
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

  return "session pending";
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

  return "Telegram session pending";
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

  return "This agent is waiting for a live Telegram session.";
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
    "Admin actions are scoped to this signed-in workspace.",
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
  const canViewOperationalReadiness = isAdmin;
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
      "Dashboard Telegram status read model is protected.",
    );
  const [telegramDashboardStatuses, setTelegramDashboardStatuses] = useState<
    TelegramDashboardStatusRecord[]
  >([]);
  const [baseMcpStatusState, setBaseMcpStatusState] = useState<
    "idle" | "checking" | "ready" | "blocked" | "error"
  >("idle");
  const [baseMcpStatusCode, setBaseMcpStatusCode] = useState<
    DashboardPrepareStatus | null
  >(null);
  const [baseMcpStatusMessage, setBaseMcpStatusMessage] = useState(
    "Run an owner-only read-only capability check.",
  );
  const [baseMcpPreparedSummary, setBaseMcpPreparedSummary] = useState<
    DashboardPreparedSummary | null
  >(null);
  const [baseAccountConnectionStatus, setBaseAccountConnectionStatus] =
    useState<OwnerWalletConnectionStatus>({
      connected: false,
      address: null,
      chainId: null,
      connectorId: null,
    });
  const [phase8OwnerArming, setPhase8OwnerArming] =
    useState<Phase8OwnerArmingState | null>(null);
  const [phase8SubmitterResult, setPhase8SubmitterResult] =
    useState<Phase8ControlledSubmissionResultEvent | null>(null);
  const [phase8PersistedResults, setPhase8PersistedResults] = useState<
    Phase8PersistedExecutionResult[]
  >([]);
  const baseMcpRequestSequenceRef = useRef(0);
  const supabaseStatus = getSupabaseAdapterStatus();
  const phase8LowValueBaseBalance = useBalance({
    address: baseAccountConnectionStatus.address ?? undefined,
    chainId: baseChainId,
    query: {
      enabled: baseAccountConnectionStatus.connected && Boolean(baseAccountConnectionStatus.address),
      refetchInterval: 15_000,
    },
  });
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
    window.dispatchEvent(new PopStateEvent("popstate"));
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
            : result.error ?? "Dashboard has no persisted agent records.",
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
          setAdminActionMessage("Workspace reset. Agent quota is clear.");
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
        setDeployFunctionMessage("Deploy function URL is not connected.");
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
        "Dashboard Telegram status read model is protected.",
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
  const selectedAgentMatchesRuntime = Boolean(
    agentRecord && agentRecord.chainKey === currentProductChain.key,
  );
  const selectedChainActionPrepared = currentProductChain.key === "base" || Boolean(
    agentRecord &&
      ["ready", "active"].includes(agentRecord.chainActionStatus) &&
      baseMcpPreparedSummary &&
      "chainKey" in baseMcpPreparedSummary &&
      baseMcpPreparedSummary.chainKey === currentProductChain.key &&
      baseMcpPreparedSummary.chainId === currentProductChain.id,
  );
  const selectedAgentReadyForExecution =
    selectedAgentMatchesRuntime && selectedChainActionPrepared;
  const runtimeBoundWalletConnected = selectedAgentMatchesRuntime &&
    baseAccountConnectionStatus.connected &&
    baseAccountConnectionStatus.chainId === currentProductChain.id;

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
  const walletReadiness = agentRecord
    ? dashboardData?.walletReadinessByAgent[agentRecord.id] ??
      getWalletReadinessFallback(Boolean(authSession), true)
    : getWalletReadinessFallback(Boolean(authSession), false);
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
        selectedAgent: selectedAgentReadyForExecution,
        baseAccountConnected: runtimeBoundWalletConnected,
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
      selectedAgentReadyForExecution,
      baseAccountConnectionStatus.chainId,
      baseAccountConnectionStatus.connected,
    ],
  );
  const preparedActionPreview = baseMcpPreparedSummary
    ? "chainKey" in baseMcpPreparedSummary
      ? createChainActionPreparedActionPreview(baseMcpPreparedSummary)
      : createBaseMcpPreparedActionPreview(baseMcpPreparedSummary)
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
        routeSummary: `Owner reviewed ${currentProductChain.name} transaction preview.`,
        valueSummary: "No token spend is allowed in this review.",
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
        selectedAgent: selectedAgentReadyForExecution,
        preparedActionStorageEnabled: false,
        ownerApprovalRecorded: false,
        actionKind: "base_reviewed_transaction",
        chainId: baseChainId,
        recipient: "0x1111111111111111111111111111111111111111",
        valueWei: "0",
        data: "0x",
        routeSummary: `Owner reviewed ${currentProductChain.name} transaction preview.`,
        valueSummary: "No token spend is allowed during policy review.",
      }),
    [agentRecord, authSession, selectedAgentReadyForExecution],
  );
  const phase8OwnerActionCandidate = useMemo(
    () =>
      createPhase8OwnerActionCandidate({
        ownerUserId: authSession?.user.id,
        workspaceId: dashboardData?.workspace.id,
        agentId: selectedAgentReadyForExecution ? agentRecord?.id : undefined,
        baseAccountConnected: runtimeBoundWalletConnected,
        baseAccountAddress: baseAccountConnectionStatus.address,
        chainId: baseAccountConnectionStatus.chainId,
      }),
    [
      agentRecord?.id,
      authSession?.user.id,
      selectedAgentReadyForExecution,
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
        baseAccountConnected: runtimeBoundWalletConnected,
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
      selectedAgentReadyForExecution,
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

  useEffect(() => {
    setPhase8PersistedResults(
      loadPhase8PersistedExecutionResults(authSession?.user.id),
    );
  }, [authSession?.user.id]);

  const phase8ScopedPersistedResult = useMemo(
    () =>
      phase8PersistedResults.find(
        (record) =>
          record.ownerUserId === authSession?.user.id &&
          record.workspaceId === dashboardData?.workspace.id &&
          record.agentId === agentRecord?.id,
      ) ?? null,
    [
      agentRecord?.id,
      authSession?.user.id,
      dashboardData?.workspace.id,
      phase8PersistedResults,
    ],
  );
  const phase8SubmittedTxHash = isTransactionHash(phase8SubmitterResult?.txHash)
    ? phase8SubmitterResult.txHash
    : isTransactionHash(phase8ScopedPersistedResult?.txHash)
    ? phase8ScopedPersistedResult.txHash
    : null;
  const phase8TransactionReceipt = useWaitForTransactionReceipt({
    hash: phase8SubmittedTxHash ?? undefined,
    chainId: baseChainId,
    query: {
      enabled: Boolean(phase8SubmittedTxHash),
      refetchInterval: 15_000,
    },
  });
  useEffect(() => {
    const receiptStatus = phase8TransactionReceipt.data?.status ?? null;
    if (!phase8ScopedPersistedResult || !receiptStatus) {
      return;
    }

    const reconciled = reconcilePhase8PersistedExecutionResult(
      phase8ScopedPersistedResult,
      receiptStatus,
    );
    if (reconciled === phase8ScopedPersistedResult) {
      return;
    }

    setPhase8PersistedResults(
      savePhase8PersistedExecutionResult(reconciled),
    );
  }, [phase8ScopedPersistedResult, phase8TransactionReceipt.data?.status]);

  function handlePhase8ResultCloseout(
    event: Phase8ControlledSubmissionResultEvent,
  ) {
    setPhase8SubmitterResult(event);

    const persisted = createPhase8PersistedExecutionResult({
      ownerUserId: authSession?.user.id ?? "",
      workspaceId: dashboardData?.workspace.id ?? "",
      agentId: agentRecord?.id ?? "",
      preparedActionId: phase8FrozenAction?.requestId ?? "",
      submissionNonce: activePhase8OwnerArming?.submissionNonce ?? "",
      event,
    });

    if (!persisted.ok || !persisted.record) {
      recordBackendEvent({
        kind: "dashboard-refresh",
        source: "dashboard",
        status: "blocked",
        message: getPhase8ResultPersistenceFailureMessage(
          persisted.reason ?? "transaction_hash_required",
        ),
      });
      return;
    }

    setPhase8PersistedResults(
      savePhase8PersistedExecutionResult(persisted.record),
    );
  }

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
  const baseExecutionResults = dashboardData?.executionResults.length
    ? dashboardData.executionResults
    : getExecutionResultFallback(Boolean(authSession));
  const executionResults = phase8PersistedResults.length
    ? [
      ...phase8PersistedResults.map(mapPhase8PersistedResultToDemoExecutionResult),
      ...baseExecutionResults,
    ]
    : baseExecutionResults;
  const phase8PreparedActionId = phase8FrozenAction?.requestId ??
    phase8ScopedPersistedResult?.preparedActionId ??
    executionResults[0]?.preparedActionId ??
    "";
  const phase8EffectiveResultState = phase8SubmitterResult?.state ??
    phase8ScopedPersistedResult?.status ??
    null;
  const phase8TransactionVerification = useMemo(
    () =>
      evaluatePhase8TransactionVerification({
        ownerUserId: authSession?.user.id ?? "",
        workspaceId: dashboardData?.workspace.id ?? "",
        agentId: agentRecord?.id ?? "",
        preparedActionId: phase8PreparedActionId,
        txHash: phase8SubmittedTxHash,
        receiptStatus: phase8TransactionReceipt.data?.status ?? null,
        receiptLoading: phase8TransactionReceipt.isLoading || phase8TransactionReceipt.isFetching,
        receiptError: phase8TransactionReceipt.isError,
        visibleInPublicProfile: false,
      }),
    [
      agentRecord?.id,
      authSession?.user.id,
      dashboardData?.workspace.id,
      phase8PreparedActionId,
      phase8SubmittedTxHash,
      phase8TransactionReceipt.data?.status,
      phase8TransactionReceipt.isError,
      phase8TransactionReceipt.isFetching,
      phase8TransactionReceipt.isLoading,
    ],
  );
  const resultMonitoringCloseout = useMemo(
    () =>
      evaluateResultMonitoringCloseout({
        ownerUserId: authSession?.user.id ?? "",
        workspaceId: dashboardData?.workspace.id ?? "",
        agentId: agentRecord?.id ?? "",
        preparedActionId: phase8PreparedActionId,
        providerStatus: phase8TransactionVerification.status === "confirmed"
          ? "confirmed"
          : phase8TransactionVerification.status === "failed"
          ? "provider_failed"
          : phase8EffectiveResultState
          ? "provider_submitted"
          : "not_started",
        txHash: phase8TransactionVerification.txHash ?? phase8SubmittedTxHash,
        confirmationId: phase8TransactionVerification.confirmationId,
        failureCode: phase8TransactionVerification.status === "failed" ? "submission_failed" : null,
        disconnectRequested: false,
        emergencyDisabled: false,
        visibleInPublicProfile: false,
      }),
    [
      agentRecord?.id,
      authSession?.user.id,
      selectedAgentReadyForExecution,
      dashboardData?.workspace.id,
      executionResults,
      phase8FrozenAction?.requestId,
      phase8SubmitterResult,
      phase8TransactionVerification,
    ],
  );
  const phase8SmokeCloseout = useMemo(
    () =>
      evaluatePhase8SmokeCloseout({
        ownerUserId: authSession?.user.id ?? "",
        workspaceId: dashboardData?.workspace.id ?? "",
        agentId: agentRecord?.id ?? "",
        preparedActionId: phase8PreparedActionId,
        status: phase8TransactionVerification.status === "confirmed"
          ? "confirmed"
          : phase8TransactionVerification.status === "failed"
          ? "failed"
          : phase8EffectiveResultState === "submitted"
          ? "submitted"
          : phase8EffectiveResultState === "confirmed"
          ? "confirmed"
          : phase8EffectiveResultState === "failed"
          ? "failed"
          : "not_started",
        ownerOnly: resultMonitoringCloseout.ownerOnly,
        txHash: phase8TransactionVerification.txHash ?? phase8SubmittedTxHash ?? resultMonitoringCloseout.txHash,
        confirmationId: phase8TransactionVerification.confirmationId ?? resultMonitoringCloseout.confirmationId,
        sanitizedFailureReason: phase8TransactionVerification.sanitizedFailureReason ?? resultMonitoringCloseout.sanitizedFailureReason,
        visibleInPublicProfile: false,
      }),
    [
      agentRecord?.id,
      authSession?.user.id,
      selectedAgentReadyForExecution,
      dashboardData?.workspace.id,
      executionResults,
      phase8FrozenAction?.requestId,
      phase8SubmitterResult,
      phase8TransactionVerification,
      resultMonitoringCloseout,
    ],
  );
  const phase8UserSafeTransactionPolicy = useMemo(
    () =>
      evaluatePhase8UserSafeTransactionPolicy({
        ownerSignedIn: Boolean(authSession),
        privateDashboard: true,
        selectedAgent: selectedAgentReadyForExecution,
        baseAccountConnected: runtimeBoundWalletConnected,
        chainId: baseChainId,
        preparedActionId: phase8FrozenAction?.requestId ?? "",
        actionKind: phase8OwnerActionCandidate.ok
          ? phase8OwnerActionCandidate.candidate.actionKind
          : null,
        valueWei: phase8OwnerActionCandidate.ok
          ? phase8OwnerActionCandidate.candidate.valueWei
          : null,
        data: phase8OwnerActionCandidate.ok
          ? phase8OwnerActionCandidate.candidate.data
          : null,
        includesTokenApproval: false,
        includesSwap: false,
        requestedFromTelegram: false,
        visibleInPublicProfile: false,
        cooldownSatisfied: true,
      }),
    [
      agentRecord,
      authSession,
      selectedAgentReadyForExecution,
      baseAccountConnectionStatus.connected,
      phase8FrozenAction?.requestId,
      phase8OwnerActionCandidate,
    ],
  );
  const phase8LowValueTransactionReadiness = useMemo(
    () =>
      evaluatePhase8LowValueTransactionReadiness({
        ownerSignedIn: Boolean(authSession),
        privateDashboard: true,
        selectedAgent: selectedAgentReadyForExecution,
        baseAccountConnected: runtimeBoundWalletConnected,
        chainId: baseAccountConnectionStatus.chainId,
        preparedActionId: phase8FrozenAction?.requestId ?? "",
        ownerApprovalRecorded: Boolean(activePhase8OwnerArming),
        requestedValueWei: "100000000000000",
        estimatedGasFeeWei: "10000000000000",
        availableGasBalanceWei: phase8LowValueBaseBalance.data?.value.toString() ?? null,
        data: "0x",
        includesTokenApproval: false,
        includesSwap: false,
        requestedFromTelegram: false,
        visibleInPublicProfile: false,
      }),
    [
      activePhase8OwnerArming,
      agentRecord,
      authSession,
      selectedAgentReadyForExecution,
      baseAccountConnectionStatus.chainId,
      baseAccountConnectionStatus.connected,
      phase8LowValueBaseBalance.data?.value,
      phase8FrozenAction?.requestId,
    ],
  );
  const phase8LowValueSubmitRequest = useMemo(
    () =>
      createPhase8LowValueSubmitRequest({
        ownerUserId: authSession?.user.id ?? "",
        workspaceId: dashboardData?.workspace.id ?? "",
        agentId: agentRecord?.id ?? "",
        privateDashboard: true,
        baseAccountConnected: runtimeBoundWalletConnected,
        chainId: baseAccountConnectionStatus.chainId,
        preparedActionId: phase8FrozenAction?.requestId ?? "",
        ownerApprovalRecorded: Boolean(activePhase8OwnerArming),
        recipient: phase8OwnerActionCandidate.ok
          ? phase8OwnerActionCandidate.candidate.recipient
          : null,
        valueWei: "100000000000000",
        data: "0x",
        includesTokenApproval: false,
        includesSwap: false,
        requestedFromTelegram: false,
        visibleInPublicProfile: false,
      }),
    [
      activePhase8OwnerArming,
      agentRecord?.id,
      authSession?.user.id,
      selectedAgentReadyForExecution,
      baseAccountConnectionStatus.chainId,
      baseAccountConnectionStatus.connected,
      dashboardData?.workspace.id,
      phase8FrozenAction?.requestId,
      phase8OwnerActionCandidate,
    ],
  );
  const phase8SecurityAbuseHardening = useMemo(
    () =>
      evaluatePhase8SecurityAbuseHardening({
        ownerUserId: authSession?.user.id ?? "",
        workspaceId: dashboardData?.workspace.id ?? "",
        agentId: agentRecord?.id ?? "",
        preparedActionId: phase8FrozenAction?.requestId ?? "",
        submissionNonce: activePhase8OwnerArming?.submissionNonce ?? "",
        runtimeEnabled: appConfig.integrations.phase8LowValueSubmission === "owner_low_value_window",
        ownerApprovalRecorded: Boolean(activePhase8OwnerArming),
        lowValueRequestReady: phase8LowValueSubmitRequest.ok,
        submitterPending: false,
        resultAlreadyRecorded: Boolean(phase8SubmitterResult),
        nonceAlreadyUsed: Boolean(phase8SubmitterResult),
        requestedValueWei: phase8LowValueSubmitRequest.ok
          ? phase8LowValueSubmitRequest.request.value.toString()
          : null,
        maxValueWei: "100000000000000",
        calldata: phase8LowValueSubmitRequest.ok
          ? phase8LowValueSubmitRequest.request.data ?? "0x"
          : null,
        includesTokenApproval: false,
        includesSwap: false,
        visibleInPublicProfile: false,
        telegramRequestedExecution: false,
        failureMessage: phase8TransactionVerification.sanitizedFailureReason,
        failureSanitized: true,
        verificationStatus: phase8TransactionVerification.status,
      }),
    [
      activePhase8OwnerArming,
      agentRecord?.id,
      authSession?.user.id,
      selectedAgentReadyForExecution,
      dashboardData?.workspace.id,
      phase8FrozenAction?.requestId,
      phase8LowValueSubmitRequest,
      phase8SubmitterResult,
      phase8TransactionVerification.sanitizedFailureReason,
      phase8TransactionVerification.status,
    ],
  );
  const phase8UserExecutionFlow = useMemo(
    () =>
      evaluatePhase8UserExecutionFlow({
        ownerSignedIn: Boolean(authSession),
        selectedAgent: selectedAgentReadyForExecution,
        baseAccountConnected: runtimeBoundWalletConnected,
        baseChainReady: baseAccountConnectionStatus.chainId === baseChainId,
        preparedActionReady: Boolean(phase8FrozenAction),
        ownerApprovalRecorded: Boolean(activePhase8OwnerArming),
        runtimeEnabled: appConfig.integrations.phase8LowValueSubmission === "owner_low_value_window",
        lowValueRequestReady: phase8LowValueSubmitRequest.ok,
        submitterState: phase8SubmitterResult
          ? phase8SubmitterResult.state
          : activePhase8OwnerArming
          ? "ready"
          : "not_submitted",
        verificationStatus: phase8TransactionVerification.status,
        closeoutReady: phase8SmokeCloseout.canContinueToPublicHardening,
        visibleInPublicProfile: false,
        telegramRequestedExecution: false,
      }),
    [
      activePhase8OwnerArming,
      agentRecord,
      authSession,
      selectedAgentReadyForExecution,
      baseAccountConnectionStatus.chainId,
      baseAccountConnectionStatus.connected,
      phase8FrozenAction,
      phase8LowValueSubmitRequest,
      phase8SmokeCloseout.canContinueToPublicHardening,
      phase8SubmitterResult,
      phase8TransactionVerification.status,
    ],
  );
  const phase8ProductionCloseout = useMemo(
    () =>
      evaluatePhase8ProductionCloseout({
        userFlowStatus: phase8UserExecutionFlow.status,
        securityStatus: phase8SecurityAbuseHardening.status,
        lowValueReadinessReady: phase8LowValueTransactionReadiness.canEnterLowValueReview,
        submitRequestReady: phase8LowValueSubmitRequest.ok,
        transactionVerificationStatus: phase8TransactionVerification.status,
        ownerCloseoutReady: phase8SmokeCloseout.canContinueToPublicHardening,
        publicExecutionEnabled: false,
        telegramExecutionEnabled: false,
      }),
    [
      phase8LowValueSubmitRequest.ok,
      phase8LowValueTransactionReadiness.canEnterLowValueReview,
      phase8SecurityAbuseHardening.status,
      phase8SmokeCloseout.canContinueToPublicHardening,
      phase8TransactionVerification.status,
      phase8UserExecutionFlow.status,
    ],
  );
  const phase9ExecutionEligibility = useMemo(
    () => evaluatePhase9ExecutionEligibility({
      phase8CanContinueToPhase9: phase8ProductionCloseout.canContinueToPhase9,
      phase9RuntimeEnabled: false,
      ownerSignedIn: Boolean(authSession),
      selectedAgent: selectedAgentReadyForExecution,
      deployedAgent: selectedAgentReadyForExecution && Boolean(agentRecord?.publicPath),
      baseAccountConnected: runtimeBoundWalletConnected,
      chainId: baseAccountConnectionStatus.chainId,
      actionKind: "eth_transfer",
      valueWei: phase8LowValueSubmitRequest.ok
        ? phase8LowValueSubmitRequest.request.value.toString()
        : "100000000000000",
      maxValueWei: "100000000000000",
      kyraApprovalRecorded: Boolean(activePhase8OwnerArming),
      baseAccountApprovalRecorded: runtimeBoundWalletConnected,
      receiptVerificationReady: phase8TransactionVerification.status === "confirmed" || phase8ProductionCloseout.canContinueToPhase9,
      ownerCloseoutReady: phase8SmokeCloseout.canContinueToPublicHardening || phase8ProductionCloseout.canContinueToPhase9,
      requestedFromTelegram: false,
      visibleInPublicProfile: false,
      requestedFromAutomation: false,
      includesSwap: false,
      includesTokenApproval: false,
      calldata: "0x",
      privateKeyRequested: false,
      seedPhraseRequested: false,
    }),
    [
      activePhase8OwnerArming,
      agentRecord,
      authSession,
      selectedAgentReadyForExecution,
      baseAccountConnectionStatus.chainId,
      baseAccountConnectionStatus.connected,
      phase8LowValueSubmitRequest,
      phase8ProductionCloseout.canContinueToPhase9,
      phase8SmokeCloseout.canContinueToPublicHardening,
      phase8TransactionVerification.status,
    ],
  );
  const phase9AbuseRateLimit = useMemo(
    () => evaluatePhase9AbuseRateLimit({
      eligibilityCanProceed: phase9ExecutionEligibility.canProceedToAbuseHardening,
      phase9RuntimeEnabled: false,
      owner: { used: phase8SubmitterResult ? 1 : 0, limit: 3 },
      agent: { used: phase8SubmitterResult ? 1 : 0, limit: 3 },
      workspace: { used: executionResults.length, limit: 12 },
      route: { used: phase8SubmitterResult ? 1 : 0, limit: 5 },
      wallet: { used: runtimeBoundWalletConnected ? 1 : 0, limit: 3 },
      cooldownActive: false,
      nonceAlreadyUsed: Boolean(phase8SubmitterResult),
      duplicateSubmitDetected: Boolean(phase8SubmitterResult),
      providerBackoffActive: phase8TransactionVerification.status === "failed",
      requestedValueWei: phase8LowValueSubmitRequest.ok
        ? phase8LowValueSubmitRequest.request.value.toString()
        : "100000000000000",
      maxValueWei: "100000000000000",
      sanitizedDecision: true,
      exposesRawWalletData: false,
      exposesTelegramTokenRef: false,
      exposesProviderPayloadRef: false,
    }),
    [
      baseAccountConnectionStatus.connected,
      executionResults.length,
      phase8LowValueSubmitRequest,
      phase8SubmitterResult,
      phase8TransactionVerification.status,
      phase9ExecutionEligibility.canProceedToAbuseHardening,
    ],
  );
  const phase9IncidentControls = useMemo(
    () => evaluatePhase9IncidentControls({
      abuseCanProceed: phase9AbuseRateLimit.canProceedToIncidentControls,
      phase9RuntimeEnabled: false,
      emergencyDisableReady: true,
      rollbackRunbookReady: true,
      manualRecoveryReady: true,
      goNoGoRulesReady: true,
      rejectedPromptHandled: true,
      insufficientGasHandled: true,
      revertedTransactionHandled: true,
      providerOutageHandled: true,
      chainMismatchHandled: true,
      staleApprovalHandled: true,
      staleActionHandled: true,
      stuckReceiptHandled: true,
      postIncidentAuditReady: true,
      ownerOnlyAudit: true,
      sanitizedIncidentEvidence: true,
      visibleInPublicProfile: false,
      telegramCanControlIncident: false,
    }),
    [phase9AbuseRateLimit.canProceedToIncidentControls],
  );
  const phase9MonitoringSupport = useMemo(
    () => evaluatePhase9MonitoringSupport({
      incidentControlsCanProceed: phase9IncidentControls.canProceedToMonitoring,
      phase9RuntimeEnabled: false,
      netlifyHealthReady: true,
      supabaseHealthReady: true,
      edgeFunctionHealthReady: true,
      transactionVerificationHealthReady: true,
      publicExecutionGateHealthReady: true,
      ownerSupportCopyReady: true,
      sanitizedDebugStates: true,
      aggregatedAnalyticsReady: true,
      rawWalletInternalsHidden: true,
      telegramTokensHidden: true,
      providerPayloadsHidden: true,
      secretsHidden: true,
      ownerEvidenceReady: true,
      publicAnalyticsPrivacyPreserving: true,
    }),
    [phase9IncidentControls.canProceedToMonitoring],
  );

  const phase9PublicPrivacyRelease = useMemo(
    () => evaluatePhase9PublicPrivacyRelease({
      monitoringSupportCanProceed: phase9MonitoringSupport.canProceedToPrivacyGate,
      phase9RuntimeEnabled: false,
      landingPageAudited: true,
      publicAgentProfilesAudited: true,
      telegramResponsesAudited: true,
      dashboardCopyAudited: true,
      logsAudited: true,
      docsAudited: true,
      edgeFunctionErrorsAudited: true,
      walletAddressesHiddenUnlessOwnerApproved: true,
      tokenRefsHidden: true,
      sessionIdsHidden: true,
      internalIdsHidden: true,
      providerPayloadRefsHidden: true,
      transactionIntentInternalsHidden: true,
      rawErrorDetailsHidden: true,
      releaseDecisionRecorded: true,
    }),
    [phase9MonitoringSupport.canProceedToPrivacyGate],
  );

  const phase9Closeout = useMemo(
    () => evaluatePhase9Closeout({
      executionEligibilityReady: phase9ExecutionEligibility.canProceedToAbuseHardening,
      abuseRateLimitReady: phase9AbuseRateLimit.canProceedToIncidentControls,
      incidentControlsReady: phase9IncidentControls.canProceedToMonitoring,
      monitoringSupportReady: phase9MonitoringSupport.canProceedToPrivacyGate,
      publicPrivacyReleaseReady: phase9PublicPrivacyRelease.phase9CanClose,
      phase10ReadinessStarted: false,
    }),
    [
      phase9ExecutionEligibility.canProceedToAbuseHardening,
      phase9AbuseRateLimit.canProceedToIncidentControls,
      phase9IncidentControls.canProceedToMonitoring,
      phase9MonitoringSupport.canProceedToPrivacyGate,
      phase9PublicPrivacyRelease.phase9CanClose,
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
      baseAccountConnected: runtimeBoundWalletConnected,
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
        selectedAgent: selectedAgentReadyForExecution,
        baseAccountConnected: runtimeBoundWalletConnected,
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
      selectedAgentReadyForExecution,
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
        selectedAgent: selectedAgentReadyForExecution,
        baseAccountConnected: runtimeBoundWalletConnected,
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
      selectedAgentReadyForExecution,
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
        baseAccountConnected: runtimeBoundWalletConnected,
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
        baseAccountPromptReadiness: runtimeBoundWalletConnected
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
      selectedAgentReadyForExecution,
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
            message: "Owner approved browser-session prompt readiness.",
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
      selectedAgentReadyForExecution,
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
        chain: baseAccountConnectionStatus.chainId === baseChainId ? currentProductChain.name : "Other",
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
      selectedAgentReadyForExecution,
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
      selectedAgent: selectedAgentReadyForExecution,
      baseAccountConnected: runtimeBoundWalletConnected,
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
      selectedAgentReadyForExecution,
      baseAccountConnectionStatus.connected,
      phase8ControlledSubmission,
      phase8OwnerLiveWindowActivation,
    ],
  );
  const robinhoodTestnetCloseout = useMemo(
    () =>
      evaluateRobinhoodTestnetCloseout({
        enabled: appConfig.chain.testnetEvidenceMode,
        ownerSignedIn: Boolean(authSession),
        selectedAgent: selectedAgentMatchesRuntime,
        chainStatusPrepared: selectedChainActionPrepared,
        walletConnected: runtimeBoundWalletConnected,
        reviewedActionReady: Boolean(phase8FrozenAction),
        ownerWindowArmed: Boolean(activePhase8OwnerArming),
        submitterReady: phase8RuntimeEnablementPreflight.runtimeSubmitterEnabled,
        transactionStatus: phase8TransactionVerification.status,
      }),
    [
      activePhase8OwnerArming,
      authSession,
      phase8FrozenAction,
      phase8RuntimeEnablementPreflight.runtimeSubmitterEnabled,
      phase8TransactionVerification.status,
      runtimeBoundWalletConnected,
      selectedAgentMatchesRuntime,
      selectedChainActionPrepared,
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
        id: "no-agent-workspace",
        name: "No agent workspace",
        owner: "Signed-in account",
        mode: "backend connected" as const,
        authProvider: "supabase" as const,
      }
      : {
        id: "signed-out-preview",
        name: "Private workspace",
        owner: "No account session",
        mode: "backend connected" as const,
        authProvider: "supabase" as const,
      });
  const activityLines = dashboardData?.activityLogs.length
    ? dashboardData.activityLogs.map(formatActivityLog)
    : dashboardStatus === "loading"
    ? ["[--:--:--] dashboard: loading agent workspace records"]
    : authSession
    ? ["[--:--:--] dashboard: no deployed agent records"]
    : [
      "[--:--:--] account: sign in to load agent workspace records",
      "[--:--:--] dashboard: no sample agent or public route shown while signed out",
    ];
  const readinessRows = [
    {
      label: "Agent records",
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
        ? "protected"
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
      detail: "Health check confirms the backend connection before protected local mode is used.",
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
      label: "Agent database",
      detail: "Signed-in agent receipts persist through RLS-backed records.",
      state: getDashboardChecklistState(dashboardStatus),
    },
    {
      label: "Agent quota",
      detail:
        `Agent workspace is capped at ${demoAgentLimits.maxAgentsPerWorkspace} agents.`,
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
  const usingChainActionPrepare = currentProductChain.key !== "base";
  const prepareFunctionConfigured = usingChainActionPrepare
    ? appConfig.functions.chainActionPrepareConfigured
    : appConfig.functions.baseMcpPrepareConfigured;
  const selectedAgentChainActionReady = !usingChainActionPrepare ||
    agentRecord?.chainActionStatus === "ready" ||
    agentRecord?.chainActionStatus === "active";
  const canRunBaseMcpStatusCheck = Boolean(
    authSession &&
      agentRecord &&
      selectedAgentMatchesRuntime &&
      selectedAgentChainActionReady &&
      prepareFunctionConfigured &&
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
        : "not connected",
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
        `${dashboardAgentCount} persisted agent records loaded.`,
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
    setBaseMcpStatusMessage(
      usingChainActionPrepare
        ? `Checking owner session and ${currentProductChain.name} capability...`
        : "Checking owner session and Base MCP capability...",
    );
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

    const result = usingChainActionPrepare
      ? await prepareChainActionStatusCheck({
        session: freshAuth.session,
        agentId: agentRecord.id,
        workspaceId: agentRecord.workspaceId,
      })
      : await prepareBaseMcpStatusCheck({
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
            result.status === "base_mcp_rate_limited" ||
            result.status === "chain_action_disabled" ||
            result.status === "chain_action_not_configured" ||
            result.status === "chain_action_rate_limited" ||
            result.status === "agent_chain_action_locked"
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

    setAdminActionMessage("Resetting workspace records...");

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
    setAdminActionMessage("Refreshing workspace records...");
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

  if (!authSession && activeDashboardSectionId === "auth") {
    return (
      <main className="dashboard-page dashboard-auth-page">
        <section className="dashboard-main dashboard-auth-main">
          <div className="dashboard-topbar dashboard-auth-topbar">
            <div>
              <span className="demo-badge compact">
                <KeyRound size={14} />
                Account access
              </span>
              <h1>Sign in to Kyra Console</h1>
              <p>
                Use your account session to load private agent records, approval
                queues, and owner-only transaction controls.
              </p>
            </div>
            <button
              className="button button-ghost"
              type="button"
              onClick={onBackHome}
            >
              <ArrowLeft size={16} />
              Home
            </button>
          </div>

          <div className="dashboard-auth-grid">
            <AuthSessionPanel
              session={authSession}
              status={authStatus}
              message={authMessage}
              onSessionChange={onAuthSessionChange}
            />

            <section className="dashboard-public-owner-notice">
              <div className="result-monitoring-header">
                <span>Owner-only workspace</span>
                <strong>private by default</strong>
              </div>
              <p>
                Public visitors do not see dashboard records, wallet status,
                approval queues, transaction controls, support evidence, or
                release readiness.
              </p>
              <small>
                Signing in only loads account-scoped Kyra records. Wallet keys,
                Telegram bot tokens, and transaction execution stay behind
                separate owner approvals.
              </small>
            </section>
          </div>
        </section>
      </main>
    );
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
          {canViewOperationalReadiness
            ? (
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
            )
            : null}
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
                ? "Private workspace"
                : agentRecord
                ? dashboardStatus === "connected"
                  ? "Persisted agent"
                  : "Agent ready"
                : dashboardStatus === "loading"
                ? "Syncing workspace"
                : "No agent"}
            </span>
            <h1>
              {!authSession
                ? "Open your private Kyra workspace"
                : agentRecord
                ? agentRecord.displayName
                : "No agent deployed"}
            </h1>
            <p>
              {!authSession
                ? `Sign in to manage saved agents, public routes, approval queues, ${currentWalletDisplayName} status, and owner-only execution controls.`
                : agentRecord
                ? activeTemplate.role
                : "Deploy an agent to create persisted dashboard records."}
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
            : !authSession
            ? (
              <button className="button button-primary" type="button" onClick={() => openDashboardSection("auth")}>
                Open account access
                <KeyRound size={16} />
              </button>
            )
            : (
              <button className="button button-primary" type="button" disabled>
                Deploy agent first
                <ExternalLink size={16} />
              </button>
            )}
        </div>

        {!authSession ? (
          <section className="dashboard-public-owner-notice" id="overview">
            <div className="result-monitoring-header">
              <span>Private owner workspace</span>
              <strong>sign in required</strong>
            </div>
            <p>Kyra keeps agent records, wallet status, approval queues, transaction controls, support evidence, and release readiness inside the private owner workspace.</p>
            <small>Public visitors can use the product pages and public agent profiles without seeing operational or wallet internals.</small>
          </section>
        ) : (
          <>
        {agentRecords.length? (
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
                      ? "No persisted agent records."
                      : "Dashboard records locked until sign-in."}
                  </strong>
                  <p>
                    {authSession
                      ? "This signed-in workspace is clean. Deploy an agent from the home flow to create the dashboard, approval queue, wallet policy, logs, and public agent route."
                      : "Sign in to load account-scoped agent workspace records. No sample agent, wallet queue, or public route is shown while signed out."}
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
                      Dashboard is owner-controlled. BotFather token validation,
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
                        ? "Deploy an agent before Kyra creates wallet approval records."
                        : "Sign in to load account-scoped approval records. Private queues stay hidden while signed out."}
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
              <span>{appConfig.chain.testnetEvidenceMode ? "Testnet transaction setup" : "Wallet policy"}</span>
              <span>{appConfig.chain.testnetEvidenceMode ? robinhoodTestnetCloseout.status.replace(/_/g, " ") : walletReadiness.state.replace(/_/g, " ")}</span>
            </div>
            <OwnerWalletConnectionPanel
              session={authSession}
              workspaceId={agentRecord?.workspaceId ?? null}
              agentId={agentRecord?.id ?? null}
              agentName={agentRecord?.displayName ?? null}
              agentChainKey={agentRecord?.chainKey ?? null}
              onConnectionStateChange={setBaseAccountConnectionStatus}
              onSessionChange={onAuthSessionChange}
            />
            {appConfig.chain.testnetEvidenceMode ? (
              <div
                className={"robinhood-testnet-closeout status-" + robinhoodTestnetCloseout.status}
              >
                <div className="robinhood-testnet-closeout-header">
                  <span className="queue-icon">
                    <ShieldCheck size={16} />
                  </span>
                  <div>
                    <small>Robinhood Chain Testnet</small>
                    <strong>{robinhoodTestnetCloseout.label}</strong>
                  </div>
                  <span>owner only</span>
                </div>
                <div className="robinhood-testnet-closeout-steps">
                  {robinhoodTestnetCloseout.steps.map((step, index) => {
                    const StepIcon = step.status === "complete"
                      ? CheckCircle2
                      : step.status === "failed"
                      ? X
                      : step.status === "current"
                      ? Clock3
                      : LockKeyhole;

                    return (
                      <article
                        className={"testnet-step step-" + step.status}
                        key={step.key}
                      >
                        <span className="testnet-step-index">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <StepIcon size={16} />
                        <div>
                          <strong>{step.label}</strong>
                          <small>{step.detail}</small>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <p aria-live="polite">{robinhoodTestnetCloseout.message}</p>
                <div className="robinhood-testnet-closeout-actions">
                  {robinhoodTestnetCloseout.nextAction === "check_chain_status" ? (
                    <button
                      className="button button-primary"
                      disabled={!canRunBaseMcpStatusCheck}
                      onClick={handleBaseMcpStatusCheck}
                      type="button"
                    >
                      <Server size={16} />
                      {baseMcpStatusState === "checking"
                        ? "Checking network"
                        : "Check testnet status"}
                    </button>
                  ) : null}
                  {robinhoodTestnetCloseout.nextAction === "open_review_window" ? (
                    <button
                      className="button button-primary"
                      disabled={!phase8FrozenAction}
                      onClick={armPhase8OwnerLiveWindow}
                      type="button"
                    >
                      <ShieldCheck size={16} />
                      Open transaction review
                    </button>
                  ) : null}
                  {robinhoodTestnetCloseout.nextAction === "submit_transaction" ? (
                    <a className="button button-primary" href="#robinhood-testnet-submit">
                      <WalletCards size={16} />
                      Continue to wallet confirmation
                    </a>
                  ) : null}
                  {robinhoodTestnetCloseout.nextAction === "retry_transaction" ? (
                    <button
                      className="button button-ghost"
                      onClick={resetPhase8OwnerLiveWindow}
                      type="button"
                    >
                      <RotateCcw size={16} />
                      Reset transaction review
                    </button>
                  ) : null}
                  {robinhoodTestnetCloseout.nextAction === "complete" &&
                    phase8TransactionVerification.txHash ? (
                    <a
                      className="button button-ghost"
                      href={currentProductChain.explorerUrl + "/tx/" + phase8TransactionVerification.txHash}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <ExternalLink size={16} />
                      View verified receipt
                    </a>
                  ) : null}
                  {robinhoodTestnetCloseout.nextAction === "connect_wallet" ? (
                    <small>Use the wallet connection control directly above.</small>
                  ) : null}
                  {robinhoodTestnetCloseout.nextAction === "sign_in" ? (
                    <small>Use the account panel to start a private owner session.</small>
                  ) : null}
                  {robinhoodTestnetCloseout.nextAction === "select_agent" ? (
                    <small>Select a deployed Robinhood Chain Testnet agent at the top of the dashboard.</small>
                  ) : null}
                  {robinhoodTestnetCloseout.nextAction === "wait_for_receipt" ? (
                    <small>Receipt monitoring is active. Keep this owner session open.</small>
                  ) : null}
                </div>
                <small className="robinhood-testnet-closeout-note">
                  Zero value, no calldata, no token approval, no swap, no Telegram execution.
                  Wallet keys never enter Kyra.
                </small>
              </div>
            ) : (
              <>
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
                  <small>Wallet approval boundary</small>
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
                    {runtimeBoundWalletConnected
                        ? "Owner wallet ready"
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
                  {walletProviderStatus.dependencyStatus}: wallet gate{" "}
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
                        ? "No keys, funds, or approval settings exist until an agent is deployed."
                        : "Sign in and deploy an agent before Kyra shows wallet policy records."}
                    </p>
                  </div>
                )}
            </div>
              </>
            )}
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
                  Reset the signed-in workspace when quota testing needs a
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
                        ? "Signed-in workspace"
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
                    {isAdminActionRunning ? "Resetting" : "Reset agent records"}
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
                            Access:{" "}
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
                                  next agent deploy.
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
                              ? `${dashboardAgentCount} persisted agents`
                              : "no persisted agents"}
                          </span>
                          <span>
                            max {demoAgentLimits.maxAgentsPerWorkspace}{" "}
                            agents
                          </span>
                          <span>
                            deploy-agent{" "}
                            {getDeployFunctionHealthLabel(deployFunctionStatus)}
                          </span>
                          <span>{appConfig.chain.testnetEvidenceMode ? "owner-only testnet execution" : "onchain execution disabled"}</span>
                        </div>
                      </div>
                    </details>
                  )
                  : null}
              </section>
            )
            : null}

          {canViewOperationalReadiness ? (
            <>
          <section
            className="dashboard-panel backend-readiness-panel"
            id="backend"
          >
            <div className="panel-title">
              <span>Product readiness</span>
              <span>{authSession ? "account connected" : "private access"}</span>
            </div>
            <div className="readiness-summary">
              <span
                className={`readiness-chip readiness-${
                  getDashboardReadinessTone(dashboardStatus)
                }`}
              >
                <ShieldCheck size={14} />
                {dashboardStatus === "connected"
                  ? "Backend persistence active"
                  : "protected"}
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
                  ? `${dashboardAgentCount} persisted agents`
                  : "no persisted agents"}
              </span>
              <span>
                max {demoAgentLimits.maxAgentsPerWorkspace} agents
              </span>
              <span>approval-first workflows</span>
              <span>{appConfig.chain.testnetEvidenceMode ? "owner-only testnet execution" : "onchain execution disabled"}</span>
            </div>
          </section>

          <section className={"dashboard-panel prepared-action-panel" + (appConfig.chain.testnetEvidenceMode ? " is-robinhood-testnet" : "")}>
            <div className="panel-title">
              <span>{usingChainActionPrepare ? `${currentProductChain.name} prep` : "Base MCP prep"}</span>
              <span>{preparedActionPreview.status.replace(/_/g, " ")}</span>
            </div>
            <div className="base-mcp-boundary-banner">
              <ShieldCheck size={16} />
              <span>
                {usingChainActionPrepare
                  ? `${currentProductChain.name} status preparation is read-only. Transaction review and wallet confirmation remain isolated in the owner-only testnet window.`
                  : "Official Base MCP wallet authority is blocked until provider metadata, least-privilege scope, tool mapping, and approval behavior are verified."}
              </span>
            </div>
            <div className="prepared-action-allowlist-grid">
              <article>
                <small>Action allowlist</small>
                <strong>
                  {appConfig.chain.testnetEvidenceMode
                    ? selectedChainActionPrepared
                      ? "status route ready"
                      : "status check required"
                    : preparedActionAllowlistReview.allowed
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
                <strong>{appConfig.chain.testnetEvidenceMode ? "read-only status check" : "status check, reviewed transaction"}</strong>
              </article>
              <article>
                <small>Token spend</small>
                <strong>blocked</strong>
              </article>
              <article>
                <small>Calldata</small>
                <strong>blocked</strong>
              </article>
              <article>
                <small>Untrusted input</small>
                <strong>Telegram, LLM, provider blocked</strong>
              </article>
            </div>
            <div className="prepared-action-policy-panel">
              <div className="prepared-action-policy-header">
                <span>Action policy review</span>
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
                    {formatGateHint(preparedActionPolicyReview.reasons)}
                  </small>
                )
                : (
                  <small>
                    Policy review passed. Wallet prompt remains separately
                    approval-first.
                  </small>
                )}
            </div>
            <div className="dual-approval-panel">
              <div className="dual-approval-header">
                <span>Two-step approval</span>
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
                    {dualApprovalReview.frozenAction ? "locked" : "not ready"}
                  </strong>
                </span>
                <span>
                  {currentWalletDisplayName}
                  <strong>
                    {runtimeBoundWalletConnected
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
                    : usingChainActionPrepare
                    ? `Check ${currentProductChain.name} status`
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

          <section className={"dashboard-panel execution-result-panel" + (appConfig.chain.testnetEvidenceMode ? " is-robinhood-testnet" : "")}>
            <div className="panel-title">
              <span>{appConfig.chain.testnetEvidenceMode ? "Testnet transaction" : "Execution audit trail"}</span>
              <span>{appConfig.chain.testnetEvidenceMode ? robinhoodTestnetCloseout.label : "owner-only"}</span>
            </div>
            <div className="controlled-live-gate-panel">
              <div className="controlled-live-gate-header">
                <span>Controlled transaction gate</span>
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
                    {formatGateHint(controlledLiveTransactionGate.reasons)}
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
                      ? currentWalletDisplayName
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
                    {formatGateHint(executionLaunchReadiness.reasons)}
                  </small>
                )
                : (
                  <small>
                    Owner review can be prepared. Access wallet prompt,
                    signing, and submission still require a separate enablement
                    window.
                  </small>
                )}
            </div>
            <div className="phase-8-execution-panel">
              <div className="phase-8-execution-header">
                <span>Owner-controlled execution</span>
                <strong>{phase8ControlledExecution.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-8-execution-grid">
                <span>
                  Access
                  <strong>
                    {String(appConfig.integrations.walletExecution) === "enabled"
                      ? "enabled"
                      : "locked"}
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
                    {formatGateHint(phase8ControlledExecution.reasons)}
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
                <span>Owner review window</span>
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
                    {formatGateHint(phase8LiveWindowPreparation.reasons)}
                  </small>
                )
                : (
                  <small>
                    owner-approved window, private dashboard intent, frozen
                    action binding, and {currentWalletDisplayName} prompt readiness are ready.
                    Transaction submission remains disabled until owner approval is complete.
                  </small>
                )}
            </div>
            <div className="phase-8-wallet-prompt-panel">
              <div className="phase-8-wallet-prompt-header">
                <span>Wallet prompt review</span>
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
                    {formatGateHint(phase8WalletPromptOpening.reasons)}
                  </small>
                )
                : (
                  <small>
                    One owner-click {currentWalletDisplayName} prompt can open under
                    owner-only audit. Transaction submission remains disabled in
                    this step.
                  </small>
                )}
            </div>
            {authSession ? (
              <>
            <div className="phase-8-submission-panel">
              <div className="phase-8-submission-header">
                <span>Controlled submission</span>
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
                  {currentProductChain.name} approval
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
                    {formatGateHint(phase8ControlledSubmission.reasons)}
                  </small>
                )
                : (
                  <small>
                    One owner-controlled {currentProductChain.name} submission can proceed only from
                    the private dashboard. Telegram, public profiles, token
                    approvals, swaps, calldata, and non-zero value remain
                    blocked.
                  </small>
                )}
            </div>
            <div className="phase-8-live-window-activation-panel" id="robinhood-testnet-review">
              <div className="phase-8-live-window-activation-header">
                <span>Transaction review window</span>
                <strong>{phase8OwnerLiveWindowActivation.status}</strong>
              </div>
              <div className="phase-8-live-window-activation-grid">
                <span>
                  Review window
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
                      ? maskOwnerWalletAddress(phase8OwnerActionCandidate.candidate.recipient)
                      : `${currentWalletDisplayName} required`}
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
                ? <small>{formatGateHint(phase8OwnerActionCandidate.reasons)}</small>
                : null}
              <div className="phase-8-live-window-activation-actions">
                <button
                  className="button button-primary"
                  disabled={!phase8FrozenAction || !authSession || !agentRecord}
                  onClick={armPhase8OwnerLiveWindow}
                  type="button"
                >
                  <ShieldCheck size={16} />
                  Open review window
                </button>
                <button
                  className="button button-ghost"
                  disabled={!phase8OwnerArming}
                  onClick={resetPhase8OwnerLiveWindow}
                  type="button"
                >
                  <RotateCcw size={16} />
                  Close window
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
                  : "Review window is closed. Sign in, select an agent, and confirm the reviewed action first."}
              </small>
              {phase8OwnerLiveWindowActivation.reasons.length
                ? (
                  <small>
                    {formatGateHint(phase8OwnerLiveWindowActivation.reasons)}
                  </small>
                )
                : (
                  <small>
                    One owner-controlled transaction review window is open. Telegram, public
                    profiles, automation, token approvals, swaps, calldata, and
                    non-zero value remain blocked.
                  </small>
                )}
            </div>
            <div className="phase-8-submission-panel">
              <div className="phase-8-submission-header">
                <span>Transaction readiness</span>
                <strong>{phase8RuntimeEnablementPreflight.status}</strong>
              </div>
              <div className="phase-8-submission-grid">
                <span>
                  Access
                  <strong>
                    {appConfig.integrations.phase8ControlledSubmission === "owner_approved_window"
                      ? "enabled"
                      : "disabled"}
                  </strong>
                </span>
                <span>
                  {currentWalletDisplayName}
                  <strong>{runtimeBoundWalletConnected ? "connected" : "required"}</strong>
                </span>
                <span>
                  Review window
                  <strong>{phase8OwnerLiveWindowActivation.transactionSubmissionAllowed ? "armed" : "locked"}</strong>
                </span>
                <span>
                  Submitter
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
                    {formatGateHint(phase8RuntimeEnablementPreflight.reasons)}
                  </small>
                )
                : (
                  <small>
                    Transaction submission is available only from the private dashboard, selected agent,
                    connected {currentWalletDisplayName}, and one owner-controlled zero-value submit.
                    Telegram and public profiles remain blocked.
                  </small>
                )}
            </div>
            <div id="robinhood-testnet-submit">
              <Phase8ControlledSubmitter
              submission={phase8ControlledSubmission}
              activation={phase8OwnerLiveWindowActivation}
              preflight={phase8RuntimeEnablementPreflight}
              baseAccountAddress={baseAccountConnectionStatus.address}
              submissionNonce={activePhase8OwnerArming?.submissionNonce ?? null}
              frozenAction={phase8FrozenAction}
              onResultCloseout={handlePhase8ResultCloseout}
              />
            </div>
            <div className="result-monitoring-panel">
              <div className="result-monitoring-header">
                <span>Result monitoring</span>
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
                    {formatGateHint(resultMonitoringCloseout.reasons)}
                  </small>
                )
                : (
                  <small>
                    Result closeout is sanitized. No public result data, wallet
                    prompt, signing, or submission is enabled here.
                  </small>
                )}
            </div>
            <div className="phase-8-user-policy-panel">
              <div className="result-monitoring-header">
                <span>User-safe transaction policy</span>
                <strong>{phase8UserSafeTransactionPolicy.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-8-user-policy-grid">
                <span>
                  Value cap
                  <strong>{phase8UserSafeTransactionPolicy.maxValueWei} wei</strong>
                </span>
                <span>
                  Action kind
                  <strong>{phase8UserSafeTransactionPolicy.allowedActionKinds.join(", ")}</strong>
                </span>
                <span>
                  Telegram
                  <strong>blocked</strong>
                </span>
                <span>
                  Public profile
                  <strong>blocked</strong>
                </span>
              </div>
              <p>{phase8UserSafeTransactionPolicy.message}</p>
              {phase8UserSafeTransactionPolicy.reasons.length
                ? <small>{formatGateHint(phase8UserSafeTransactionPolicy.reasons)}</small>
                : <small>User-safe policy is private-dashboard only. Non-zero value, calldata, swaps, and token approvals remain locked.</small>}
            </div>
            <div className="phase-8-user-flow-panel">
              <div className="result-monitoring-header">
                <span>User execution flow</span>
                <strong>{phase8UserExecutionFlow.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-8-user-flow-track">
                {phase8UserExecutionFlow.steps.map((step, index) => (
                  <div
                    className={`phase-8-user-flow-step step-${step.status}`}
                    key={step.key}
                  >
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <strong>{step.label}</strong>
                      <small>{step.detail}</small>
                    </div>
                  </div>
                ))}
              </div>
              <p>{phase8UserExecutionFlow.message}</p>
              {phase8UserExecutionFlow.reasons.length
                ? <small>{formatGateHint(phase8UserExecutionFlow.reasons)}</small>
                : <small>Owner-only flow map. Telegram and public profiles cannot start, inspect, or complete execution.</small>}
            </div>
            <div className="phase-8-security-hardening-panel">
              <div className="result-monitoring-header">
                <span>Security hardening</span>
                <strong>{phase8SecurityAbuseHardening.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-8-security-hardening-grid">
                {phase8SecurityAbuseHardening.controls.map((control) => (
                  <span className={`security-${control.status}`} key={control.label}>
                    {control.label}
                    <strong>{control.status}</strong>
                    <small>{control.detail}</small>
                  </span>
                ))}
              </div>
              <p>{phase8SecurityAbuseHardening.message}</p>
              {phase8SecurityAbuseHardening.reasons.length
                ? <small>{formatGateHint(phase8SecurityAbuseHardening.reasons)}</small>
                : <small>Replay, double-submit, public, Telegram, calldata, swap, token approval, and unsanitized failure boundaries are hardened.</small>}
            </div>
            <div className="phase-8-low-value-panel">
              <div className="result-monitoring-header">
                <span>Low-value readiness</span>
                <strong>{phase8LowValueTransactionReadiness.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-8-low-value-grid">
                <span>
                  Value cap
                  <strong>{phase8LowValueTransactionReadiness.maxValueLabel}</strong>
                </span>
                <span>
                  Required balance
                  <strong>{phase8LowValueTransactionReadiness.requiredBalanceWei} wei</strong>
                </span>
                <span>
                  Live {currentProductChain.name} balance
                  <strong>{baseAccountConnectionStatus.address && phase8LowValueBaseBalance.data ? `${formatPhase8BaseEth(phase8LowValueBaseBalance.data.value)} ETH` : phase8LowValueBaseBalance.isLoading ? "checking" : "required"}</strong>
                </span>
                <span>
                  Gas/value source
                  <strong>{phase8LowValueBaseBalance.data ? "live wallet" : "blocked"}</strong>
                </span>
                <span>
                  Swaps/approvals
                  <strong>blocked</strong>
                </span>
              </div>
              <p>{phase8LowValueTransactionReadiness.message}</p>
              {phase8LowValueTransactionReadiness.reasons.length
                ? <small>{formatGateHint(phase8LowValueTransactionReadiness.reasons)}</small>
                : <small>Low-value review is owner-dashboard only. Execution still requires a separate submit gate.</small>}
            </div>
            <div className="phase-8-low-value-request-panel">
              <div className="result-monitoring-header">
                <span>Low-value request</span>
                <strong>{phase8LowValueSubmitRequest.ok ? "skeleton ready" : "blocked"}</strong>
              </div>
              <div className="phase-8-low-value-request-grid">
                <span>
                  Value
                  <strong>{phase8LowValueSubmitRequest.ok ? `${phase8LowValueSubmitRequest.request.value.toString()} wei` : "blocked"}</strong>
                </span>
                <span>
                  Chain
                  <strong>{phase8LowValueSubmitRequest.ok ? currentProductChain.name : "required"}</strong>
                </span>
                <span>
                  Owner only
                  <strong>{phase8LowValueSubmitRequest.ok ? "true" : "locked"}</strong>
                </span>
                <span>
                  Live {currentProductChain.name} balance
                  <strong>{baseAccountConnectionStatus.address && phase8LowValueBaseBalance.data ? `${formatPhase8BaseEth(phase8LowValueBaseBalance.data.value)} ETH` : phase8LowValueBaseBalance.isLoading ? "checking" : "required"}</strong>
                </span>
                <span>
                  Gas/value source
                  <strong>{phase8LowValueBaseBalance.data ? "live wallet" : "blocked"}</strong>
                </span>
              </div>
              <p>{phase8LowValueSubmitRequest.message}</p>
              {phase8LowValueSubmitRequest.ok
                ? <small>Low-value request is ready for the isolated owner-dashboard submitter. Telegram and public profiles remain blocked.</small>
                : <small>{formatGateHint(phase8LowValueSubmitRequest.reasons)}</small>}
            </div>
            <Phase8LowValueSubmitter
              readiness={phase8LowValueTransactionReadiness}
              submitRequest={phase8LowValueSubmitRequest}
              ownerWindowArmed={Boolean(activePhase8OwnerArming)}
              resultAlreadyRecorded={Boolean(phase8SubmitterResult)}
              securityCanOpenSubmitter={phase8SecurityAbuseHardening.canOpenSubmitter}
              securityBlockReasons={phase8SecurityAbuseHardening.reasons}
              closeoutScope={{
                ownerUserId: authSession?.user.id ?? "",
                workspaceId: dashboardData?.workspace.id ?? "",
                agentId: agentRecord?.id ?? "",
                preparedActionId: phase8FrozenAction?.requestId ?? "",
                submissionNonce: activePhase8OwnerArming?.submissionNonce ?? "",
              }}
              onResultCloseout={handlePhase8ResultCloseout}
            />
            <div className="phase-8-transaction-verification-panel">
              <div className="result-monitoring-header">
                <span>Transaction verification</span>
                <strong>{phase8TransactionVerification.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-8-transaction-verification-grid">
                <span>
                  Tx hash
                  <strong>{phase8TransactionVerification.txHashLabel}</strong>
                </span>
                <span>
                  Receipt
                  <strong>{phase8TransactionVerification.canPromoteToConfirmed ? "verified" : phase8TransactionVerification.status === "pending_receipt" ? "pending" : "locked"}</strong>
                </span>
                <span>
                  Confirmation
                  <strong>{phase8TransactionVerification.confirmationId ? "recorded" : "not recorded"}</strong>
                </span>
                <span>
                  Visibility
                  <strong>{phase8TransactionVerification.ownerOnly ? "owner-only" : "blocked"}</strong>
                </span>
              </div>
              <p>{phase8TransactionVerification.message}</p>
              {phase8TransactionVerification.reasons.length
                ? <small>{formatGateHint(phase8TransactionVerification.reasons)}</small>
                : <small>Receipt verification is owner-only. Telegram and public profiles cannot read or expose this state.</small>}
            </div>
            <div className="phase-8-production-closeout-panel">
              <div className="result-monitoring-header">
                <span>Production closeout</span>
                <strong>{phase8ProductionCloseout.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-8-production-closeout-grid">
                {phase8ProductionCloseout.checklist.map((item) => (
                  <span className={`closeout-${item.status}`} key={item.label}>
                    {item.label}
                    <strong>{item.status}</strong>
                    <small>{item.detail}</small>
                  </span>
                ))}
              </div>
              <p>{phase8ProductionCloseout.message}</p>
              {phase8ProductionCloseout.reasons.length
                ? <small>{formatGateHint(phase8ProductionCloseout.reasons)}</small>
                : <small>Closeout remains owner-only. Public execution requires the separate release gate.</small>}
            </div>
            <div className="phase-9-execution-eligibility-panel">
              <div className="result-monitoring-header">
                <span>Public execution eligibility</span>
                <strong>{phase9ExecutionEligibility.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-9-execution-eligibility-grid">
                {phase9ExecutionEligibility.controls.map((item) => (
                  <span className={`closeout-${item.status}`} key={item.label}>
                    {item.label}
                    <strong>{item.status}</strong>
                    <small>{item.detail}</small>
                  </span>
                ))}
              </div>
              <p>{phase9ExecutionEligibility.message}</p>
              {phase9ExecutionEligibility.reasons.length
                ? <small>{formatGateHint(phase9ExecutionEligibility.reasons)}</small>
                : <small>Public execution eligibility is available only inside the explicit release lane.</small>}
            </div>
            <div className="phase-9-abuse-rate-limit-panel">
              <div className="result-monitoring-header">
                <span>Abuse and rate limits</span>
                <strong>{phase9AbuseRateLimit.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-9-abuse-rate-limit-grid">
                {phase9AbuseRateLimit.controls.map((item) => (
                  <span className={`closeout-${item.status}`} key={item.label}>
                    {item.label}
                    <strong>{item.status}</strong>
                    <small>{item.detail}</small>
                  </span>
                ))}
              </div>
              <p>{phase9AbuseRateLimit.message}</p>
              {phase9AbuseRateLimit.reasons.length
                ? <small>{formatGateHint(phase9AbuseRateLimit.reasons)}</small>
                : <small>Abuse and rate-limit enforcement stays inside the explicit release lane.</small>}
            </div>
            <div className="phase-9-incident-controls-panel">
              <div className="result-monitoring-header">
                <span>Incident controls</span>
                <strong>{phase9IncidentControls.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-9-incident-controls-grid">
                {phase9IncidentControls.controls.map((item) => (
                  <span className={`closeout-${item.status}`} key={item.label}>
                    {item.label}
                    <strong>{item.status}</strong>
                    <small>{item.detail}</small>
                  </span>
                ))}
              </div>
              <p>{phase9IncidentControls.message}</p>
              {phase9IncidentControls.reasons.length
                ? <small>{formatGateHint(phase9IncidentControls.reasons)}</small>
                : <small>Incident controls stay inside the explicit release lane.</small>}
            </div>
            <div className="phase-9-monitoring-support-panel">
              <div className="result-monitoring-header">
                <span>Support readiness</span>
                <strong>{phase9MonitoringSupport.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-9-monitoring-support-grid">
                {phase9MonitoringSupport.controls.map((item) => (
                  <span className={`closeout-${item.status}`} key={item.label}>
                    {item.label}
                    <strong>{item.status}</strong>
                    <small>{item.detail}</small>
                  </span>
                ))}
              </div>
              <p>{phase9MonitoringSupport.message}</p>
              {phase9MonitoringSupport.reasons.length
                ? <small>{formatGateHint(phase9MonitoringSupport.reasons)}</small>
                : <small>Support evidence stays private until the release lane is approved.</small>}
            </div>
            <div className="phase-9-public-privacy-panel">
              <div className="result-monitoring-header">
                <span>Public privacy review</span>
                <strong>{phase9PublicPrivacyRelease.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-9-public-privacy-grid">
                {phase9PublicPrivacyRelease.controls.map((item) => (
                  <span className={`closeout-${item.status}`} key={item.label}>
                    {item.label}
                    <strong>{item.status}</strong>
                    <small>{item.detail}</small>
                  </span>
                ))}
              </div>
              <p>{phase9PublicPrivacyRelease.message}</p>
              {phase9PublicPrivacyRelease.reasons.length
                ? <small>{formatGateHint(phase9PublicPrivacyRelease.reasons)}</small>
                : <small>Public privacy review stays inside the explicit release approval lane.</small>}
            </div>
            <div className="phase-9-closeout-panel">
              <div className="result-monitoring-header">
                <span>Public release closeout</span>
                <strong>{phase9Closeout.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-9-closeout-grid">
                {phase9Closeout.controls.map((item) => (
                  <span className={`closeout-${item.status}`} key={item.label}>
                    {item.label}
                    <strong>{item.status}</strong>
                    <small>{item.detail}</small>
                  </span>
                ))}
              </div>
              <p>{phase9Closeout.message}</p>
              {phase9Closeout.reasons.length
                ? <small>{formatGateHint(phase9Closeout.reasons)}</small>
                : <small>Public execution hardening is complete. Access remains under explicit release approval.</small>}
            </div>
            <div className="phase-8-smoke-closeout-panel">
              <div className="result-monitoring-header">
                <span>Owner transaction closeout</span>
                <strong>{phase8SmokeCloseout.status.replace(/_/g, " ")}</strong>
              </div>
              <div className="phase-8-smoke-closeout-grid">
                <span>
                  Scope
                  <strong>{phase8SmokeCloseout.ownerOnly ? "owner-only" : "blocked"}</strong>
                </span>
                <span>
                  Tx hash
                  <strong>{phase8SmokeCloseout.txHashLabel}</strong>
                </span>
                <span>
                  Confirmation
                  <strong>{phase8SmokeCloseout.confirmationLabel}</strong>
                </span>
                <span>
                  Next gate
                  <strong>{phase8SmokeCloseout.canContinueToPublicHardening ? "ready" : "locked"}</strong>
                </span>
              </div>
              <p>{phase8SmokeCloseout.message}</p>
              {phase8SmokeCloseout.reasons.length
                ? <small>{formatGateHint(phase8SmokeCloseout.reasons)}</small>
                : <small>Smoke closeout is owner-only. Public profiles and Telegram cannot expose or submit this state.</small>}
            </div>
            </>) : (
              <div className="dashboard-public-owner-notice">
                <div className="result-monitoring-header">
                  <span>Owner console</span>
                  <strong>private</strong>
                </div>
                <p>Transaction controls, release readiness, closeout records, and wallet details are visible only after owner sign-in.</p>
                <small>Public visitors can view product status and deployed agent information without seeing operational internals.</small>
              </div>
            )}
            {authSession ? (
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
            ) : null}
          </section>

            </>
          ) : null}
          <section className="dashboard-panel" id="logs">
            <div className="panel-title">
              <span>Activity log</span>
              <span>release replay</span>
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
          </>
        )}
      </section>

      {resetConfirmOpen && isAdmin? (
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
                    Reset workspace records
                  </span>
                  <h3 id="reset-demo-workspace-title">Confirm workspace reset</h3>
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
                This deletes only the signed-in workspace records for this
                account. It does not touch global data, real funds, wallet keys,
                private keys, Telegram tokens, or any onchain transactions.
              </p>
              <div className="reset-scope-grid">
                <span>
                  Scope
                  <strong>Signed-in workspace</strong>
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
                a new agent is deployed.
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
