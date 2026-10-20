export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details: Record<string, unknown>;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface AgentSettingsRequestBody {
  agentId: string;
  settings: unknown;
}

export interface OwnedAgentRow {
  id: string;
  workspace_id: string;
  template_id: string;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertAgentSettingsBody(value: unknown): AgentSettingsRequestBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_request", "Send the agent and its settings.");
  }

  const body = value as Record<string, unknown>;

  if (typeof body.agentId !== "string" || !uuidPattern.test(body.agentId)) {
    throw new HttpError(400, "invalid_request", "Choose a deployed agent.");
  }

  if (!body.settings || typeof body.settings !== "object" || Array.isArray(body.settings)) {
    throw new HttpError(400, "invalid_request", "Settings must be an object.");
  }

  return { agentId: body.agentId, settings: body.settings };
}

// The agent must exist and sit in a workspace the caller owns. Anything else
// is reported as not found so other accounts' agents are never confirmed.
export function assertOwnedAgent(
  agent: unknown,
  workspaceOwnerId: unknown,
  userId: string,
): OwnedAgentRow {
  if (
    !agent || typeof agent !== "object" || Array.isArray(agent) ||
    workspaceOwnerId !== userId
  ) {
    throw new HttpError(404, "agent_not_found", "This agent was not found in your workspace.");
  }

  const row = agent as Record<string, unknown>;

  if (
    typeof row.id !== "string" || typeof row.workspace_id !== "string" ||
    typeof row.template_id !== "string"
  ) {
    throw new HttpError(404, "agent_not_found", "This agent was not found in your workspace.");
  }

  return {
    id: row.id,
    workspace_id: row.workspace_id,
    template_id: row.template_id,
  };
}

export function readTemplateActions(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}
