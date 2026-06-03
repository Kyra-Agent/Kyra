export interface TelegramConnectRequest {
  agentId?: unknown;
  botToken?: unknown;
}

export interface AuthenticatedUser {
  id: string;
}

export interface AgentOwnershipRecord {
  agentId: string;
  ownerUserId: string;
  workspaceId: string;
}

export interface TelegramBotValidationResult {
  telegramBotId: string;
  username: string;
  firstName: string;
  canJoinGroups?: boolean;
  canReadAllGroupMessages?: boolean;
}

export interface OwnershipLookupAgentRow {
  id: string;
  workspace_id: string;
}

export interface OwnershipLookupWorkspaceRow {
  id: string;
  owner_user_id: string;
}

export interface OwnershipLookupResult<T> {
  data: T | null;
  error: unknown;
}

export interface OwnershipLookupBuilder {
  select: (columns: string) => OwnershipLookupBuilder;
  eq: (column: string, value: string) => OwnershipLookupBuilder;
  maybeSingle: <T>() => Promise<OwnershipLookupResult<T>>;
}

export interface OwnershipLookupClient {
  from: (table: string) => OwnershipLookupBuilder;
}

export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const maxTelegramConnectBodyBytes = 8192;
export const telegramConnectGetMeEnabledEnvKey =
  "KYRA_TELEGRAM_CONNECT_GETME_ENABLED";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const botTokenPattern = /^\d{5,20}:[A-Za-z0-9_-]{20,128}$/;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface TelegramConnectDependencies {
  getEnv: (key: string) => string;
  getUser: (
    supabaseUrl: string,
    anonKey: string,
    authorization: string,
  ) => Promise<unknown>;
  lookupAgentOwnership?: (
    agentId: string,
    ownerUserId: string,
  ) => Promise<AgentOwnershipRecord | null>;
  validateTelegramBotToken?: (
    botToken: string,
  ) => Promise<TelegramBotValidationResult>;
}

export function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

export function sanitizeErrorMessage(message: string) {
  return message
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, "sb_secret_[hidden]")
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "sb_publishable_[hidden]")
    .replace(
      /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
      "jwt_[hidden]",
    )
    .slice(0, 240);
}

export function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error) {
    const payload = error as Record<string, unknown>;
    const parts = [payload.message, payload.details, payload.hint, payload.code]
      .filter((part): part is string =>
        typeof part === "string" && Boolean(part.trim())
      )
      .map((part) => part.trim());

    if (parts.length) {
      return parts.join(" ");
    }
  }

  return "Telegram connect function failed.";
}

export function isTelegramConnectGetMeEnabled(
  value: string | null | undefined,
) {
  return value === "true";
}

export function assertPostMethod(request: Request, functionName: string) {
  if (request.method !== "POST") {
    throw new HttpError(
      405,
      "method_not_allowed",
      `Use POST for ${functionName}.`,
    );
  }
}

export function assertBearerAuthorization(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(
      401,
      "unauthorized",
      "A valid Supabase session is required.",
    );
  }

  return authorization;
}

export function assertJsonContentType(headers: Headers) {
  const contentType = headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();

  if (mediaType !== "application/json" && !mediaType.endsWith("+json")) {
    throw new HttpError(
      415,
      "unsupported_media_type",
      "Content-Type must be application/json.",
    );
  }
}

export function assertBodySizeFromHeaders(headers: Headers, maxBytes: number) {
  const contentLength = headers.get("content-length");

  if (!contentLength) {
    return;
  }

  const parsedLength = Number(contentLength);

  if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
    throw new HttpError(
      400,
      "invalid_request",
      "Content-Length must be a valid byte size.",
    );
  }

  if (parsedLength > maxBytes) {
    throw new HttpError(413, "payload_too_large", "Request body is too large.");
  }
}

async function readTextBodyWithLimit(request: Request, maxBytes: number) {
  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new HttpError(
        413,
        "payload_too_large",
        "Request body is too large.",
      );
    }

    chunks.push(value);
  }

  const bodyBytes = new Uint8Array(totalBytes);
  let offset = 0;

  for (const chunk of chunks) {
    bodyBytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return new TextDecoder().decode(bodyBytes);
}

export async function readJsonObjectBody(
  request: Request,
  maxBytes: number,
): Promise<Record<string, unknown>> {
  const text = await readTextBodyWithLimit(request, maxBytes);

  try {
    const payload = JSON.parse(text);

    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      throw new Error("Expected object payload.");
    }

    return payload as Record<string, unknown>;
  } catch {
    throw new HttpError(
      400,
      "invalid_request",
      "Request body must be valid JSON.",
    );
  }
}

export async function readTelegramConnectBody(
  request: Request,
): Promise<TelegramConnectRequest> {
  return await readJsonObjectBody(request, maxTelegramConnectBodyBytes);
}

export function assertAgentId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "invalid_request", "agentId is required.");
  }

  const agentId = value.trim();

  if (!uuidPattern.test(agentId)) {
    throw new HttpError(400, "invalid_request", "agentId is invalid.");
  }

  return agentId;
}

export function assertBotToken(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "invalid_request", "botToken is required.");
  }

  const botToken = value.trim();

  if (!botTokenPattern.test(botToken)) {
    throw new HttpError(400, "invalid_request", "botToken is invalid.");
  }

  return botToken;
}

export function assertTelegramBotValidationResult(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new HttpError(
      422,
      "telegram_validation_failed",
      "Telegram bot token could not be validated.",
    );
  }

  const result = value as Record<string, unknown>;
  const telegramBotId = typeof result.telegramBotId === "string"
    ? result.telegramBotId.trim()
    : "";
  const username = typeof result.username === "string"
    ? result.username.trim()
    : "";
  const firstName = typeof result.firstName === "string"
    ? result.firstName.trim()
    : "";

  if (!telegramBotId || !username || !firstName) {
    throw new HttpError(
      422,
      "telegram_validation_failed",
      "Telegram bot token could not be validated.",
    );
  }

  return {
    telegramBotId,
    username,
    firstName,
    canJoinGroups: typeof result.canJoinGroups === "boolean"
      ? result.canJoinGroups
      : undefined,
    canReadAllGroupMessages: typeof result.canReadAllGroupMessages === "boolean"
      ? result.canReadAllGroupMessages
      : undefined,
  };
}

export async function lookupAgentOwnershipRecord(
  serviceClient: OwnershipLookupClient,
  agentId: string,
): Promise<AgentOwnershipRecord | null> {
  const { data: agent, error: agentError } = await serviceClient
    .from("agent_instances")
    .select("id,workspace_id")
    .eq("id", agentId)
    .maybeSingle<OwnershipLookupAgentRow>();

  if (agentError) {
    throw agentError;
  }

  if (!agent) {
    return null;
  }

  const { data: workspace, error: workspaceError } = await serviceClient
    .from("workspaces")
    .select("id,owner_user_id")
    .eq("id", agent.workspace_id)
    .maybeSingle<OwnershipLookupWorkspaceRow>();

  if (workspaceError) {
    throw workspaceError;
  }

  if (!workspace) {
    throw new Error("Ownership workspace was not found.");
  }

  return {
    agentId: agent.id,
    ownerUserId: workspace.owner_user_id,
    workspaceId: workspace.id,
  };
}

export function assertAuthenticatedUserId(value: unknown) {
  if (!value || typeof value !== "object") {
    throw new HttpError(
      401,
      "unauthorized",
      "A valid Supabase session is required.",
    );
  }

  const user = value as Record<string, unknown>;

  if (typeof user.id !== "string" || !user.id.trim()) {
    throw new HttpError(
      401,
      "unauthorized",
      "A valid Supabase session is required.",
    );
  }

  return user.id.trim();
}

export function assertAgentOwnership(
  agentId: string,
  ownerUserId: string,
  ownership: AgentOwnershipRecord | null,
) {
  if (!ownership) {
    throw new HttpError(404, "agent_not_found", "Agent was not found.");
  }

  if (ownership.agentId !== agentId) {
    throw new Error("Ownership lookup returned an unexpected agent.");
  }

  if (ownership.ownerUserId !== ownerUserId) {
    throw new HttpError(
      403,
      "forbidden",
      "Agent does not belong to the signed-in user.",
    );
  }

  return {
    agentId: ownership.agentId,
  };
}

export async function handleTelegramConnectRequest(
  request: Request,
  dependencies: TelegramConnectDependencies,
) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    assertPostMethod(request, "telegram-connect");

    const authorization = assertBearerAuthorization(request);

    assertJsonContentType(request.headers);
    assertBodySizeFromHeaders(request.headers, maxTelegramConnectBodyBytes);

    const supabaseUrl = dependencies.getEnv("SUPABASE_URL");
    const anonKey = dependencies.getEnv("SUPABASE_ANON_KEY");

    const user = await dependencies.getUser(
      supabaseUrl,
      anonKey,
      authorization,
    );
    const userId = assertAuthenticatedUserId(user);

    const body = await readTelegramConnectBody(request);

    const agentId = assertAgentId(body.agentId);

    if (dependencies.lookupAgentOwnership) {
      let ownership: AgentOwnershipRecord | null;

      try {
        ownership = await dependencies.lookupAgentOwnership(agentId, userId);
      } catch {
        throw new HttpError(
          500,
          "server_error",
          "Telegram connect ownership lookup failed.",
        );
      }

      assertAgentOwnership(agentId, userId, ownership);
    }

    if (dependencies.validateTelegramBotToken) {
      const botToken = assertBotToken(body.botToken);

      try {
        const bot = await dependencies.validateTelegramBotToken(botToken);
        assertTelegramBotValidationResult(bot);
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }

        throw new HttpError(
          500,
          "server_error",
          "Telegram bot token validation failed.",
        );
      }
    }

    return jsonResponse(
      {
        ok: false,
        status: "not_configured",
        message: "Telegram connect is planned but not enabled yet.",
      },
      501,
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        {
          ok: false,
          status: error.code,
          message: error.message,
        },
        error.statusCode,
      );
    }

    return jsonResponse(
      {
        ok: false,
        status: "server_error",
        message: sanitizeErrorMessage(getUnknownErrorMessage(error)),
      },
      500,
    );
  }
}
