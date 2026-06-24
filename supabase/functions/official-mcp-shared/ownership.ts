import {
  isOfficialMcpCanonicalUuid,
  OfficialMcpSafeError,
} from "./owner-auth.ts";

export type OfficialMcpOwnershipLookup = {
  lookupAgent: (agentId: string) => Promise<unknown>;
  lookupWorkspace: (workspaceId: string) => Promise<unknown>;
};

export type OfficialMcpOwnerAgentBinding = {
  ownerUserId: string;
  workspaceId: string;
  agentId: string;
};

function notFound(): OfficialMcpSafeError {
  return new OfficialMcpSafeError(
    404,
    "requested_binding_not_found",
    "Requested binding not found.",
  );
}

function serverError(): OfficialMcpSafeError {
  return new OfficialMcpSafeError(500, "server_error", "Server error.");
}

function readRecord(candidate: unknown): Record<string, unknown> {
  if (!candidate || Array.isArray(candidate) || typeof candidate !== "object") {
    throw notFound();
  }

  return candidate as Record<string, unknown>;
}

function assertCanonicalUuid(value: unknown): asserts value is string {
  if (!isOfficialMcpCanonicalUuid(value)) throw notFound();
}

export async function resolveOfficialMcpOwnerAgentBinding(
  input: {
    ownerUserId: string;
    workspaceId: string;
    agentId: string;
  },
  lookup: OfficialMcpOwnershipLookup,
): Promise<OfficialMcpOwnerAgentBinding> {
  assertCanonicalUuid(input.ownerUserId);
  assertCanonicalUuid(input.workspaceId);
  assertCanonicalUuid(input.agentId);

  let agent: Record<string, unknown>;
  try {
    agent = readRecord(await lookup.lookupAgent(input.agentId));
  } catch (error) {
    if (error instanceof OfficialMcpSafeError) throw error;
    throw serverError();
  }

  if (agent.agentId !== input.agentId) throw notFound();
  if (agent.workspaceId !== input.workspaceId) throw notFound();

  let workspace: Record<string, unknown>;
  try {
    workspace = readRecord(await lookup.lookupWorkspace(input.workspaceId));
  } catch (error) {
    if (error instanceof OfficialMcpSafeError) throw error;
    throw serverError();
  }

  if (workspace.workspaceId !== input.workspaceId) throw notFound();
  if (workspace.ownerUserId !== input.ownerUserId) throw notFound();

  return {
    ownerUserId: input.ownerUserId,
    workspaceId: input.workspaceId,
    agentId: input.agentId,
  };
}
