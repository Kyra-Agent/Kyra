import { HttpError } from "./core.ts";
import {
  buildTelegramTemplateContextReply,
  type TelegramTemplateContext,
} from "./template-context.ts";

export interface TelegramTemplateContextLookupResult<T> {
  data: T | null;
  error: unknown;
}

export interface TelegramTemplateContextLookupBuilder {
  select(columns: string): TelegramTemplateContextLookupBuilder;
  eq(column: string, value: string): TelegramTemplateContextLookupBuilder;
  limit<T>(
    count: number,
  ): Promise<TelegramTemplateContextLookupResult<T[]>>;
}

export interface TelegramTemplateContextLookupClient {
  from(
    table: "agent_instances" | "agent_templates",
  ): TelegramTemplateContextLookupBuilder;
}

export interface TelegramTemplateContextLookupOutput {
  context: TelegramTemplateContext;
  text: string;
}

interface AgentInstanceTemplateContextRow {
  id?: unknown;
  template_id?: unknown;
  display_name?: unknown;
}

interface AgentTemplateContextRow {
  id?: unknown;
  name?: unknown;
  role?: unknown;
  summary?: unknown;
  actions?: unknown;
  modules?: unknown;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function lookupTelegramTemplateContext(input: {
  agentId: unknown;
  serviceClient: TelegramTemplateContextLookupClient;
}): Promise<TelegramTemplateContextLookupOutput> {
  try {
    const agentId = readAgentId(input.agentId);
    const agent = await lookupAgentTemplateReference(
      input.serviceClient,
      agentId,
    );
    const template = await lookupAgentTemplate(
      input.serviceClient,
      agent.templateId,
    );

    return buildTelegramTemplateContextReply({
      templateId: template.id,
      name: agent.displayName || template.name,
      role: template.role,
      summary: template.summary,
      actions: template.actions,
      modules: template.modules,
    });
  } catch (error) {
    if (
      error instanceof HttpError &&
      (error.code === "agent_not_found" || error.code === "invalid_request")
    ) {
      throw error;
    }

    throw sanitizeTelegramTemplateContextLookupError(error);
  }
}

export function sanitizeTelegramTemplateContextLookupError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram template context lookup failed.",
  );
}

async function lookupAgentTemplateReference(
  serviceClient: TelegramTemplateContextLookupClient,
  agentId: string,
) {
  const { data, error } = await serviceClient
    .from("agent_instances")
    .select("id,template_id,display_name")
    .eq("id", agentId)
    .limit<AgentInstanceTemplateContextRow>(2);

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    throw new Error("Unexpected Telegram agent template lookup result.");
  }

  if (!data.length) {
    throw new HttpError(
      404,
      "agent_not_found",
      "Telegram agent was not found.",
    );
  }

  if (data.length > 1) {
    throw new Error("Unexpected duplicate Telegram agent rows.");
  }

  return mapAgentInstanceRow(data[0]);
}

async function lookupAgentTemplate(
  serviceClient: TelegramTemplateContextLookupClient,
  templateId: string,
) {
  const { data, error } = await serviceClient
    .from("agent_templates")
    .select("id,name,role,summary,actions,modules")
    .eq("id", templateId)
    .limit<AgentTemplateContextRow>(2);

  if (error) {
    throw error;
  }

  if (!Array.isArray(data)) {
    throw new Error("Unexpected Telegram template lookup result.");
  }

  if (data.length !== 1) {
    throw new Error("Unexpected Telegram template row count.");
  }

  return mapAgentTemplateRow(data[0]);
}

function mapAgentInstanceRow(value: unknown) {
  const row = readExactRecord(value, "display_name,id,template_id");

  return {
    id: readUuid(row.id),
    templateId: readTemplateId(row.template_id),
    displayName: readOptionalName(row.display_name),
  };
}

function mapAgentTemplateRow(value: unknown) {
  const row = readExactRecord(
    value,
    "actions,id,modules,name,role,summary",
  );

  return {
    id: readTemplateId(row.id),
    name: readTemplateText(row.name),
    role: readTemplateText(row.role),
    summary: readTemplateText(row.summary),
    actions: readStringArray(row.actions),
    modules: readStringArray(row.modules),
  };
}

function readAgentId(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new HttpError(
      400,
      "invalid_request",
      "agentId is invalid.",
    );
  }

  return value;
}

function readUuid(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error("Unexpected Telegram template context identifier.");
  }

  return value;
}

function readTemplateId(value: unknown) {
  if (typeof value !== "string" || !/^[a-z0-9_-]{2,48}$/i.test(value)) {
    throw new Error("Unexpected Telegram template identifier.");
  }

  return value.toLowerCase();
}

function readTemplateText(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("Unexpected Telegram template text.");
  }

  return value;
}

function readOptionalName(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value !== "string") {
    throw new Error("Unexpected Telegram agent display name.");
  }

  return value.trim() || null;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    throw new Error("Unexpected Telegram template list.");
  }

  return value;
}

function readExactRecord(value: unknown, expectedKeys: string) {
  if (!isPlainRecord(value)) {
    throw new Error("Unexpected Telegram template context row.");
  }

  if (Object.keys(value).sort().join(",") !== expectedKeys) {
    throw new Error("Unexpected Telegram template context row.");
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
