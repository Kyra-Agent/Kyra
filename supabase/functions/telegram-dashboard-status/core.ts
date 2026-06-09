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
import type { TelegramDashboardStatusRuntimeConfig } from "./runtime-config.ts";

export const maxTelegramDashboardStatusBodyBytes = 4096;
export const maxTelegramDashboardStatusAgentIds = 20;

export type TelegramDashboardWebhookStatus =
  | "mocked"
  | "queued"
  | "active"
  | "paused";

export interface TelegramDashboardStatusRecord {
  agentId: string;
  botHandle: string | null;
  webhookStatus: TelegramDashboardWebhookStatus;
  ownerChatLinked: boolean;
  ownerLinkAvailable: boolean;
  lastEventAt: string | null;
}

export interface TelegramDashboardStatusDependencies {
  dashboardStatusRuntimeConfig?: TelegramDashboardStatusRuntimeConfig;
  getEnv?: (key: string) => string;
  getUser?: (
    supabaseUrl: string,
    anonKey: string,
    authorization: string,
  ) => Promise<unknown>;
  lookupDashboardTelegramStatuses?: (input: {
    agentIds: string[];
    ownerUserId: string;
  }) => Promise<TelegramDashboardStatusRecord[]>;
}

const disabledDashboardStatusRuntimeConfig:
  TelegramDashboardStatusRuntimeConfig = { enabled: false };

export async function handleTelegramDashboardStatusRequest(
  request: Request,
  dependencies: TelegramDashboardStatusDependencies = {},
) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    assertPostMethod(request, "telegram-dashboard-status");
    assertJsonContentType(request.headers);
    assertBodySizeFromHeaders(
      request.headers,
      maxTelegramDashboardStatusBodyBytes,
    );

    const runtimeConfig = dependencies.dashboardStatusRuntimeConfig ??
      disabledDashboardStatusRuntimeConfig;

    if (!runtimeConfig.enabled) {
      return notConfiguredResponse();
    }

    const authorization = assertBearerAuthorization(request);
    const getEnv = requireDependency(dependencies.getEnv);
    const getUser = requireDependency(dependencies.getUser);
    const lookupDashboardTelegramStatuses = requireDependency(
      dependencies.lookupDashboardTelegramStatuses,
    );
    const supabaseUrl = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const user = await getUser(supabaseUrl, anonKey, authorization);
    const ownerUserId = assertAuthenticatedUserId(user);
    const body = await readJsonObjectBody(
      request,
      maxTelegramDashboardStatusBodyBytes,
    );
    const agentIds = assertTelegramDashboardStatusBody(body);
    let telegramStatuses: TelegramDashboardStatusRecord[];

    try {
      telegramStatuses = await lookupDashboardTelegramStatuses({
        agentIds,
        ownerUserId,
      });
    } catch (error) {
      if (error instanceof HttpError) {
        throw error;
      }

      throw new HttpError(
        500,
        "server_error",
        "Telegram dashboard status lookup failed.",
      );
    }

    return jsonResponse({
      ok: true,
      status: "ready",
      telegramStatuses: assertTelegramDashboardStatuses(
        telegramStatuses,
        agentIds,
      ),
    });
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
        message: "Telegram dashboard status function failed.",
      },
      500,
    );
  }
}

export function assertTelegramDashboardStatusBody(
  body: Record<string, unknown>,
) {
  if (Object.keys(body).sort().join(",") !== "agentIds") {
    throw invalidDashboardStatusRequest();
  }

  if (!Array.isArray(body.agentIds)) {
    throw invalidDashboardStatusRequest();
  }

  if (
    body.agentIds.length < 1 ||
    body.agentIds.length > maxTelegramDashboardStatusAgentIds
  ) {
    throw invalidDashboardStatusRequest();
  }

  const agentIds = body.agentIds.map(assertAgentId);
  const uniqueAgentIds = new Set(agentIds);

  if (uniqueAgentIds.size !== agentIds.length) {
    throw invalidDashboardStatusRequest();
  }

  return agentIds;
}

export function assertTelegramDashboardStatuses(
  value: unknown,
  expectedAgentIds: string[],
): TelegramDashboardStatusRecord[] {
  if (!Array.isArray(value)) {
    throw invalidDashboardStatusLookup();
  }

  if (value.length > expectedAgentIds.length) {
    throw invalidDashboardStatusLookup();
  }

  const expectedAgentIdSet = new Set(expectedAgentIds);
  const seenAgentIds = new Set<string>();

  return value.map((record) => {
    const mappedRecord = assertTelegramDashboardStatusRecord(record);

    if (
      !expectedAgentIdSet.has(mappedRecord.agentId) ||
      seenAgentIds.has(mappedRecord.agentId)
    ) {
      throw invalidDashboardStatusLookup();
    }

    seenAgentIds.add(mappedRecord.agentId);
    return mappedRecord;
  });
}

function assertTelegramDashboardStatusRecord(
  value: unknown,
): TelegramDashboardStatusRecord {
  if (!isPlainRecord(value)) {
    throw invalidDashboardStatusLookup();
  }

  if (
    Object.keys(value).sort().join(",") !==
      "agentId,botHandle,lastEventAt,ownerChatLinked,ownerLinkAvailable,webhookStatus"
  ) {
    throw invalidDashboardStatusLookup();
  }

  const agentId = assertDashboardStatusRecordAgentId(value.agentId);
  const botHandle = assertBotHandle(value.botHandle);
  const webhookStatus = assertWebhookStatus(value.webhookStatus);
  const ownerChatLinked = assertBoolean(value.ownerChatLinked);
  const ownerLinkAvailable = assertBoolean(value.ownerLinkAvailable);
  const lastEventAt = assertOptionalIsoTimestamp(value.lastEventAt);

  return {
    agentId,
    botHandle,
    webhookStatus,
    ownerChatLinked,
    ownerLinkAvailable,
    lastEventAt,
  };
}

function assertBotHandle(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value === "string" && /^@[A-Za-z0-9_]{5,32}$/.test(value)) {
    return value;
  }

  throw invalidDashboardStatusLookup();
}

function assertDashboardStatusRecordAgentId(value: unknown) {
  try {
    return assertAgentId(value);
  } catch {
    throw invalidDashboardStatusLookup();
  }
}

function assertWebhookStatus(value: unknown): TelegramDashboardWebhookStatus {
  if (
    value === "mocked" ||
    value === "queued" ||
    value === "active" ||
    value === "paused"
  ) {
    return value;
  }

  throw invalidDashboardStatusLookup();
}

function assertBoolean(value: unknown) {
  if (typeof value === "boolean") {
    return value;
  }

  throw invalidDashboardStatusLookup();
}

function assertOptionalIsoTimestamp(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw invalidDashboardStatusLookup();
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw invalidDashboardStatusLookup();
  }

  return new Date(timestamp).toISOString();
}

function requireDependency<T>(dependency: T | undefined): T {
  if (!dependency) {
    throw new HttpError(
      500,
      "server_error",
      "Telegram dashboard status is not configured safely.",
    );
  }

  return dependency;
}

function invalidDashboardStatusRequest() {
  return new HttpError(
    400,
    "invalid_request",
    "Telegram dashboard status request is invalid.",
  );
}

function invalidDashboardStatusLookup() {
  return new HttpError(
    500,
    "server_error",
    "Telegram dashboard status lookup failed.",
  );
}

function notConfiguredResponse() {
  return jsonResponse(
    {
      ok: false,
      status: "not_configured",
      message: "Telegram dashboard status is planned but not enabled yet.",
    },
    501,
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
