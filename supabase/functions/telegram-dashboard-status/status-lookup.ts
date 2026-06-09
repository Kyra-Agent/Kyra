import { assertAgentId, HttpError } from "../telegram-connect/core.ts";
import type {
  TelegramDashboardStatusRecord,
  TelegramDashboardWebhookStatus,
} from "./core.ts";

export interface TelegramDashboardStatusLookupResult<T> {
  data: T | null;
  error: unknown;
}

export interface TelegramDashboardStatusLookupBuilder {
  select(columns: string): TelegramDashboardStatusLookupBuilder;
  eq(column: string, value: string): TelegramDashboardStatusLookupBuilder;
  is(column: string, value: null): TelegramDashboardStatusLookupBuilder;
  in(column: string, values: string[]): TelegramDashboardStatusLookupBuilder;
  order(
    column: string,
    options: { ascending: boolean },
  ): TelegramDashboardStatusLookupBuilder;
  limit<T>(
    count: number,
  ): Promise<TelegramDashboardStatusLookupResult<T[]>>;
}

export interface TelegramDashboardStatusLookupClient {
  from(
    table:
      | "agent_instances"
      | "workspaces"
      | "telegram_sessions"
      | "telegram_chat_authorizations",
  ): TelegramDashboardStatusLookupBuilder;
}

interface AgentRow {
  id?: unknown;
  workspace_id?: unknown;
}

interface WorkspaceRow {
  id?: unknown;
  owner_user_id?: unknown;
}

interface TelegramSessionRow {
  agent_id?: unknown;
  bot_handle?: unknown;
  webhook_status?: unknown;
  created_at?: unknown;
  last_event_at?: unknown;
}

interface TelegramChatAuthorizationRow {
  agent_id?: unknown;
  role?: unknown;
  command_scope?: unknown;
  revoked_at?: unknown;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const botHandlePattern = /^@[A-Za-z0-9_]{5,32}$/;

export async function lookupTelegramDashboardStatuses(input: {
  agentIds: string[];
  ownerUserId: string;
  serviceClient: TelegramDashboardStatusLookupClient;
}): Promise<TelegramDashboardStatusRecord[]> {
  try {
    const agentIds = readAgentIds(input.agentIds);
    const ownerUserId = readUuid(input.ownerUserId);
    const agents = await lookupOwnedAgents(input.serviceClient, agentIds, ownerUserId);
    const authorizedAgentIds = await lookupOwnerLinkedAgentIds(input.serviceClient, agentIds);
    const sessions = await lookupTelegramSessions(input.serviceClient, agentIds);

    return mapDashboardStatuses(agentIds, agents, sessions, authorizedAgentIds);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw sanitizeTelegramDashboardStatusLookupError(error);
  }
}

export function sanitizeTelegramDashboardStatusLookupError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram dashboard status lookup failed.",
  );
}

async function lookupOwnedAgents(
  serviceClient: TelegramDashboardStatusLookupClient,
  agentIds: string[],
  ownerUserId: string,
) {
  const { data: agentRows, error: agentError } = await serviceClient
    .from("agent_instances")
    .select("id,workspace_id")
    .in("id", agentIds)
    .limit<AgentRow>(agentIds.length + 1);

  if (agentError) {
    throw agentError;
  }

  const agents = mapUniqueRowsById(agentRows, mapAgentRow, "agent");

  for (const agentId of agentIds) {
    if (!agents.has(agentId)) {
      throw new HttpError(
        404,
        "agent_not_found",
        "Telegram dashboard status agent was not found.",
      );
    }
  }

  const workspaceIds = Array.from(
    new Set(Array.from(agents.values()).map((agent) => agent.workspaceId)),
  );
  const { data: workspaceRows, error: workspaceError } = await serviceClient
    .from("workspaces")
    .select("id,owner_user_id")
    .in("id", workspaceIds)
    .limit<WorkspaceRow>(workspaceIds.length + 1);

  if (workspaceError) {
    throw workspaceError;
  }

  const workspaces = mapUniqueRowsById(workspaceRows, mapWorkspaceRow, "workspace");

  for (const agent of agents.values()) {
    const workspace = workspaces.get(agent.workspaceId);

    if (!workspace) {
      throw new Error("Telegram dashboard status workspace was not found.");
    }

    if (workspace.ownerUserId !== ownerUserId) {
      throw new HttpError(
        403,
        "forbidden",
        "Telegram dashboard status is not available for this agent.",
      );
    }
  }

  return agents;
}

async function lookupTelegramSessions(
  serviceClient: TelegramDashboardStatusLookupClient,
  agentIds: string[],
) {
  const { data, error } = await serviceClient
    .from("telegram_sessions")
    .select("agent_id,bot_handle,webhook_status,created_at,last_event_at")
    .in("agent_id", agentIds)
    .order("created_at", { ascending: false })
    .limit<TelegramSessionRow>(agentIds.length * 4);

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    throw new Error("Unexpected Telegram dashboard session result.");
  }

  return data.map(mapTelegramSessionRow);
}

async function lookupOwnerLinkedAgentIds(
  serviceClient: TelegramDashboardStatusLookupClient,
  agentIds: string[],
) {
  const { data, error } = await serviceClient
    .from("telegram_chat_authorizations")
    .select("agent_id,role,command_scope,revoked_at")
    .in("agent_id", agentIds)
    .eq("role", "owner")
    .eq("command_scope", "read_only")
    .is("revoked_at", null)
    .limit<TelegramChatAuthorizationRow>(agentIds.length + 1);

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    throw new Error("Unexpected Telegram dashboard authorization result.");
  }

  const linkedAgentIds = new Set<string>();

  for (const row of data) {
    const authorization = mapTelegramChatAuthorizationRow(row);

    if (linkedAgentIds.has(authorization.agentId)) {
      throw new Error("Unexpected duplicate Telegram authorization row.");
    }

    linkedAgentIds.add(authorization.agentId);
  }

  return linkedAgentIds;
}

function mapDashboardStatuses(
  agentIds: string[],
  _agents: Map<string, { agentId: string; workspaceId: string }>,
  sessions: Array<{
    agentId: string;
    botHandle: string | null;
    webhookStatus: TelegramDashboardWebhookStatus;
    createdAt: string;
    lastEventAt: string | null;
  }>,
  authorizedAgentIds: Set<string>,
) {
  const selectedSessions = new Map<string, (typeof sessions)[number]>();

  for (const session of sessions) {
    if (!agentIds.includes(session.agentId)) {
      throw new Error("Unexpected Telegram dashboard session agent.");
    }

    const current = selectedSessions.get(session.agentId);

    if (!current || compareTelegramSessionPriority(session, current) < 0) {
      selectedSessions.set(session.agentId, session);
    }
  }

  return agentIds.flatMap((agentId) => {
    const session = selectedSessions.get(agentId);

    if (!session) {
      return [];
    }

    const ownerChatLinked = authorizedAgentIds.has(agentId);

    return [
      {
        agentId,
        botHandle: session.botHandle,
        webhookStatus: session.webhookStatus,
        ownerChatLinked,
        ownerLinkAvailable: session.webhookStatus === "active" && !ownerChatLinked,
        lastEventAt: session.lastEventAt,
      },
    ];
  });
}

function compareTelegramSessionPriority(
  left: { webhookStatus: TelegramDashboardWebhookStatus; createdAt: string },
  right: { webhookStatus: TelegramDashboardWebhookStatus; createdAt: string },
) {
  const rankDifference = getTelegramSessionRank(left.webhookStatus) -
    getTelegramSessionRank(right.webhookStatus);

  if (rankDifference !== 0) {
    return rankDifference;
  }

  return Date.parse(right.createdAt) - Date.parse(left.createdAt);
}

function getTelegramSessionRank(status: TelegramDashboardWebhookStatus) {
  if (status === "active") {
    return 0;
  }

  if (status === "queued") {
    return 1;
  }

  if (status === "paused") {
    return 2;
  }

  return 3;
}

function mapUniqueRowsById<T>(
  rows: unknown,
  mapper: (row: unknown) => { id: string } & T,
  label: string,
) {
  if (!Array.isArray(rows)) {
    throw new Error(`Unexpected Telegram dashboard ${label} result.`);
  }

  const mapped = new Map<string, { id: string } & T>();

  for (const row of rows) {
    const value = mapper(row);

    if (mapped.has(value.id)) {
      throw new Error(`Unexpected duplicate Telegram dashboard ${label} row.`);
    }

    mapped.set(value.id, value);
  }

  return mapped;
}

function mapAgentRow(value: unknown) {
  const row = readExactRecord(value, "id,workspace_id");

  return {
    id: readUuid(row.id),
    agentId: readUuid(row.id),
    workspaceId: readUuid(row.workspace_id),
  };
}

function mapWorkspaceRow(value: unknown) {
  const row = readExactRecord(value, "id,owner_user_id");

  return {
    id: readUuid(row.id),
    ownerUserId: readUuid(row.owner_user_id),
  };
}

function mapTelegramSessionRow(value: unknown) {
  const row = readExactRecord(
    value,
    "agent_id,bot_handle,created_at,last_event_at,webhook_status",
  );

  return {
    agentId: readUuid(row.agent_id),
    botHandle: readBotHandle(row.bot_handle),
    webhookStatus: readWebhookStatus(row.webhook_status),
    createdAt: readIsoTimestamp(row.created_at),
    lastEventAt: readNullableIsoTimestamp(row.last_event_at),
  };
}

function mapTelegramChatAuthorizationRow(value: unknown) {
  const row = readExactRecord(
    value,
    "agent_id,command_scope,revoked_at,role",
  );
  const agentId = readUuid(row.agent_id);

  if (row.role !== "owner" || row.command_scope !== "read_only" || row.revoked_at !== null) {
    throw new Error("Unexpected Telegram dashboard authorization row.");
  }

  return { agentId };
}

function readAgentIds(value: unknown) {
  if (!Array.isArray(value) || value.length < 1 || value.length > 20) {
    throw sanitizeTelegramDashboardStatusLookupError(
      new Error("Unexpected Telegram dashboard status agent input."),
    );
  }

  const agentIds = value.map((agentId) => {
    try {
      return assertAgentId(agentId);
    } catch {
      throw sanitizeTelegramDashboardStatusLookupError(
        new Error("Unexpected Telegram dashboard status agent input."),
      );
    }
  });

  if (new Set(agentIds).size !== agentIds.length) {
    throw sanitizeTelegramDashboardStatusLookupError(
      new Error("Unexpected Telegram dashboard status duplicate agent input."),
    );
  }

  return agentIds;
}

function readUuid(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error("Unexpected Telegram dashboard identifier.");
  }

  return value;
}

function readBotHandle(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" && botHandlePattern.test(value)) {
    return value;
  }

  throw new Error("Unexpected Telegram dashboard bot handle.");
}

function readWebhookStatus(value: unknown): TelegramDashboardWebhookStatus {
  if (
    value === "mocked" ||
    value === "queued" ||
    value === "active" ||
    value === "paused"
  ) {
    return value;
  }

  throw new Error("Unexpected Telegram dashboard webhook status.");
}

function readIsoTimestamp(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Unexpected Telegram dashboard timestamp.");
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error("Unexpected Telegram dashboard timestamp.");
  }

  return new Date(timestamp).toISOString();
}

function readNullableIsoTimestamp(value: unknown) {
  if (value === null) {
    return null;
  }

  return readIsoTimestamp(value);
}

function readExactRecord(value: unknown, expectedKeys: string) {
  if (!isPlainRecord(value)) {
    throw new Error("Unexpected Telegram dashboard row.");
  }

  if (Object.keys(value).sort().join(",") !== expectedKeys) {
    throw new Error("Unexpected Telegram dashboard row.");
  }

  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
