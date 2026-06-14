import type { BaseMcpPreparedActionStorageInput } from "./core.ts";

export const baseMcpPreparedActionApprovalRequirement =
  "Dashboard review required before any wallet or onchain action.";
export const baseMcpPreparedActionSafetyNote =
  "No wallet prompt, no signing, no transaction submission.";

export interface PreparedActionInsertRow {
  workspace_id: string;
  agent_id: string;
  request_id: string;
  action_kind: "base_mcp_status_check";
  chain: "base";
  status: "preview_ready";
  risk: "read-only";
  route_summary: string;
  value_summary: string;
  approval_requirement: typeof baseMcpPreparedActionApprovalRequirement;
  safety_note: typeof baseMcpPreparedActionSafetyNote;
  provider: "base_mcp";
  provider_payload_ref: null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PreparedActionStorageClient {
  from: (table: "prepared_actions") => {
    upsert: (
      row: PreparedActionInsertRow,
      options: { onConflict: "workspace_id,agent_id,request_id" },
    ) => {
      select: (columns: "id") => {
        maybeSingle: () => Promise<{
          data: { id: string } | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
}

export function createPreparedActionInsertRow(
  input: BaseMcpPreparedActionStorageInput,
  now: Date,
): PreparedActionInsertRow {
  const timestamp = assertStorageTimestamp(now);

  return {
    workspace_id: input.workspaceId,
    agent_id: input.agentId,
    request_id: input.requestId,
    action_kind: input.actionKind,
    chain: "base",
    status: "preview_ready",
    risk: input.risk,
    route_summary: input.routeSummary,
    value_summary: input.valueSummary,
    approval_requirement: baseMcpPreparedActionApprovalRequirement,
    safety_note: baseMcpPreparedActionSafetyNote,
    provider: "base_mcp",
    provider_payload_ref: null,
    expires_at: input.expiryIso,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function createPreparedActionStorageAdapter(
  client: PreparedActionStorageClient,
  getNow: () => Date = () => new Date(),
) {
  return async (input: BaseMcpPreparedActionStorageInput) => {
    const row = createPreparedActionInsertRow(input, getNow());
    const { data, error } = await client
      .from("prepared_actions")
      .upsert(row, { onConflict: "workspace_id,agent_id,request_id" })
      .select("id")
      .maybeSingle();

    if (error || !data?.id) {
      throw new Error("Prepared action storage failed.");
    }

    return { ok: true as const };
  };
}

function assertStorageTimestamp(value: Date) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error("Prepared action storage timestamp is invalid.");
  }

  return value.toISOString();
}
