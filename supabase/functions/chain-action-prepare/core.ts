import type { AgentOwnershipRecord } from "../telegram-connect/core.ts";
import {
  assertAgentId,
  assertAgentOwnership,
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
import type { ChainActionPrepareRuntimeConfig } from "./runtime-config.ts";

export const maxChainActionPrepareBodyBytes = 4096;
export const maxChainActionPrepareRequestAgeMs = 5 * 60 * 1000;
export const maxChainActionPrepareFutureSkewMs = 60 * 1000;
export type ChainActionAgentStatus = "disabled" | "ready" | "active" | "paused";

export interface ChainActionAgentOwnershipRecord extends AgentOwnershipRecord {
  chainKey: "base" | "robinhood_mainnet" | "robinhood_testnet";
  chainActionStatus: ChainActionAgentStatus;
}

export interface ChainActionPrepareRequest {
  actionKind: "chain_status_check";
  agentId: string;
  workspaceId: string;
  requestId: string;
  chainKey: string;
  chainId: number;
  mode: "read_only";
  requestedAt: string;
}

export interface ChainActionPreparedSummary {
  actionKind: "chain_status_check";
  chainKey: string;
  chainId: number;
  chainName: string;
  routeSummary: string;
  valueSummary: string;
  risk: "read-only";
  expiryIso: string | null;
}

export type ChainActionPrepareResult =
  | { ok: true; status: "preview_ready"; summary: ChainActionPreparedSummary }
  | {
    ok: false;
    status: "blocked" | "failed";
    code:
      | "chain_action_disabled"
      | "chain_action_not_configured"
      | "chain_action_unknown"
      | "chain_action_timeout"
      | "chain_action_unavailable"
      | "chain_action_rate_limited";
    message: string;
  };

export interface ChainPreparedActionStorageInput {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
  requestId: string;
  requestedAt: string;
  actionKind: "chain_status_check";
  chainKey: string;
  chainId: number;
  routeSummary: string;
  valueSummary: string;
  risk: "read-only";
  expiryIso: string | null;
}

export interface ChainActionPrepareDependencies {
  runtimeConfig?: ChainActionPrepareRuntimeConfig;
  getEnv?: (key: string) => string;
  getUser?: (
    supabaseUrl: string,
    anonKey: string,
    authorization: string,
  ) => Promise<unknown>;
  lookupAgentOwnership?: (
    agentId: string,
    ownerUserId: string,
  ) => Promise<ChainActionAgentOwnershipRecord | null>;
  checkRateLimit?: (input: {
    ownerUserId: string;
    workspaceId: string;
    agentId: string;
    chainKey: string;
  }) => Promise<{ allowed: boolean; status: "allowed" | "rate_limited" }>;
  prepareChainAction?: (
    input: ChainActionPrepareRequest,
    runtimeConfig: Extract<ChainActionPrepareRuntimeConfig, { enabled: true }>,
  ) => Promise<ChainActionPrepareResult>;
  storePreparedAction?: (
    input: ChainPreparedActionStorageInput,
  ) => Promise<{ ok: true }>;
  getNow?: () => Date;
}

const disabledConfig: ChainActionPrepareRuntimeConfig = { enabled: false };

export async function handleChainActionPrepareRequest(
  request: Request,
  dependencies: ChainActionPrepareDependencies = {},
) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    assertPostMethod(request, "chain-action-prepare");
    assertJsonContentType(request.headers);
    assertBodySizeFromHeaders(request.headers, maxChainActionPrepareBodyBytes);
    const runtimeConfig = dependencies.runtimeConfig ?? disabledConfig;

    if (!runtimeConfig.enabled) {
      return resultResponse({
        ok: false,
        status: "blocked",
        code: "chain_action_disabled",
        message: "Chain action preparation is disabled.",
      }, 501);
    }

    const authorization = assertBearerAuthorization(request);
    const getEnv = requireDependency(dependencies.getEnv);
    const getUser = requireDependency(dependencies.getUser);
    const user = await getUser(
      getEnv("SUPABASE_URL"),
      getEnv("SUPABASE_ANON_KEY"),
      authorization,
    );
    const ownerUserId = assertAuthenticatedUserId(user);
    const body = await readJsonObjectBody(
      request,
      maxChainActionPrepareBodyBytes,
    );
    const input = readPrepareRequest(body);
    const now = getSafeNow(dependencies.getNow);
    assertFreshRequestedAt(input.requestedAt, now);

    if (
      input.chainKey !== runtimeConfig.chain.key ||
      input.chainId !== runtimeConfig.chain.chainId
    ) {
      throw new HttpError(
        400,
        "invalid_request",
        "Chain action request is invalid.",
      );
    }

    const lookupOwnership = requireDependency(
      dependencies.lookupAgentOwnership,
    );
    const ownership = await safeLookupOwnership(
      lookupOwnership,
      input.agentId,
      ownerUserId,
    );
    assertAgentOwnership(input.agentId, ownerUserId, ownership);
    if (!ownership || ownership.workspaceId !== input.workspaceId) {
      throw new HttpError(
        403,
        "forbidden",
        "Agent does not belong to the signed-in user.",
      );
    }
    if (ownership.chainKey !== input.chainKey) {
      throw new HttpError(
        409,
        "agent_chain_mismatch",
        "Selected agent is not available on the requested chain.",
      );
    }
    if (!["ready", "active"].includes(ownership.chainActionStatus)) {
      throw new HttpError(
        409,
        "agent_chain_action_locked",
        "Selected agent is not enabled for chain action preparation.",
      );
    }

    if (
      !runtimeConfig.endpoint ||
      !runtimeConfig.sharedSecret ||
      !runtimeConfig.providerProtocol ||
      !dependencies.prepareChainAction ||
      !dependencies.storePreparedAction
    ) {
      return resultResponse(notConfigured(), 501, input.requestId);
    }

    const rateLimit = await requireDependency(dependencies.checkRateLimit)({
      ownerUserId,
      workspaceId: input.workspaceId,
      agentId: input.agentId,
      chainKey: input.chainKey,
    });
    if (!rateLimit.allowed) {
      return resultResponse(
        {
          ok: false,
          status: "blocked",
          code: "chain_action_rate_limited",
          message: "Chain status checks are temporarily limited.",
        },
        429,
        input.requestId,
      );
    }

    try {
      const result = assertPrepareResult(
        await dependencies.prepareChainAction(input, runtimeConfig),
        input,
      );
      if (result.ok) {
        await assertStorageResult(
          await dependencies.storePreparedAction({
            ownerUserId,
            workspaceId: input.workspaceId,
            agentId: input.agentId,
            requestId: input.requestId,
            requestedAt: input.requestedAt,
            actionKind: input.actionKind,
            chainKey: input.chainKey,
            chainId: input.chainId,
            routeSummary: result.summary.routeSummary,
            valueSummary: result.summary.valueSummary,
            risk: result.summary.risk,
            expiryIso: result.summary.expiryIso,
          }),
        );
      }
      return resultResponse(result, result.ok ? 200 : 502, input.requestId);
    } catch {
      return resultResponse(
        {
          ok: false,
          status: "failed",
          code: "chain_action_unavailable",
          message: "No chain action can be prepared right now.",
        },
        502,
        input.requestId,
      );
    }
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        { status: error.code, message: error.message },
        error.statusCode,
      );
    }
    return jsonResponse({
      status: "unavailable",
      message: "Chain action preparation is unavailable.",
    }, 503);
  }
}

export function readPrepareRequest(
  body: Record<string, unknown>,
): ChainActionPrepareRequest {
  if (
    Object.keys(body).sort().join(",") !==
      "actionKind,agentId,chainId,chainKey,mode,requestId,requestedAt,workspaceId" ||
    body.actionKind !== "chain_status_check" ||
    typeof body.workspaceId !== "string" ||
    !isCanonicalUuid(body.workspaceId) ||
    typeof body.requestId !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/u.test(body.requestId) ||
    typeof body.chainKey !== "string" ||
    !/^[a-z][a-z0-9_]{1,63}$/u.test(body.chainKey) ||
    !Number.isSafeInteger(body.chainId) ||
    body.mode !== "read_only" ||
    typeof body.requestedAt !== "string" ||
    !Number.isFinite(Date.parse(body.requestedAt))
  ) {
    throw new HttpError(
      400,
      "invalid_request",
      "Chain action request is invalid.",
    );
  }
  const agentId = assertAgentId(body.agentId);
  return {
    actionKind: body.actionKind,
    agentId,
    workspaceId: body.workspaceId,
    requestId: body.requestId,
    chainKey: body.chainKey,
    chainId: body.chainId as number,
    mode: body.mode,
    requestedAt: new Date(Date.parse(body.requestedAt)).toISOString(),
  };
}

function assertPrepareResult(
  value: ChainActionPrepareResult,
  input: ChainActionPrepareRequest,
) {
  if (
    value.ok !== true ||
    value.status !== "preview_ready" ||
    value.summary.actionKind !== input.actionKind ||
    value.summary.chainKey !== input.chainKey ||
    value.summary.chainId !== input.chainId ||
    value.summary.risk !== "read-only" ||
    !bounded(value.summary.chainName, 80) ||
    !bounded(value.summary.routeSummary, 160) ||
    !bounded(value.summary.valueSummary, 160) ||
    value.summary.expiryIso !== null
  ) {
    throw new Error("Chain action result is invalid.");
  }
  return value;
}

async function assertStorageResult(value: { ok: true }) {
  if (!value || value.ok !== true || Object.keys(value).join(",") !== "ok") {
    throw new Error("Prepared action storage failed.");
  }
}

function resultResponse(
  result: ChainActionPrepareResult,
  status: number,
  requestId?: string,
) {
  const headers = new Headers(corsHeaders);
  headers.set("cache-control", "no-store");
  headers.set("x-content-type-options", "nosniff");
  if (requestId) {
    headers.set("access-control-expose-headers", "x-kyra-request-id");
    headers.set("x-kyra-request-id", requestId);
  }
  return new Response(JSON.stringify(result), {
    status,
    headers: {
      ...Object.fromEntries(headers),
      "content-type": "application/json; charset=utf-8",
    },
  });
}

function notConfigured(): ChainActionPrepareResult {
  return {
    ok: false,
    status: "blocked",
    code: "chain_action_not_configured",
    message: "Chain action preparation is not configured.",
  };
}

function requireDependency<T>(value: T | undefined): T {
  if (!value) throw new Error("Required dependency is unavailable.");
  return value;
}

async function safeLookupOwnership(
  lookup: NonNullable<ChainActionPrepareDependencies["lookupAgentOwnership"]>,
  agentId: string,
  ownerUserId: string,
) {
  try {
    return await lookup(agentId, ownerUserId);
  } catch {
    throw new HttpError(503, "unavailable", "Agent ownership lookup failed.");
  }
}

function getSafeNow(getNow?: () => Date) {
  const now = getNow?.() ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new Error("Clock unavailable.");
  }
  return now;
}

function assertFreshRequestedAt(value: string, now: Date) {
  const time = Date.parse(value);
  if (
    time < now.getTime() - maxChainActionPrepareRequestAgeMs ||
    time > now.getTime() + maxChainActionPrepareFutureSkewMs
  ) {
    throw new HttpError(
      400,
      "invalid_request",
      "Chain action request is invalid.",
    );
  }
}

function isCanonicalUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
    .test(value);
}

function bounded(value: unknown, max: number) {
  return typeof value === "string" && value.trim().length > 0 &&
    value.length <= max;
}
