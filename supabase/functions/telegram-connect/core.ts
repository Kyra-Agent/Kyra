export interface TelegramConnectRequest {
  agentId?: unknown;
  botToken?: unknown;
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

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export interface TelegramConnectDependencies {
  getEnv: (key: string) => string;
  getUser: (supabaseUrl: string, anonKey: string, authorization: string) => Promise<unknown>;
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
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "jwt_[hidden]")
    .slice(0, 240);
}

export function getUnknownErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error) {
    const payload = error as Record<string, unknown>;
    const parts = [payload.message, payload.details, payload.hint, payload.code]
      .filter((part): part is string => typeof part === "string" && Boolean(part.trim()))
      .map((part) => part.trim());

    if (parts.length) {
      return parts.join(" ");
    }
  }

  return "Telegram connect function failed.";
}

export function assertPostMethod(request: Request, functionName: string) {
  if (request.method !== "POST") {
    throw new HttpError(405, "method_not_allowed", `Use POST for ${functionName}.`);
  }
}

export function assertBearerAuthorization(request: Request) {
  const authorization = request.headers.get("Authorization") ?? "";

  if (!authorization.toLowerCase().startsWith("bearer ")) {
    throw new HttpError(401, "unauthorized", "A valid Supabase session is required.");
  }

  return authorization;
}

export function assertJsonContentType(headers: Headers) {
  const contentType = headers.get("content-type") ?? "";
  const mediaType = contentType.split(";")[0]?.trim().toLowerCase();

  if (mediaType !== "application/json" && !mediaType.endsWith("+json")) {
    throw new HttpError(415, "unsupported_media_type", "Content-Type must be application/json.");
  }
}

export function assertBodySizeFromHeaders(headers: Headers, maxBytes: number) {
  const contentLength = headers.get("content-length");

  if (!contentLength) {
    return;
  }

  const parsedLength = Number(contentLength);

  if (!Number.isSafeInteger(parsedLength) || parsedLength < 0) {
    throw new HttpError(400, "invalid_request", "Content-Length must be a valid byte size.");
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
      throw new HttpError(413, "payload_too_large", "Request body is too large.");
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
    throw new HttpError(400, "invalid_request", "Request body must be valid JSON.");
  }
}

export async function readTelegramConnectBody(request: Request): Promise<TelegramConnectRequest> {
  return await readJsonObjectBody(request, maxTelegramConnectBodyBytes);
}

export function assertAgentId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "invalid_request", "agentId is required.");
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

    await dependencies.getUser(supabaseUrl, anonKey, authorization);

    const body = await readTelegramConnectBody(request);

    assertAgentId(body.agentId);

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
