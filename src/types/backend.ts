export type DemoBackendMode = "frontend-demo" | "backend-demo";
export type DemoRecordStatus =
  | "mocked"
  | "active"
  | "queued"
  | "read-only"
  | "review";
export type DemoTelegramWebhookStatus =
  | "mocked"
  | "queued"
  | "active"
  | "paused";

export interface DemoWorkspaceRecord {
  id: string;
  name: string;
  owner: string;
  mode: DemoBackendMode;
  authProvider: "demo" | "supabase";
}

export interface DemoAgentInstance {
  id: string;
  workspaceId: string;
  templateId: string;
  displayName: string;
  handle: string;
  publicPath: string;
  status: "online" | "draft" | "paused";
  mode: DemoBackendMode;
  network: "Base";
  telegramStatus: DemoRecordStatus;
  baseMcpStatus: DemoRecordStatus;
  approvalPolicyId: string;
  createdAt: string;
  lastSyncAt: string;
}

export interface DemoTelegramSessionSummary {
  id: string;
  agentId: string;
  botHandle: string | null;
  webhookStatus: DemoTelegramWebhookStatus;
  createdAt: string;
  lastEventAt: string | null;
}

export interface DemoApprovalRequest {
  id: string;
  agentId: string;
  templateId: string;
  scenarioId: string;
  title: string;
  command: string;
  route: string;
  risk: "normal" | "review" | "read-only";
  status:
    | "waiting_wallet"
    | "read_only_ready"
    | "review_required"
    | "approved"
    | "rejected";
  feePayer: "connected_wallet";
  requiresWallet: boolean;
  createdAt: string;
}

export interface DemoWalletPolicy {
  id: string;
  label: string;
  value: string;
  status: "active" | "simulated";
  description: string;
}

export type DemoWalletReadinessState =
  | "not_connected"
  | "connected_wrong_network"
  | "connected_ready_for_approval"
  | "execution_disabled";

export interface DemoWalletReadiness {
  state: DemoWalletReadinessState;
  label: string;
  addressLabel: string;
  network: "Base" | "Base pending";
  approvalGate: "Required" | "Optional" | "Not created";
  execution: "Disabled" | "Ready for approval" | "Blocked";
  nextAction: string;
  privacyNote: string;
}

export interface DemoWalletProviderStatus {
  providerStack: "Wagmi + Viem";
  dependencyStatus: "installed" | "not_installed";
  runtimeGate: "disabled" | "enabled";
  promptAccess: "disabled" | "owner_click_only";
  connectorPriority: string[];
  safetyNote: string;
}

export type DemoPreparedActionStatus = "blocked" | "draft" | "preview_ready";

export interface DemoPreparedActionPreview {
  id: string;
  status: DemoPreparedActionStatus;
  actionKind: "base_mcp_status_check" | "quote_preview";
  title: string;
  chain: "Base";
  routeSummary: string;
  valueSummary: string;
  risk: "read-only" | "review";
  expiresLabel: string;
  approvalRequirement: string;
  ownerScope: string;
  safetyNote: string;
}

export interface DemoActivityLog {
  id: string;
  timestamp: string;
  source:
    | "agent_instances"
    | "telegram_sessions"
    | "base_mcp_routes"
    | "approval_requests";
  level: "info" | "notice" | "warning";
  message: string;
}

export interface DemoBackendTable {
  name: string;
  records: number;
  status: DemoRecordStatus;
  purpose: string;
}
