import type { ChainPreparedActionStorageInput } from "./core.ts";

export const chainPreparedActionApprovalRequirement =
  "Owner dashboard review is required before any wallet action.";
export const chainPreparedActionSafetyNote =
  "Read-only status only. No wallet prompt, signing, or submission.";

export interface ChainPreparedActionInsertRow {
  workspace_id: string;
  agent_id: string;
  request_id: string;
  action_kind: "chain_status_check";
  chain_key: string;
  chain_id: number;
  status: "preview_ready";
  risk: "read-only";
  route_summary: string;
  value_summary: string;
  approval_requirement: typeof chainPreparedActionApprovalRequirement;
  safety_note: typeof chainPreparedActionSafetyNote;
  provider: "chain_rpc";
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChainPreparedActionStorageClient {
  from: (table: "prepared_actions") => {
    upsert: (
      row: ChainPreparedActionInsertRow,
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

export function createChainPreparedActionInsertRow(
  input: ChainPreparedActionStorageInput,
  now: Date,
): ChainPreparedActionInsertRow {
  const createdAt = assertTimestamp(new Date(input.requestedAt));
  const updatedAt = assertTimestamp(now);
  return {
    workspace_id: input.workspaceId,
    agent_id: input.agentId,
    request_id: input.requestId,
    action_kind: input.actionKind,
    chain_key: input.chainKey,
    chain_id: input.chainId,
    status: "preview_ready",
    risk: input.risk,
    route_summary: input.routeSummary,
    value_summary: input.valueSummary,
    approval_requirement: chainPreparedActionApprovalRequirement,
    safety_note: chainPreparedActionSafetyNote,
    provider: "chain_rpc",
    expires_at: input.expiryIso,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function createChainPreparedActionStorageAdapter(
  client: ChainPreparedActionStorageClient,
  getNow: () => Date = () => new Date(),
) {
  return async (input: ChainPreparedActionStorageInput) => {
    const row = createChainPreparedActionInsertRow(input, getNow());
    const { data, error } = await client.from("prepared_actions")
      .upsert(row, { onConflict: "workspace_id,agent_id,request_id" })
      .select("id")
      .maybeSingle();
    if (error || !isCanonicalUuid(data?.id)) {
      throw new Error("Prepared action storage failed.");
    }
    return { ok: true as const };
  };
}

function assertTimestamp(value: Date) {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new Error("Prepared action storage timestamp is invalid.");
  }
  return value.toISOString();
}

function isCanonicalUuid(value: unknown): value is string {
  return typeof value === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u
      .test(value);
}
