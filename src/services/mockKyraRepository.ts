import {
  demoActivityLogs,
  demoAgentInstances,
  demoApprovalRequests,
  demoBackendTables,
  demoWalletPolicies,
  demoWorkspace,
  getDemoAgentInstance,
} from "../data/demoBackend";
import { demoScenarios } from "../data/demoScenarios";
import { agentTemplates } from "../data/templates";
import { createApiError, createApiSuccess } from "../lib/apiResponse";
import type { KyraRepository } from "./kyraRepository";

export const mockKyraRepository: KyraRepository = {
  source: "mock",

  getWorkspace() {
    return createApiSuccess(demoWorkspace, this.source);
  },

  listTemplates() {
    return createApiSuccess(agentTemplates, this.source);
  },

  getTemplate(templateId) {
    const template = agentTemplates.find((item) => item.id === templateId);

    if (!template) {
      return createApiError(
        {
          code: "template_not_found",
          message: `No Kyra template exists for id "${templateId}".`,
        },
        this.source,
      );
    }

    return createApiSuccess(template, this.source);
  },

  listScenarios() {
    return createApiSuccess(demoScenarios, this.source);
  },

  getScenario(scenarioId) {
    const scenario = demoScenarios.find((item) => item.id === scenarioId);

    if (!scenario) {
      return createApiError(
        {
          code: "scenario_not_found",
          message: `No demo scenario exists for id "${scenarioId}".`,
        },
        this.source,
      );
    }

    return createApiSuccess(scenario, this.source);
  },

  listAgentInstances() {
    return createApiSuccess(demoAgentInstances, this.source);
  },

  getAgentInstance(templateId) {
    return createApiSuccess(getDemoAgentInstance(templateId), this.source);
  },

  listApprovalRequests() {
    return createApiSuccess(demoApprovalRequests, this.source);
  },

  listWalletPolicies() {
    return createApiSuccess(demoWalletPolicies, this.source);
  },

  listActivityLogs() {
    return createApiSuccess(demoActivityLogs, this.source);
  },

  listBackendTables() {
    return createApiSuccess(demoBackendTables, this.source);
  },
};
