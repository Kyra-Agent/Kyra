import type { AgentTemplate } from "../types/agent";
import type {
  DemoActivityLog,
  DemoAgentInstance,
  DemoApprovalRequest,
  DemoBackendTable,
  DemoWalletPolicy,
  DemoWorkspaceRecord,
} from "../types/backend";
import type { DemoScenario } from "../data/demoScenarios";
import type { ApiResponse, DataProvider } from "../types/api";

export interface KyraRepository {
  source: DataProvider;
  getWorkspace(): ApiResponse<DemoWorkspaceRecord>;
  listTemplates(): ApiResponse<AgentTemplate[]>;
  getTemplate(templateId: string): ApiResponse<AgentTemplate>;
  listScenarios(): ApiResponse<DemoScenario[]>;
  getScenario(scenarioId: string): ApiResponse<DemoScenario>;
  listAgentInstances(): ApiResponse<DemoAgentInstance[]>;
  getAgentInstance(templateId: string): ApiResponse<DemoAgentInstance>;
  listApprovalRequests(): ApiResponse<DemoApprovalRequest[]>;
  listWalletPolicies(): ApiResponse<DemoWalletPolicy[]>;
  listActivityLogs(): ApiResponse<DemoActivityLog[]>;
  listBackendTables(): ApiResponse<DemoBackendTable[]>;
}
