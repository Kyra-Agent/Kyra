export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface RemoveAgentRequestBody {
  agentId: string;
  confirmation: "remove_agent";
}

export interface RemoveOwnedAgentRpcRow {
  ok: boolean;
  status: string;
  display_name: string | null;
  remaining_count: number | null;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function assertRemoveAgentBody(value: unknown): RemoveAgentRequestBody {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new HttpError(400, "invalid_request", "Remove agent request is invalid.");
  }

  const body = value as Record<string, unknown>;
  const keys = Object.keys(body).sort();

  if (keys.length !== 2 || keys[0] !== "agentId" || keys[1] !== "confirmation") {
    throw new HttpError(400, "invalid_request", "Remove agent request is invalid.");
  }

  if (typeof body.agentId !== "string" || !uuidPattern.test(body.agentId)) {
    throw new HttpError(400, "invalid_agent_id", "Select a valid deployed agent.");
  }

  if (body.confirmation !== "remove_agent") {
    throw new HttpError(400, "confirmation_required", "Explicit agent removal confirmation is required.");
  }

  return {
    agentId: body.agentId,
    confirmation: "remove_agent",
  };
}

export function assertRemoveOwnedAgentRpcRow(value: unknown): RemoveOwnedAgentRpcRow {
  const row = Array.isArray(value) ? value[0] : value;

  if (!row || typeof row !== "object" || Array.isArray(row)) {
    throw new HttpError(500, "invalid_backend_response", "Agent removal backend returned an invalid response.");
  }

  const payload = row as Record<string, unknown>;

  if (
    typeof payload.ok !== "boolean" ||
    typeof payload.status !== "string" ||
    (payload.display_name !== null && typeof payload.display_name !== "string") ||
    (payload.remaining_count !== null && typeof payload.remaining_count !== "number")
  ) {
    throw new HttpError(500, "invalid_backend_response", "Agent removal backend returned an invalid response.");
  }

  return payload as unknown as RemoveOwnedAgentRpcRow;
}

export function getRemoveAgentFailure(status: string): HttpError {
  switch (status) {
    case "not_found":
      return new HttpError(404, status, "Agent was not found in this account workspace.");
    case "telegram_disconnect_required":
      return new HttpError(409, status, "Disconnect and revoke this agent's Telegram connection before removing it.");
    case "execution_history_present":
      return new HttpError(409, status, "This agent has protected approval or transaction evidence and cannot be removed.");
    case "agent_active":
      return new HttpError(409, status, "Pause active onchain execution before removing this agent.");
    case "invalid_request":
      return new HttpError(400, status, "Remove agent request is invalid.");
    default:
      return new HttpError(500, "remove_failed", "Kyra could not safely remove this agent.");
  }
}

export function sanitizeErrorMessage(message: string) {
  return message
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "sb_secret_[hidden]")
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "sb_publishable_[hidden]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "jwt_[hidden]")
    .slice(0, 240);
}
