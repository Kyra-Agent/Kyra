export interface TelegramConnectRequest {
  agentId?: unknown;
  botToken?: unknown;
  mode?: unknown;
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

export interface StoreTelegramBotTokenInput {
  agentId: string;
  ownerUserId: string;
  telegramBotId: string;
  botToken: string;
}

export interface StoreTelegramBotTokenResult {
  tokenSecretRef: string;
  provider?: string;
}

export interface PersistTelegramSessionInput {
  agentId: string;
  botHandle: string;
  tokenSecretRef: string;
}

export interface PersistTelegramSessionResult {
  telegramSessionId: string;
}

export interface RevokeTelegramBotTokenInput {
  tokenSecretRef: string;
}

export type TelegramConnectSuccessStatus =
  | "validated"
  | "review"
  | "queued"
  | "active";

export interface RegisterTelegramWebhookInput {
  telegramSessionId: string;
  agentId: string;
  ownerUserId: string;
  telegramBotId: string;
  botHandle: string;
  botToken: string;
  tokenSecretRef: string;
  webhookUrl: string;
  webhookSecretToken: string;
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

export interface TelegramSessionPersistenceRow {
  id: string;
}

export interface TelegramSessionPersistenceResult<T> {
  data: T | null;
  error: unknown;
}

export interface TelegramSessionPersistenceBuilder {
  select: (columns: string) => TelegramSessionPersistenceBuilder;
  update: (
    values: Record<string, unknown>,
  ) => TelegramSessionPersistenceBuilder;
  eq: (
    column: string,
    value: unknown,
  ) => TelegramSessionPersistenceBuilder;
  is: (
    column: string,
    value: unknown,
  ) => TelegramSessionPersistenceBuilder;
  limit: <T>(
    count: number,
  ) => Promise<TelegramSessionPersistenceResult<T[]>>;
  maybeSingle: <T>() => Promise<TelegramSessionPersistenceResult<T>>;
}

export interface TelegramSessionPersistenceClient {
  from: (table: string) => TelegramSessionPersistenceBuilder;
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
export const telegramConnectStoreEnabledEnvKey =
  "KYRA_TELEGRAM_CONNECT_STORE_ENABLED";
export const telegramConnectSessionWriteEnabledEnvKey =
  "KYRA_TELEGRAM_CONNECT_SESSION_WRITE_ENABLED";
export const telegramConnectWebhookRegisterEnabledEnvKey =
  "KYRA_TELEGRAM_CONNECT_WEBHOOK_REGISTER_ENABLED";
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const botTokenPattern = /^\d{5,20}:[A-Za-z0-9_-]{20,128}$/;
const tokenSecretRefPattern = /^[A-Za-z0-9][A-Za-z0-9:_-]{15,255}$/;

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
  lookupActiveTelegramBotConnection?: (
    telegramBotId: string,
  ) => Promise<boolean>;
  storeTelegramBotToken?: (
    input: StoreTelegramBotTokenInput,
  ) => Promise<StoreTelegramBotTokenResult>;
  persistTelegramSession?: (
    input: PersistTelegramSessionInput,
  ) => Promise<PersistTelegramSessionResult>;
  revokeTelegramBotToken?: (
    input: RevokeTelegramBotTokenInput,
  ) => Promise<void>;
  getTelegramWebhookUrl?: () => Promise<string> | string;
  generateTelegramWebhookSecret?: () => Promise<string> | string;
  registerTelegramWebhook?: (
    input: RegisterTelegramWebhookInput,
  ) => Promise<void>;
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

export function isTelegramConnectStoreEnabled(
  value: string | null | undefined,
) {
  return value === "true";
}

export function isTelegramConnectSessionWriteEnabled(
  value: string | null | undefined,
) {
  return value === "true";
}

export function isTelegramConnectWebhookRegisterEnabled(
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

function isTelegramTokenValidationMode(value: unknown) {
  return value === "validate_token";
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

export function assertStoredTokenSecretRef(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(
      503,
      "secret_store_unavailable",
      "Telegram token secret store returned an invalid response.",
    );
  }

  const tokenSecretRef = value.trim();

  if (!tokenSecretRefPattern.test(tokenSecretRef)) {
    throw new HttpError(
      503,
      "secret_store_unavailable",
      "Telegram token secret store returned an invalid response.",
    );
  }

  return tokenSecretRef;
}

export function formatTelegramBotHandle(username: string) {
  const handle = username.trim().replace(/^@+/, "");

  if (!handle) {
    throw new HttpError(
      422,
      "telegram_validation_failed",
      "Telegram bot token could not be validated.",
    );
  }

  return `@${handle}`;
}

export function sanitizeTelegramTokenStorageError(error: unknown) {
  if (error instanceof HttpError && error.code === "secret_store_unavailable") {
    return new HttpError(
      503,
      "secret_store_unavailable",
      "Telegram token secret store is unavailable.",
    );
  }

  if (
    error instanceof HttpError &&
    (error.statusCode === 409 || error.code === "duplicate_bot_active")
  ) {
    return new HttpError(
      409,
      "duplicate_bot_active",
      "Telegram bot is already connected.",
    );
  }

  return new HttpError(
    500,
    "server_error",
    "Telegram token storage failed.",
  );
}

export function sanitizeTelegramDuplicateLookupError(error: unknown) {
  if (
    error instanceof HttpError &&
    (error.statusCode === 409 || error.code === "duplicate_bot_active")
  ) {
    return new HttpError(
      409,
      "duplicate_bot_active",
      "Telegram bot is already connected.",
    );
  }

  return new HttpError(
    500,
    "server_error",
    "Telegram bot duplicate check failed.",
  );
}

export function sanitizeTelegramSessionPersistenceError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram session persistence failed.",
  );
}

export function sanitizeTelegramWebhookRegistrationError(_error: unknown) {
  return new HttpError(
    424,
    "webhook_registration_failed",
    "Telegram webhook registration failed.",
  );
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

export async function persistTelegramSessionRecord(
  serviceClient: TelegramSessionPersistenceClient,
  input: PersistTelegramSessionInput,
) {
  const { data: sessions, error: lookupError } = await serviceClient
    .from("telegram_sessions")
    .select("id")
    .eq("agent_id", input.agentId)
    .eq("webhook_status", "mocked")
    .is("token_secret_ref", null)
    .limit<TelegramSessionPersistenceRow>(2);

  if (lookupError) {
    throw lookupError;
  }

  if (!Array.isArray(sessions) || sessions.length !== 1) {
    throw new Error("Expected one mock Telegram session.");
  }

  const sessionId = sessions[0]?.id;

  if (typeof sessionId !== "string" || !sessionId) {
    throw new Error("Telegram session id was not found.");
  }

  const { data: updated, error: updateError } = await serviceClient
    .from("telegram_sessions")
    .update({
      bot_handle: input.botHandle,
      webhook_status: "queued",
      token_secret_ref: input.tokenSecretRef,
    })
    .eq("id", sessionId)
    .eq("agent_id", input.agentId)
    .eq("webhook_status", "mocked")
    .is("token_secret_ref", null)
    .select("id")
    .maybeSingle<TelegramSessionPersistenceRow>();

  if (updateError) {
    throw updateError;
  }

  if (!updated) {
    throw new Error("Telegram session was not updated.");
  }

  if (updated.id !== sessionId) {
    throw new Error("Telegram session update returned an unexpected row.");
  }

  return { telegramSessionId: updated.id };
}

function assertTelegramSessionId(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw new Error("Telegram session id was invalid.");
  }

  return value;
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

function throwWebhookRegistrationNotConfigured(): never {
  throw new HttpError(
    500,
    "server_error",
    "Telegram webhook registration is not configured safely.",
  );
}

function assertWebhookRegistrationRuntimeValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throwWebhookRegistrationNotConfigured();
  }

  return value.trim();
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

    if (isTelegramTokenValidationMode(body.mode)) {
      if (!dependencies.validateTelegramBotToken) {
        return jsonResponse(
          {
            ok: false,
            status: "not_configured",
            message: "Telegram token validation is not enabled yet.",
          },
          501,
        );
      }

      const botToken = assertBotToken(body.botToken);

      try {
        const bot = await dependencies.validateTelegramBotToken(botToken);
        const telegramBot = assertTelegramBotValidationResult(bot);
        const botHandle = formatTelegramBotHandle(telegramBot.username);

        if (dependencies.lookupActiveTelegramBotConnection) {
          let duplicateActive: boolean;

          try {
            duplicateActive = await dependencies
              .lookupActiveTelegramBotConnection(telegramBot.telegramBotId);
          } catch (error) {
            throw sanitizeTelegramDuplicateLookupError(error);
          }

          if (duplicateActive) {
            throw new HttpError(
              409,
              "duplicate_bot_active",
              "Telegram bot is already connected.",
            );
          }
        }

        return telegramConnectSuccessResponse("validated", botHandle);
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

    let botToken: string | null = null;
    let telegramBot: TelegramBotValidationResult | null = null;
    let botHandle: string | null = null;
    let tokenSecretRef: string | null = null;
    let telegramSessionId: string | null = null;
    let connectSuccessStatus: TelegramConnectSuccessStatus | null = null;

    if (dependencies.validateTelegramBotToken) {
      botToken = assertBotToken(body.botToken);

      try {
        const bot = await dependencies.validateTelegramBotToken(botToken);
        telegramBot = assertTelegramBotValidationResult(bot);
        botHandle = formatTelegramBotHandle(telegramBot.username);
        connectSuccessStatus = "validated";
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

    if (dependencies.storeTelegramBotToken) {
      if (!botToken || !telegramBot) {
        throw new HttpError(
          500,
          "server_error",
          "Telegram token storage is not configured safely.",
        );
      }

      try {
        const storedToken = await dependencies.storeTelegramBotToken({
          agentId,
          ownerUserId: userId,
          telegramBotId: telegramBot.telegramBotId,
          botToken,
        });
        tokenSecretRef = assertStoredTokenSecretRef(
          storedToken.tokenSecretRef,
        );
        connectSuccessStatus = "review";
      } catch (error) {
        throw sanitizeTelegramTokenStorageError(error);
      }
    }

    if (dependencies.persistTelegramSession) {
      if (!telegramBot || !botHandle || !tokenSecretRef) {
        throw new HttpError(
          500,
          "server_error",
          "Telegram session persistence is not configured safely.",
        );
      }

      try {
        const persistedSession = await dependencies.persistTelegramSession({
          agentId,
          botHandle,
          tokenSecretRef,
        });
        telegramSessionId = assertTelegramSessionId(
          persistedSession.telegramSessionId,
        );
        connectSuccessStatus = "queued";
      } catch (error) {
        if (dependencies.revokeTelegramBotToken) {
          try {
            await dependencies.revokeTelegramBotToken({ tokenSecretRef });
          } catch {
            // Best-effort cleanup only. Never expose rollback internals.
          }
        }

        throw sanitizeTelegramSessionPersistenceError(error);
      }
    }

    if (
      dependencies.getTelegramWebhookUrl ||
      dependencies.generateTelegramWebhookSecret ||
      dependencies.registerTelegramWebhook
    ) {
      if (
        !botToken ||
        !telegramBot ||
        !botHandle ||
        !tokenSecretRef ||
        !telegramSessionId ||
        !dependencies.persistTelegramSession ||
        !dependencies.getTelegramWebhookUrl ||
        !dependencies.generateTelegramWebhookSecret ||
        !dependencies.registerTelegramWebhook
      ) {
        throwWebhookRegistrationNotConfigured();
      }

      try {
        const webhookUrl = assertWebhookRegistrationRuntimeValue(
          await dependencies.getTelegramWebhookUrl(),
        );
        const webhookSecretToken = assertWebhookRegistrationRuntimeValue(
          await dependencies.generateTelegramWebhookSecret(),
        );

        await dependencies.registerTelegramWebhook({
          telegramSessionId,
          agentId,
          ownerUserId: userId,
          telegramBotId: telegramBot.telegramBotId,
          botHandle,
          botToken,
          tokenSecretRef,
          webhookUrl,
          webhookSecretToken,
        });
        connectSuccessStatus = "active";
      } catch (error) {
        if (
          error instanceof HttpError &&
          error.message ===
            "Telegram webhook registration is not configured safely."
        ) {
          throw error;
        }

        throw sanitizeTelegramWebhookRegistrationError(error);
      }
    }

    if (connectSuccessStatus) {
      return telegramConnectSuccessResponse(connectSuccessStatus, botHandle);
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

function telegramConnectSuccessResponse(
  status: TelegramConnectSuccessStatus,
  botHandle: string | null,
) {
  const response: Record<string, unknown> = {
    ok: true,
    status,
    message: telegramConnectSuccessMessage(status),
  };

  if (botHandle) {
    response.botHandle = botHandle;
  }

  if (status === "queued" || status === "active") {
    response.webhookStatus = status;
  }

  return jsonResponse(response, 200);
}

function telegramConnectSuccessMessage(status: TelegramConnectSuccessStatus) {
  switch (status) {
    case "validated":
      return "Telegram bot token validated. Connection is not active yet.";
    case "review":
      return "Telegram connection validated. Activation requires backend finalization.";
    case "queued":
      return "Telegram connection queued for webhook activation.";
    case "active":
      return "Telegram connection active.";
  }
}
