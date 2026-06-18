export type BaseMcpRateLimitDecision =
  | { allowed: true; status: "allowed" }
  | { allowed: false; status: "rate_limited" };

export interface BaseMcpRateLimitRpcClient {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
}

export const baseMcpStatusMinuteMax = 6;
export const baseMcpStatusHourMax = 60;

export function createBaseMcpStatusRateLimitChecker(
  rpcClient: BaseMcpRateLimitRpcClient,
) {
  return async (input: {
    ownerUserId: string;
    workspaceId: string;
    agentId: string;
  }): Promise<BaseMcpRateLimitDecision> => {
    try {
      const result = await rpcClient.rpc(
        "consume_base_mcp_status_rate_limit",
        {
          p_owner_user_id: input.ownerUserId,
          p_workspace_id: input.workspaceId,
          p_agent_id: input.agentId,
        },
      );

      if (result.error) {
        throw new Error("Base MCP rate limit RPC failed.");
      }

      return readBaseMcpRateLimitDecision(result.data);
    } catch {
      throw new Error("Base MCP rate limit check failed.");
    }
  };
}

export function readBaseMcpRateLimitDecision(
  value: unknown,
): BaseMcpRateLimitDecision {
  if (!Array.isArray(value) || value.length !== 1) {
    throw new Error("Base MCP rate limit response is invalid.");
  }

  const row = value[0];

  if (
    typeof row !== "object" ||
    row === null ||
    Array.isArray(row) ||
    Object.keys(row).sort().join(",") !== "allowed,status"
  ) {
    throw new Error("Base MCP rate limit response is invalid.");
  }

  const record = row as Record<string, unknown>;

  if (record.allowed === true && record.status === "allowed") {
    return { allowed: true, status: "allowed" };
  }

  if (record.allowed === false && record.status === "rate_limited") {
    return { allowed: false, status: "rate_limited" };
  }

  throw new Error("Base MCP rate limit response is invalid.");
}
