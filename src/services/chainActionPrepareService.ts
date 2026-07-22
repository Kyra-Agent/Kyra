import { appConfig } from "../config/appConfig";
import { currentProductChain } from "../config/productChains";
import type { KyraAuthSession } from "./supabaseAuthService";
import {
  getSupabaseApiKey,
  sanitizeSupabaseMessage,
} from "./supabaseRestClient";

export type ChainActionDashboardStatus =
  | "preview_ready"
  | "chain_action_disabled"
  | "chain_action_not_configured"
  | "chain_action_unknown"
  | "chain_action_timeout"
  | "chain_action_unavailable"
  | "chain_action_rate_limited"
  | "invalid_request"
  | "unauthorized"
  | "forbidden"
  | "agent_not_found"
  | "agent_chain_mismatch"
  | "agent_chain_action_locked"
  | "server_error"
  | "function_unavailable"
  | "function_not_configured";

export interface ChainActionPreparedSummary {
  actionKind: "chain_status_check";
  chainKey: typeof currentProductChain.key;
  chainId: number;
  chainName: string;
  routeSummary: string;
  valueSummary: string;
  risk: "read-only";
  expiryIso: string | null;
}

export interface ChainActionDashboardResult {
  ok: boolean;
  status: ChainActionDashboardStatus;
  message: string;
  summary: ChainActionPreparedSummary | null;
}

interface ChainActionResponsePayload {
  ok?: unknown;
  status?: unknown;
  code?: unknown;
  message?: unknown;
  summary?: unknown;
}

const allowedFailureMessages = new Set([
  "Chain action preparation is disabled.",
  "Chain action preparation is not configured.",
  "This chain action is not supported.",
  "Chain action preparation timed out.",
  "No chain action can be prepared right now.",
  "Chain status checks are temporarily limited.",
  "Chain action request is invalid.",
  "A valid Supabase session is required.",
  "Agent does not belong to the signed-in user.",
  "Selected agent is not available on the requested chain.",
  "Selected agent is not enabled for chain action preparation.",
  "Agent ownership lookup failed.",
  "Chain action preparation is unavailable.",
]);
const maxPreviewTtlMs = 10 * 60 * 1000;

function createRequestId() {
  return `chain-status:${crypto.randomUUID()}`;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPreparedSummary(value: unknown): ChainActionPreparedSummary | null {
  if (!isPlainRecord(value)) return null;

  if (
    Object.keys(value).sort().join(",") !==
      "actionKind,chainId,chainKey,chainName,expiryIso,risk,routeSummary,valueSummary" ||
    value.actionKind !== "chain_status_check" ||
    value.chainKey !== currentProductChain.key ||
    value.chainId !== currentProductChain.id ||
    value.chainName !== currentProductChain.name ||
    value.risk !== "read-only" ||
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
    if (expiryMs <= nowMs || expiryMs > nowMs + maxPreviewTtlMs) return null;
  }

  return value as unknown as ChainActionPreparedSummary;
}

function normalizeStatus(
  payload: ChainActionResponsePayload,
): ChainActionDashboardStatus {
  const status = typeof payload.code === "string"
    ? payload.code
    : typeof payload.status === "string"
    ? payload.status
    : "";

  switch (status) {
    case "preview_ready":
    case "chain_action_disabled":
    case "chain_action_not_configured":
    case "chain_action_unknown":
    case "chain_action_timeout":
    case "chain_action_unavailable":
    case "chain_action_rate_limited":
    case "invalid_request":
    case "unauthorized":
    case "forbidden":
    case "agent_not_found":
    case "agent_chain_mismatch":
    case "agent_chain_action_locked":
    case "server_error":
      return status;
    default:
      return "function_unavailable";
  }
}

function sanitizeChainActionMessage(value: unknown, fallback: string) {
  if (typeof value !== "string" || !allowedFailureMessages.has(value)) {
    return fallback;
  }
  return sanitizeSupabaseMessage(value);
}

async function parseResponse(response: Response): Promise<ChainActionResponsePayload> {
  const text = await response.text();
  if (!text) return {};

  try {
    const payload = JSON.parse(text) as unknown;
    if (!isPlainRecord(payload)) return {};

    const keys = Object.keys(payload).sort().join(",");
    const validShape =
      (payload.ok === true && keys === "ok,status,summary") ||
      (payload.ok === false && keys === "code,message,ok,status") ||
      (payload.ok === undefined && keys === "message,status");

    return validShape ? payload : {};
  } catch {
    return {};
  }
}

export async function prepareChainActionStatusCheck({
  session,
  agentId,
  workspaceId,
}: {
  session: KyraAuthSession;
  agentId: string;
  workspaceId: string;
}): Promise<ChainActionDashboardResult> {
  if (!appConfig.functions.chainActionPrepareConfigured) {
    return {
      ok: false,
      status: "function_not_configured",
      message: "Chain status backend is not configured.",
      summary: null,
    };
  }

  try {
    const requestId = createRequestId();
    const response = await fetch(appConfig.functions.chainActionPrepareUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: getSupabaseApiKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        actionKind: "chain_status_check",
        agentId,
        workspaceId,
        requestId,
        chainKey: currentProductChain.key,
        chainId: currentProductChain.id,
        mode: "read_only",
        requestedAt: new Date().toISOString(),
      }),
    });
    const payload = await parseResponse(response);
    const status = normalizeStatus(payload);
    const summary = readPreparedSummary(payload.summary);
    const correlated = response.headers.get("x-kyra-request-id") === requestId;

    if (
      response.ok &&
      payload.ok === true &&
      status === "preview_ready" &&
      correlated &&
      summary
    ) {
      return {
        ok: true,
        status,
        message: `Read-only ${currentProductChain.name} status check completed.`,
        summary,
      };
    }

    return {
      ok: false,
      status,
      message: sanitizeChainActionMessage(
        payload.message,
        status === "function_unavailable"
          ? "Chain status backend returned an invalid response."
          : "Chain status check is not available.",
      ),
      summary: null,
    };
  } catch {
    return {
      ok: false,
      status: "function_unavailable",
      message: "Chain status backend is unavailable.",
      summary: null,
    };
  }
}
