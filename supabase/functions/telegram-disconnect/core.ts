import {
  assertAgentId,
  assertAuthenticatedUserId,
  assertBearerAuthorization,
  assertBodySizeFromHeaders,
  assertJsonContentType,
  assertPostMethod,
  corsHeaders,
  HttpError,
  jsonResponse,
  readJsonObjectBody,
} from "../telegram-connect/core.ts";
import type { TelegramDisconnectRuntimeConfig } from "./runtime-config.ts";

export const maxTelegramDisconnectBodyBytes = 4096;

export type TelegramDisconnectAction = "pause" | "disconnect" | "revoke";

export interface TelegramDisconnectDependencies {
  disconnectRuntimeConfig?: TelegramDisconnectRuntimeConfig;
  getEnv?: (key: string) => string;
  getUser?: (
    supabaseUrl: string,
    anonKey: string,
    authorization: string,
  ) => Promise<unknown>;
}

export interface TelegramDisconnectRequestBody {
  agentId: string;
  action: TelegramDisconnectAction;
  reason?: string;
}

const disabledDisconnectRuntimeConfig: TelegramDisconnectRuntimeConfig = {
  enabled: false,
};

const allowedActions = new Set<TelegramDisconnectAction>([
  "pause",
  "disconnect",
  "revoke",
]);

const maxReasonLength = 160;

export async function handleTelegramDisconnectRequest(
  request: Request,
  dependencies: TelegramDisconnectDependencies = {},
) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    assertPostMethod(request, "telegram-disconnect");
    assertJsonContentType(request.headers);
    assertBodySizeFromHeaders(request.headers, maxTelegramDisconnectBodyBytes);

    const disconnectRuntimeConfig = dependencies.disconnectRuntimeConfig ??
      disabledDisconnectRuntimeConfig;

    if (!disconnectRuntimeConfig.enabled) {
      return notConfiguredResponse();
    }

    const authorization = assertBearerAuthorization(request);
    const getEnv = requireDependency(dependencies.getEnv);
    const getUser = requireDependency(dependencies.getUser);
    const supabaseUrl = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const user = await getUser(supabaseUrl, anonKey, authorization);
    assertAuthenticatedUserId(user);

    const body = await readJsonObjectBody(
      request,
      maxTelegramDisconnectBodyBytes,
    );
    assertTelegramDisconnectBody(body);

    return notConfiguredResponse();
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
        message: "Telegram disconnect function failed.",
      },
      500,
    );
  }
}

export function assertTelegramDisconnectBody(
  body: Record<string, unknown>,
): TelegramDisconnectRequestBody {
  const keys = Object.keys(body).sort().join(",");

  if (keys !== "action,agentId" && keys !== "action,agentId,reason") {
    throw invalidDisconnectRequest();
  }

  const agentId = assertAgentId(body.agentId);
  const action = assertTelegramDisconnectAction(body.action);
  const reason = assertTelegramDisconnectReason(body.reason);

  return reason === undefined
    ? { agentId, action }
    : { agentId, action, reason };
}

export function assertTelegramDisconnectAction(
  value: unknown,
): TelegramDisconnectAction {
  if (
    typeof value !== "string" ||
    !allowedActions.has(value as TelegramDisconnectAction)
  ) {
    throw invalidDisconnectRequest();
  }

  return value as TelegramDisconnectAction;
}

export function assertTelegramDisconnectReason(value: unknown) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw invalidDisconnectRequest();
  }

  const reason = value.trim();

  if (!reason) {
    return undefined;
  }

  if (reason.length > maxReasonLength) {
    throw invalidDisconnectRequest();
  }

  return reason;
}

function requireDependency<T>(dependency: T | undefined): T {
  if (!dependency) {
    throw new HttpError(
      500,
      "server_error",
      "Telegram disconnect is not configured safely.",
    );
  }

  return dependency;
}

function invalidDisconnectRequest() {
  return new HttpError(
    400,
    "invalid_request",
    "Telegram disconnect request is invalid.",
  );
}

function notConfiguredResponse() {
  return jsonResponse(
    {
      ok: false,
      status: "not_configured",
      message: "Telegram disconnect is planned but not enabled yet.",
    },
    501,
  );
}
