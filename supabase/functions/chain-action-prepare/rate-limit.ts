export type ChainActionRateLimitDecision =
  | { allowed: true; status: "allowed" }
  | { allowed: false; status: "rate_limited" };

export interface ChainActionRateLimitRpcClient {
  rpc: (
    functionName: "consume_chain_action_rate_limit",
    args: {
      p_owner_user_id: string;
      p_workspace_id: string;
      p_agent_id: string;
      p_chain_key: string;
    },
  ) => Promise<{ data: unknown; error: unknown }>;
}

export const chainActionMinuteMax = 6;
export const chainActionHourMax = 60;

export function createChainActionRateLimitChecker(
  client: ChainActionRateLimitRpcClient,
) {
  return async (input: {
    ownerUserId: string;
    workspaceId: string;
    agentId: string;
    chainKey: string;
  }): Promise<ChainActionRateLimitDecision> => {
    try {
      const result = await client.rpc("consume_chain_action_rate_limit", {
        p_owner_user_id: input.ownerUserId,
        p_workspace_id: input.workspaceId,
        p_agent_id: input.agentId,
        p_chain_key: input.chainKey,
      });
      if (result.error) throw new Error("rate limit failed");
      return readChainActionRateLimitDecision(result.data);
    } catch {
      throw new Error("Chain action rate limit check failed.");
    }
  };
}

export function readChainActionRateLimitDecision(
  value: unknown,
): ChainActionRateLimitDecision {
  if (!Array.isArray(value) || value.length !== 1) throw invalidResponse();
  const row = value[0];
  if (
    typeof row !== "object" ||
    row === null ||
    Array.isArray(row) ||
    Object.keys(row).sort().join(",") !== "allowed,status"
  ) {
    throw invalidResponse();
  }
  const record = row as Record<string, unknown>;
  if (record.allowed === true && record.status === "allowed") {
    return { allowed: true, status: "allowed" };
  }
  if (record.allowed === false && record.status === "rate_limited") {
    return { allowed: false, status: "rate_limited" };
  }
  throw invalidResponse();
}

function invalidResponse() {
  return new Error("Chain action rate limit response is invalid.");
}
