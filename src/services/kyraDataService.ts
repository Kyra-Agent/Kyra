import type { DemoAgentInstance, DemoApprovalRequest, DemoActivityLog } from "../types/backend";
import { unwrapApiResponse } from "../lib/apiResponse";
import { getKyraRepository } from "./repositoryFactory";

const repository = getKyraRepository();

function formatActivityLog(log: DemoActivityLog) {
  const sourceLabel =
    {
      agent_instances: "agent",
      telegram_sessions: "telegram",
      base_mcp_routes: "base action",
      approval_requests: "approval",
      execution_results: "execution",
    }[log.source] ?? "demo";

  return `[${log.timestamp}] ${sourceLabel}: ${log.message}`;
}

function sortRequestsByTemplate(templateId: string, requests: DemoApprovalRequest[]) {
  return [
    ...requests.filter((request) => request.templateId === templateId),
    ...requests.filter((request) => request.templateId !== templateId),
  ];
}

export const kyraDataService = {
  source: repository.source,

  getWorkspace() {
    return unwrapApiResponse(repository.getWorkspace());
  },

  listTemplates() {
    return unwrapApiResponse(repository.listTemplates());
  },

  getTemplate(templateId: string) {
    return unwrapApiResponse(repository.getTemplate(templateId));
  },

  listScenarios() {
    return unwrapApiResponse(repository.listScenarios());
  },

  getScenario(scenarioId: string) {
    return unwrapApiResponse(repository.getScenario(scenarioId));
  },

  listAgentInstances() {
    return unwrapApiResponse(repository.listAgentInstances());
  },

  getAgentInstance(templateId: string) {
    return unwrapApiResponse(repository.getAgentInstance(templateId));
  },

  listApprovalRequests() {
    return unwrapApiResponse(repository.listApprovalRequests());
  },

  listPriorityApprovalRequests(templateId: string, limit: number) {
    return sortRequestsByTemplate(templateId, this.listApprovalRequests()).slice(0, limit);
  },

  listWalletPolicies() {
    return unwrapApiResponse(repository.listWalletPolicies());
  },

  getApprovalPolicyForAgent(agent: DemoAgentInstance) {
    return this.listWalletPolicies().find((policy) => policy.id === agent.approvalPolicyId);
  },

  listActivityLogs() {
    return unwrapApiResponse(repository.listActivityLogs());
  },

  listActivityLines(extraLines: string[] = []) {
    return this.listActivityLogs().map(formatActivityLog).concat(extraLines);
  },

  listBackendTables() {
    return unwrapApiResponse(repository.listBackendTables());
  },
};
