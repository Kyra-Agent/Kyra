import { demoScenarios } from "./demoScenarios";
import { agentTemplates } from "./templates";
import type {
  DemoActivityLog,
  DemoAgentInstance,
  DemoApprovalRequest,
  DemoBackendTable,
  DemoExecutionResult,
  DemoWalletPolicy,
  DemoWorkspaceRecord,
} from "../types/backend";

export const demoWorkspace: DemoWorkspaceRecord = {
  id: "wksp_kyra_demo",
  name: "Kyra demo workspace",
  owner: "Kyra-Agent",
  mode: "frontend-demo",
  authProvider: "demo",
};

export const demoWalletPolicies: DemoWalletPolicy[] = [
  {
    id: "policy_base_account",
    label: "Base Account",
    value: "0x8a...91c",
    status: "gated",
    description: "Demo connection only. No wallet prompt or funds touched.",
  },
  {
    id: "policy_daily_limit",
    label: "Daily limit",
    value: "100 USDC",
    status: "gated",
    description: "Demo spending cap for future policy storage.",
  },
  {
    id: "policy_approval_gate",
    label: "Approval gate",
    value: "Required",
    status: "active",
    description:
      "Every wallet or onchain action stays blocked until an explicit owner approval path exists.",
  },
];

export const demoAgentInstances: DemoAgentInstance[] = agentTemplates.map((
  template,
  index,
) => ({
  id: `agent_${template.id}_profile`,
  workspaceId: demoWorkspace.id,
  templateId: template.id,
  displayName: `Kyra ${template.name}`,
  handle: `@kyra_${template.id}`,
  publicPath: `/agents/${template.id}-demo`,
  status: template.status === "coming-soon" ? "draft" : "online",
  mode: "frontend-demo",
  network: "Base",
  telegramStatus: template.status === "coming-soon" ? "queued" : "mocked",
  baseMcpStatus: template.status === "coming-soon" ? "queued" : "mocked",
  approvalPolicyId: "policy_approval_gate",
  createdAt: `2026-05-31T05:${String(14 + index).padStart(2, "0")}:00Z`,
  lastSyncAt: `2026-05-31T05:${String(34 + index).padStart(2, "0")}:00Z`,
}));

export function getDemoAgentInstance(templateId: string) {
  return (
    demoAgentInstances.find((agent) => agent.templateId === templateId) ??
      demoAgentInstances[0]
  );
}

export const demoApprovalRequests: DemoApprovalRequest[] = demoScenarios.map(
  (scenario, index) => {
    const agent = getDemoAgentInstance(scenario.templateId);

    return {
      id: `approval_${scenario.id}_demo`,
      agentId: agent.id,
      templateId: scenario.templateId,
      scenarioId: scenario.id,
      title: scenario.id === "swap"
        ? "Swap review draft"
        : scenario.id === "verify"
        ? "Holder verification"
        : scenario.id === "scan"
        ? "Launch scan"
        : "Launch policy draft",
      command: scenario.command,
      route: scenario.route,
      risk: scenario.risk,
      status: scenario.approvalRequired
        ? "waiting_wallet"
        : scenario.risk === "read-only"
        ? "read_only_ready"
        : "review_required",
      feePayer: "connected_wallet",
      requiresWallet: scenario.approvalRequired,
      createdAt: `2026-05-31T05:${String(42 + index).padStart(2, "0")}:00Z`,
    };
  },
);

export const demoActivityLogs: DemoActivityLog[] = [
  {
    id: "log_agent_compiled",
    timestamp: "12:04:18",
    source: "agent_instances",
    level: "info",
    message: "agent profile compiled",
  },
  {
    id: "log_telegram_linked",
    timestamp: "12:04:19",
    source: "telegram_sessions",
    level: "notice",
    message: "Telegram interface linked in protected mode",
  },
  {
    id: "log_base_mcp_registered",
    timestamp: "12:04:21",
    source: "base_mcp_routes",
    level: "notice",
    message: "Base action route prepared",
  },
  {
    id: "log_command_received",
    timestamp: "12:05:02",
    source: "telegram_sessions",
    level: "info",
    message: "command received: review 10 USDC to ETH swap",
  },
  {
    id: "log_context_loaded",
    timestamp: "12:05:03",
    source: "base_mcp_routes",
    level: "info",
    message: "NOVA-04 balance context loaded",
  },
  {
    id: "log_risk_passed",
    timestamp: "12:05:04",
    source: "approval_requests",
    level: "notice",
    message: "NYX-05 risk review required",
  },
  {
    id: "log_approval_simulated",
    timestamp: "12:05:05",
    source: "approval_requests",
    level: "warning",
    message: "review draft recorded; wallet execution disabled",
  },
  {
    id: "log_waiting_wallet",
    timestamp: "12:05:06",
    source: "approval_requests",
    level: "notice",
    message: "status: waiting for future owner approval path",
  },
  {
    id: "log_execution_pending",
    timestamp: "12:05:07",
    source: "execution_results",
    level: "notice",
    message: "execution result pending; no transaction hash recorded",
  },
  {
    id: "log_execution_sanitized_failure",
    timestamp: "12:05:08",
    source: "execution_results",
    level: "warning",
    message: "failure state stores sanitized copy only",
  },
];

export const demoExecutionResults: DemoExecutionResult[] = [
  {
    id: "execution_swap_pending_review",
    preparedActionId: "demo-swap-handoff",
    agentId: getDemoAgentInstance("operator").id,
    status: "pending",
    label: "Pending owner review",
    summary: "Prepared action is waiting for explicit owner approval.",
    txHashLabel: "Not submitted",
    failureReason: null,
    visibility: "owner-only",
    updatedAt: "12:05:07",
  },
  {
    id: "execution_rejection_review",
    preparedActionId: "demo-rejected-handoff",
    agentId: getDemoAgentInstance("operator").id,
    status: "rejected",
    label: "Rejected safely",
    summary: "Owner rejection closes the action without wallet submission.",
    txHashLabel: "No transaction hash",
    failureReason: null,
    visibility: "owner-only",
    updatedAt: "12:05:08",
  },
  {
    id: "execution_failure_review",
    preparedActionId: "demo-failed-handoff",
    agentId: getDemoAgentInstance("operator").id,
    status: "failed",
    label: "Sanitized failure",
    summary: "Provider and Base errors collapse into safe user-facing copy.",
    txHashLabel: "No transaction hash before submission",
    failureReason: "Wallet must be connected to Base.",
    visibility: "owner-only",
    updatedAt: "12:05:09",
  },
];

export const demoBackendTables: DemoBackendTable[] = [
  {
    name: "workspaces",
    records: 1,
    status: "mocked",
    purpose: "Account owner, auth mode, and workspace scope.",
  },
  {
    name: "agent_instances",
    records: demoAgentInstances.length,
    status: "mocked",
    purpose: "Template, handle, public route, status, and Base network.",
  },
  {
    name: "approval_requests",
    records: demoApprovalRequests.length,
    status: "mocked",
    purpose:
      "Command, route, risk, review state, and wallet approval boundary.",
  },
  {
    name: "wallet_policies",
    records: demoWalletPolicies.length,
    status: "mocked",
    purpose: "Connected wallet label, spending limit, and approval gate.",
  },
  {
    name: "activity_logs",
    records: demoActivityLogs.length,
    status: "mocked",
    purpose: "Replayable server-style logs for the dashboard stream.",
  },
  {
    name: "execution_results",
    records: demoExecutionResults.length,
    status: "mocked",
    purpose:
      "Owner-only execution state trail with transaction hashes only after submission.",
  },
];
