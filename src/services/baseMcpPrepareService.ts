import { appConfig } from "../config/appConfig";
import type { BaseMcpPreparedActionSummary } from "../types/baseMcp";
import type { KyraAuthSession } from "./supabaseAuthService";
import {
  getSupabaseApiKey,
  sanitizeSupabaseMessage,
} from "./supabaseRestClient";

export type BaseMcpDashboardStatus =
  | "preview_ready"
  | "base_mcp_disabled"
  | "base_mcp_not_configured"
  | "base_mcp_unknown_action"
  | "base_mcp_timeout"
  | "base_mcp_unavailable"
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "agent_not_found"
  | "server_error"
  | "function_unavailable"
  | "function_not_configured";

export interface BaseMcpDashboardResult {
  ok: boolean;
  status: BaseMcpDashboardStatus;
  message: string;
  summary: BaseMcpPreparedActionSummary | null;
}

interface BaseMcpResponsePayload {
  ok?: unknown;
  status?: unknown;
  code?: unknown;
  message?: unknown;
  summary?: unknown;
}

const allowedFailureMessages = new Set([
  "Base MCP preparation is disabled.",
  "Base MCP preparation is not configured.",
  "This Base MCP action is not supported.",
  "Base MCP preparation timed out.",
  "No Base MCP action can be prepared right now.",
  "Base MCP preparation request is invalid.",
  "A valid Supabase session is required.",
  "Agent does not belong to the signed-in user.",
  "Agent not found.",
  "Base MCP ownership lookup failed.",
  "Base MCP preparation function failed.",
]);
const maxPreviewTtlMs = 10 * 60 * 1000;

function createRequestId() {
  return `base-status:${crypto.randomUUID()}`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPreparedSummary(value: unknown): BaseMcpPreparedActionSummary | null {
  if (!isPlainRecord(value)) {
    return null;
  }

  if (
    Object.keys(value).sort().join(",") !==
      "actionKind,chain,expiryIso,opaquePayloadRef,risk,routeSummary,valueSummary" ||
    value.actionKind !== "base_mcp_status_check" ||
    value.chain !== "Base" ||
    value.risk !== "read-only" ||
    value.opaquePayloadRef !== null ||
    typeof value.routeSummary !== "string" ||
    !value.routeSummary.trim() ||
    value.routeSummary.length > 160 ||
    typeof value.valueSummary !== "string" ||
    !value.valueSummary.trim() ||
    value.valueSummary.length > 160
  ) {
    return null;
  }

  if (value.expiryIso !== null) {
    if (
      typeof value.expiryIso !== "string" ||
      !Number.isFinite(Date.parse(value.expiryIso))
    ) {
      return null;
    }

    const expiryMs = Date.parse(value.expiryIso);
    const nowMs = Date.now();

    if (expiryMs <= nowMs || expiryMs > nowMs + maxPreviewTtlMs) {
      return null;
    }
  }

  return value as unknown as BaseMcpPreparedActionSummary;
}

function normalizeStatus(
  payload: BaseMcpResponsePayload,
): BaseMcpDashboardStatus {
  const status = typeof payload.code === "string"
    ? payload.code
    : typeof payload.status === "string"
    ? payload.status
    : "";

  switch (status) {
    case "preview_ready":
    case "base_mcp_disabled":
    case "base_mcp_not_configured":
    case "base_mcp_unknown_action":
    case "base_mcp_timeout":
    case "base_mcp_unavailable":
    case "invalid_request":
    case "unauthorized":
    case "forbidden":
    case "agent_not_found":
    case "server_error":
      return status;
    default:
      return "function_unavailable";
  }
}

function sanitizeBaseMcpMessage(value: unknown, fallback: string) {
  if (typeof value !== "string" || !allowedFailureMessages.has(value)) {
    return fallback;
  }

  return sanitizeSupabaseMessage(value);
}

async function parseResponse(response: Response): Promise<BaseMcpResponsePayload> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as BaseMcpResponsePayload;
  } catch {
    return {};
  }
}

export async function prepareBaseMcpStatusCheck({
  session,
  agentId,
  workspaceId,
}: {
  session: KyraAuthSession;
  agentId: string;
  workspaceId: string;
}): Promise<BaseMcpDashboardResult> {
  if (!appConfig.functions.baseMcpPrepareConfigured) {
    return {
      ok: false,
      status: "function_not_configured",
      message: "Base MCP status backend is not configured.",
      summary: null,
    };
  }

  try {
    const response = await fetch(appConfig.functions.baseMcpPrepareUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: getSupabaseApiKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        actionKind: "base_mcp_status_check",
        agentId,
        workspaceId,
        requestId: createRequestId(),
        chain: "base",
        mode: "read_only",
        requestedAt: new Date().toISOString(),
      }),
    });
    const payload = await parseResponse(response);
    const status = normalizeStatus(payload);
    const summary = readPreparedSummary(payload.summary);

    if (
      response.ok &&
      payload.ok === true &&
      status === "preview_ready" &&
      summary
    ) {
      return {
        ok: true,
        status,
        message: "Read-only Base MCP status check completed.",
        summary,
      };
    }

    return {
      ok: false,
      status,
      message: sanitizeBaseMcpMessage(
        payload.message,
        status === "function_unavailable"
          ? "Base MCP status backend returned an invalid response."
          : "Base MCP status check is not available.",
      ),
      summary: null,
    };
  } catch {
    return {
      ok: false,
      status: "function_unavailable",
      message: "Base MCP status backend is unavailable.",
      summary: null,
    };
  }
}
