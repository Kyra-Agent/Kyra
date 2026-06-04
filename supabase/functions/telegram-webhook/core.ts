export class HttpError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

const telegramWebhookSecretHeader = "X-Telegram-Bot-Api-Secret-Token";
const telegramWebhookSecretHashPattern = /^[0-9a-f]{64}$/;
export const maxTelegramWebhookBodyBytes = 131072;

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-telegram-bot-api-secret-token",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface TelegramWebhookSessionLookupRecord {
  sessionId: string;
  agentId: string;
  workspaceId: string;
  ownerUserId: string;
  botHandle?: string | null;
  webhookStatus: string;
}

export interface TelegramWebhookSessionLookupRpcRow {
  session_id?: unknown;
  agent_id?: unknown;
  workspace_id?: unknown;
  owner_user_id?: unknown;
  bot_handle?: unknown;
  webhook_status?: unknown;
}

export interface TelegramWebhookSessionLookupRpcResult {
  data?: unknown;
  error?: unknown | null;
}

export type TelegramWebhookCommandKind = "read_only" | "write" | "approval";

export interface TelegramWebhookChatIdentity {
  telegramUserId?: string | number | null;
  telegramChatId?: string | number | null;
}

export interface TelegramWebhookPersonalChatPolicy {
  mode: "personal";
  ownerTelegramUserId?: string | number | null;
  ownerTelegramChatId?: string | number | null;
}

export interface TelegramWebhookCommunityChatPolicy {
  mode: "community";
  allowedTelegramUserIds?: readonly (string | number)[];
  allowedTelegramChatIds?: readonly (string | number)[];
  adminTelegramUserIds?: readonly (string | number)[];
  adminTelegramChatIds?: readonly (string | number)[];
  allowPublicReadOnly?: boolean;
}

export type TelegramWebhookChatAuthorizationPolicy =
  | TelegramWebhookPersonalChatPolicy
  | TelegramWebhookCommunityChatPolicy;

export interface TelegramWebhookChatAuthorization {
  authorized: true;
  role: "owner" | "admin" | "member" | "public_read_only";
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

  return "Telegram webhook function failed.";
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

export function assertWebhookSecretHeader(request: Request) {
  const secret = request.headers.get(telegramWebhookSecretHeader);

  if (!secret?.trim()) {
    throw new HttpError(
      401,
      "webhook_verification_failed",
      "Telegram webhook verification failed.",
    );
  }

  return secret.trim();
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
    throw new HttpError(
      413,
      "payload_too_large",
      "Request body is too large.",
    );
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

export async function readTelegramWebhookUpdateBody(request: Request) {
  return await readJsonObjectBody(request, maxTelegramWebhookBodyBytes);
}

export function assertTelegramWebhookSecretHash(value: unknown) {
  if (typeof value !== "string") {
    throw new HttpError(
      400,
      "invalid_request",
      "webhookSecretHash is invalid.",
    );
  }

  const webhookSecretHash = value.trim();

  if (!telegramWebhookSecretHashPattern.test(webhookSecretHash)) {
    throw new HttpError(
      400,
      "invalid_request",
      "webhookSecretHash is invalid.",
    );
  }

  return webhookSecretHash;
}

export function assertActiveTelegramWebhookSession(
  session: TelegramWebhookSessionLookupRecord | null,
) {
  if (!session || session.webhookStatus !== "active") {
    throw new HttpError(
      404,
      "session_not_found",
      "Telegram webhook session was not found.",
    );
  }

  return session;
}

export function assertTelegramWebhookSessionLookupRows(
  rows: unknown,
) {
  if (rows === null || rows === undefined) {
    return assertActiveTelegramWebhookSession(null);
  }

  if (!Array.isArray(rows)) {
    throw sanitizeTelegramWebhookSessionLookupError(
      new Error("Unexpected Telegram webhook session lookup result."),
    );
  }

  if (!rows.length) {
    return assertActiveTelegramWebhookSession(null);
  }

  if (rows.length > 1) {
    throw sanitizeTelegramWebhookSessionLookupError(
      new Error("Unexpected Telegram webhook session lookup result."),
    );
  }

  return assertActiveTelegramWebhookSession(
    mapTelegramWebhookSessionRow(rows[0]),
  );
}

export function assertTelegramWebhookSessionLookupResult(
  result: TelegramWebhookSessionLookupRpcResult,
) {
  if (result.error) {
    throw sanitizeTelegramWebhookSessionLookupError(result.error);
  }

  return assertTelegramWebhookSessionLookupRows(result.data);
}

export function sanitizeTelegramWebhookSessionLookupError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram webhook session lookup failed.",
  );
}

export function assertTelegramWebhookChatAuthorized(
  identity: TelegramWebhookChatIdentity,
  policy: TelegramWebhookChatAuthorizationPolicy,
  commandKind: TelegramWebhookCommandKind = "read_only",
): TelegramWebhookChatAuthorization {
  const telegramUserId = normalizeTelegramId(identity.telegramUserId);
  const telegramChatId = normalizeTelegramId(identity.telegramChatId);

  if (!telegramUserId && !telegramChatId) {
    throw new HttpError(
      400,
      "invalid_update",
      "Telegram update is missing chat identity.",
    );
  }

  if (policy.mode === "personal") {
    const ownerUserId = normalizeTelegramId(policy.ownerTelegramUserId);
    const ownerChatId = normalizeTelegramId(policy.ownerTelegramChatId);

    if (
      (ownerUserId && telegramUserId === ownerUserId) ||
      (ownerChatId && telegramChatId === ownerChatId)
    ) {
      return { authorized: true, role: "owner" };
    }

    throw new HttpError(
      403,
      "chat_not_authorized",
      "Telegram chat is not authorized.",
    );
  }

  const isAdmin = includesTelegramId(
    policy.adminTelegramUserIds,
    telegramUserId,
  ) || includesTelegramId(policy.adminTelegramChatIds, telegramChatId);

  if (isAdmin) {
    return { authorized: true, role: "admin" };
  }

  if (commandKind !== "read_only") {
    throw new HttpError(
      403,
      "chat_not_authorized",
      "Telegram chat is not authorized.",
    );
  }

  const isAllowedMember = includesTelegramId(
    policy.allowedTelegramUserIds,
    telegramUserId,
  ) || includesTelegramId(policy.allowedTelegramChatIds, telegramChatId);

  if (isAllowedMember) {
    return { authorized: true, role: "member" };
  }

  if (policy.allowPublicReadOnly) {
    return { authorized: true, role: "public_read_only" };
  }

  throw new HttpError(
    403,
    "chat_not_authorized",
    "Telegram chat is not authorized.",
  );
}

function mapTelegramWebhookSessionRow(
  row: TelegramWebhookSessionLookupRpcRow | undefined,
): TelegramWebhookSessionLookupRecord {
  try {
    if (!row) {
      throw new Error("Missing row.");
    }

    const botHandle = row.bot_handle;

    if (
      botHandle !== undefined && botHandle !== null &&
      typeof botHandle !== "string"
    ) {
      throw new Error("Invalid bot handle.");
    }

    return {
      sessionId: readRequiredLookupString(row.session_id),
      agentId: readRequiredLookupString(row.agent_id),
      workspaceId: readRequiredLookupString(row.workspace_id),
      ownerUserId: readRequiredLookupString(row.owner_user_id),
      botHandle: botHandle ?? null,
      webhookStatus: readRequiredLookupString(row.webhook_status),
    };
  } catch (error) {
    throw sanitizeTelegramWebhookSessionLookupError(error);
  }
}

function readRequiredLookupString(value: unknown) {
  if (typeof value !== "string") {
    throw new Error("Expected string.");
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error("Expected non-empty string.");
  }

  return normalized;
}

function normalizeTelegramId(value: string | number | null | undefined) {
  if (typeof value === "number") {
    return Number.isSafeInteger(value) ? String(value) : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized ? normalized : null;
}

function includesTelegramId(
  values: readonly (string | number)[] | null | undefined,
  target: string | null,
) {
  if (!target || !values?.length) {
    return false;
  }

  return values.some((value) => normalizeTelegramId(value) === target);
}
