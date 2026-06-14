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
import type { BaseMcpPrepareRuntimeConfig } from "./runtime-config.ts";

export const maxBaseMcpPrepareBodyBytes = 4096;
const baseMcpAllowedActionKinds = ["base_mcp_status_check"] as const;

type BaseMcpActionKind = (typeof baseMcpAllowedActionKinds)[number];
type BaseMcpPrepareStatus = "blocked" | "preview_ready" | "failed";
type BaseMcpAdapterErrorCode =
  | "base_mcp_disabled"
  | "base_mcp_not_configured"
  | "base_mcp_unknown_action"
  | "base_mcp_timeout"
  | "base_mcp_unavailable";

interface BaseMcpStatusCheckRequest {
  actionKind: "base_mcp_status_check";
  agentId: string;
  workspaceId: string;
  requestId: string;
  chain: "base";
  mode: "read_only";
  requestedAt: string;
}

type BaseMcpPrepareRequest = BaseMcpStatusCheckRequest;

interface BaseMcpPreparedActionSummary {
  actionKind: BaseMcpActionKind;
  chain: "Base";
  routeSummary: string;
  valueSummary: string;
  risk: "read-only";
  expiryIso: string | null;
  opaquePayloadRef: string | null;
}

interface BaseMcpPrepareSuccess {
  ok: true;
  status: "preview_ready";
  summary: BaseMcpPreparedActionSummary;
}

interface BaseMcpPrepareFailure {
  ok: false;
  status: Exclude<BaseMcpPrepareStatus, "preview_ready">;
  code: BaseMcpAdapterErrorCode;
  message: string;
}

type BaseMcpPrepareResult = BaseMcpPrepareSuccess | BaseMcpPrepareFailure;

export interface BaseMcpPrepareDependencies {
  baseMcpPrepareRuntimeConfig?: BaseMcpPrepareRuntimeConfig;
  getEnv?: (key: string) => string;
  getUser?: (
    supabaseUrl: string,
    anonKey: string,
    authorization: string,
  ) => Promise<unknown>;
  lookupAgentOwnership?: (
    agentId: string,
    ownerUserId: string,
  ) => Promise<AgentOwnershipRecord | null>;
  prepareBaseMcpAction?: (
    input: BaseMcpPrepareRequest,
    runtimeConfig: Extract<BaseMcpPrepareRuntimeConfig, { enabled: true }>,
  ) => Promise<BaseMcpPrepareResult>;
}

interface ParsedBaseMcpPrepareBody
  extends Omit<BaseMcpStatusCheckRequest, "actionKind"> {
  actionKind: string;
}

const disabledBaseMcpPrepareRuntimeConfig: BaseMcpPrepareRuntimeConfig = {
  enabled: false,
};

export async function handleBaseMcpPrepareRequest(
  request: Request,
  dependencies: BaseMcpPrepareDependencies = {},
) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    assertPostMethod(request, "base-mcp-prepare");
    assertJsonContentType(request.headers);
    assertBodySizeFromHeaders(request.headers, maxBaseMcpPrepareBodyBytes);

    const runtimeConfig = dependencies.baseMcpPrepareRuntimeConfig ??
      disabledBaseMcpPrepareRuntimeConfig;

    if (!runtimeConfig.enabled) {
      return baseMcpFailureResponse({
        ok: false,
        status: "blocked",
        code: "base_mcp_disabled",
        message: "Base MCP preparation is disabled.",
      }, 501);
    }

    const authorization = assertBearerAuthorization(request);
    const getEnv = requireDependency(dependencies.getEnv);
    const getUser = requireDependency(dependencies.getUser);
    const supabaseUrl = getEnv("SUPABASE_URL");
    const anonKey = getEnv("SUPABASE_ANON_KEY");
    const user = await getUser(supabaseUrl, anonKey, authorization);
    const ownerUserId = assertAuthenticatedUserId(user);
    const body = await readJsonObjectBody(request, maxBaseMcpPrepareBodyBytes);
    const prepareRequest = assertBaseMcpPrepareBody(body);

    if (!isAllowedBaseMcpActionKind(prepareRequest.actionKind)) {
      return baseMcpFailureResponse(createUnknownBaseMcpActionFailure(), 400);
    }

    const allowedPrepareRequest = prepareRequest as BaseMcpPrepareRequest;
    const lookupAgentOwnership = requireDependency(
      dependencies.lookupAgentOwnership,
    );
    const ownership = await safeLookupAgentOwnership(
      lookupAgentOwnership,
      allowedPrepareRequest.agentId,
      ownerUserId,
    );
    assertAgentOwnership(allowedPrepareRequest.agentId, ownerUserId, ownership);

    if (
      !ownership || ownership.workspaceId !== allowedPrepareRequest.workspaceId
    ) {
      throw new HttpError(
        403,
        "forbidden",
        "Agent does not belong to the signed-in user.",
      );
    }

    if (!runtimeConfig.endpoint || !dependencies.prepareBaseMcpAction) {
      return baseMcpFailureResponse({
        ok: false,
        status: "blocked",
        code: "base_mcp_not_configured",
        message: "Base MCP preparation is not configured.",
      }, 501);
    }

    try {
      const result = assertBaseMcpPrepareResult(
        await dependencies.prepareBaseMcpAction(
          allowedPrepareRequest,
          runtimeConfig,
        ),
      );

      return baseMcpResultResponse(result);
    } catch (error) {
      return baseMcpFailureResponse(sanitizeBaseMcpAdapterError(error), 502);
    }
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
        message: "Base MCP preparation function failed.",
      },
      500,
    );
  }
}

export function assertBaseMcpPrepareBody(
  body: Record<string, unknown>,
): ParsedBaseMcpPrepareBody {
  const keys = Object.keys(body).sort().join(",");

  if (
    keys !==
      "actionKind,agentId,chain,mode,requestId,requestedAt,workspaceId"
  ) {
    throw invalidBaseMcpPrepareRequest();
  }

  const actionKind = assertActionKind(body.actionKind);
  const agentId = assertAgentId(body.agentId);
  const workspaceId = assertUuid(body.workspaceId);
  const requestId = assertRequestId(body.requestId);
  const chain = assertBaseChain(body.chain);
  const mode = assertReadOnlyMode(body.mode);
  const requestedAt = assertIsoTimestamp(body.requestedAt);

  return {
    actionKind,
    agentId,
    workspaceId,
    requestId,
    chain,
    mode,
    requestedAt,
  };
}

export function assertBaseMcpPrepareResult(
  result: unknown,
): BaseMcpPrepareResult {
  if (!isPlainRecord(result)) {
    throw invalidBaseMcpAdapterResponse();
  }

  if (result.ok === false) {
    return assertBaseMcpPrepareFailure(result);
  }

  if (result.ok !== true || result.status !== "preview_ready") {
    throw invalidBaseMcpAdapterResponse();
  }

  if (!isPlainRecord(result.summary)) {
    throw invalidBaseMcpAdapterResponse();
  }

  const summary = result.summary;

  if (
    Object.keys(summary).sort().join(",") !==
      "actionKind,chain,expiryIso,opaquePayloadRef,risk,routeSummary,valueSummary"
  ) {
    throw invalidBaseMcpAdapterResponse();
  }

  if (summary.actionKind !== "base_mcp_status_check") {
    throw invalidBaseMcpAdapterResponse();
  }

  if (summary.chain !== "Base" || summary.risk !== "read-only") {
    throw invalidBaseMcpAdapterResponse();
  }

  if (
    typeof summary.routeSummary !== "string" ||
    !summary.routeSummary.trim() ||
    summary.routeSummary.length > 160
  ) {
    throw invalidBaseMcpAdapterResponse();
  }

  if (
    typeof summary.valueSummary !== "string" ||
    !summary.valueSummary.trim() ||
    summary.valueSummary.length > 160
  ) {
    throw invalidBaseMcpAdapterResponse();
  }

  if (summary.expiryIso !== null) {
    assertIsoTimestamp(summary.expiryIso);
  }

  if (summary.opaquePayloadRef !== null) {
    throw invalidBaseMcpAdapterResponse();
  }

  return result as unknown as BaseMcpPrepareSuccess;
}

function assertBaseMcpPrepareFailure(
  result: Record<string, unknown>,
): BaseMcpPrepareFailure {
  if (
    result.status !== "blocked" && result.status !== "failed"
  ) {
    throw invalidBaseMcpAdapterResponse();
  }

  if (
    result.code !== "base_mcp_disabled" &&
    result.code !== "base_mcp_not_configured" &&
    result.code !== "base_mcp_unknown_action" &&
    result.code !== "base_mcp_timeout" &&
    result.code !== "base_mcp_unavailable"
  ) {
    throw invalidBaseMcpAdapterResponse();
  }

  if (!isAllowedBaseMcpFailureMessage(result.message)) {
    throw invalidBaseMcpAdapterResponse();
  }

  return result as unknown as BaseMcpPrepareFailure;
}

function baseMcpResultResponse(result: BaseMcpPrepareResult) {
  if (result.ok) {
    return jsonResponse(result as unknown as Record<string, unknown>);
  }

  return baseMcpFailureResponse(result, statusForBaseMcpFailure(result));
}

function baseMcpFailureResponse(
  failure: BaseMcpPrepareFailure,
  httpStatus: number,
) {
  return jsonResponse(
    failure as unknown as Record<string, unknown>,
    httpStatus,
  );
}

function statusForBaseMcpFailure(failure: BaseMcpPrepareFailure) {
  switch (failure.code) {
    case "base_mcp_disabled":
    case "base_mcp_not_configured":
      return 501;
    case "base_mcp_unknown_action":
      return 400;
    case "base_mcp_timeout":
      return 504;
    case "base_mcp_unavailable":
      return 502;
  }
}

async function safeLookupAgentOwnership(
  lookupAgentOwnership: NonNullable<
    BaseMcpPrepareDependencies["lookupAgentOwnership"]
  >,
  agentId: string,
  ownerUserId: string,
) {
  try {
    return await lookupAgentOwnership(agentId, ownerUserId);
  } catch {
    throw new HttpError(
      500,
      "server_error",
      "Base MCP ownership lookup failed.",
    );
  }
}

function requireDependency<T>(dependency: T | undefined): T {
  if (!dependency) {
    throw new HttpError(
      500,
      "server_error",
      "Base MCP preparation is not configured safely.",
    );
  }

  return dependency;
}

function isAllowedBaseMcpActionKind(
  value: unknown,
): value is BaseMcpActionKind {
  return typeof value === "string" &&
    baseMcpAllowedActionKinds.includes(value as BaseMcpActionKind);
}

function createUnknownBaseMcpActionFailure(): BaseMcpPrepareFailure {
  return {
    ok: false,
    status: "blocked",
    code: "base_mcp_unknown_action",
    message: "This Base MCP action is not supported.",
  };
}

function sanitizeBaseMcpAdapterError(_error: unknown): BaseMcpPrepareFailure {
  return {
    ok: false,
    status: "failed",
    code: "base_mcp_unavailable",
    message: "No Base MCP action can be prepared right now.",
  };
}

function assertActionKind(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw invalidBaseMcpPrepareRequest();
  }

  return value.trim();
}

function assertUuid(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      .test(value)
  ) {
    throw invalidBaseMcpPrepareRequest();
  }

  return value;
}

function assertRequestId(value: unknown) {
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/u.test(value)
  ) {
    throw invalidBaseMcpPrepareRequest();
  }

  return value;
}

function assertBaseChain(value: unknown): "base" {
  if (value !== "base") {
    throw invalidBaseMcpPrepareRequest();
  }

  return value;
}

function assertReadOnlyMode(value: unknown): "read_only" {
  if (value !== "read_only") {
    throw invalidBaseMcpPrepareRequest();
  }

  return value;
}

function assertIsoTimestamp(value: unknown) {
  if (typeof value !== "string") {
    throw invalidBaseMcpPrepareRequest();
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw invalidBaseMcpPrepareRequest();
  }

  return new Date(timestamp).toISOString();
}

function isAllowedBaseMcpFailureMessage(value: unknown) {
  return value === "Base MCP preparation is disabled." ||
    value === "Base MCP preparation is not configured." ||
    value === "This Base MCP action is not supported." ||
    value === "Base MCP preparation timed out." ||
    value === "No Base MCP action can be prepared right now.";
}

function invalidBaseMcpPrepareRequest() {
  return new HttpError(
    400,
    "invalid_request",
    "Base MCP preparation request is invalid.",
  );
}

function invalidBaseMcpAdapterResponse() {
  return new Error("Base MCP adapter returned an invalid response.");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
