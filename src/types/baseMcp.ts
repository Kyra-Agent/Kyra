export const baseMcpAllowedActionKinds = ["base_mcp_status_check"] as const;

export type BaseMcpActionKind = (typeof baseMcpAllowedActionKinds)[number];
export type BaseMcpChain = "base";
export type BaseMcpRisk = "read-only";
export type BaseMcpPrepareStatus = "blocked" | "preview_ready" | "failed";
export type BaseMcpAdapterErrorCode =
  | "base_mcp_disabled"
  | "base_mcp_not_configured"
  | "base_mcp_unknown_action"
  | "base_mcp_timeout"
  | "base_mcp_unavailable";

export interface BaseMcpStatusCheckRequest {
  actionKind: "base_mcp_status_check";
  agentId: string;
  workspaceId: string;
  requestId: string;
  chain: BaseMcpChain;
  mode: "read_only";
  requestedAt: string;
}

export type BaseMcpPrepareRequest = BaseMcpStatusCheckRequest;

export interface BaseMcpPreparedActionSummary {
  actionKind: BaseMcpActionKind;
  chain: "Base";
  routeSummary: string;
  valueSummary: string;
  risk: BaseMcpRisk;
  expiryIso: string | null;
  opaquePayloadRef: string | null;
}

export interface BaseMcpPrepareSuccess {
  ok: true;
  status: "preview_ready";
  summary: BaseMcpPreparedActionSummary;
}

export interface BaseMcpPrepareFailure {
  ok: false;
  status: Exclude<BaseMcpPrepareStatus, "preview_ready">;
  code: BaseMcpAdapterErrorCode;
  message: string;
}

export type BaseMcpPrepareResult = BaseMcpPrepareSuccess | BaseMcpPrepareFailure;

export function isAllowedBaseMcpActionKind(value: unknown): value is BaseMcpActionKind {
  return typeof value === "string" && baseMcpAllowedActionKinds.includes(value as BaseMcpActionKind);
}

export function createUnknownBaseMcpActionFailure(): BaseMcpPrepareFailure {
  return {
    ok: false,
    status: "blocked",
    code: "base_mcp_unknown_action",
    message: "This Base MCP action is not supported.",
  };
}

export function sanitizeBaseMcpAdapterError(_error: unknown): BaseMcpPrepareFailure {
  return {
    ok: false,
    status: "failed",
    code: "base_mcp_unavailable",
    message: "No Base MCP action can be prepared right now.",
  };
}
