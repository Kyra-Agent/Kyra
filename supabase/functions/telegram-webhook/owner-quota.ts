import { HttpError } from "./core.ts";

// Caps how often one agent's owner chat can reach the agent brain (see the
// telegram_owner_brain_usage migration). The database counts and decides.

export type TelegramOwnerBrainQuotaResult =
  | "allowed"
  | "burst_limited"
  | "daily_limited";

export interface TelegramOwnerQuotaRpcClient {
  rpc(
    functionName: "consume_telegram_owner_brain_quota",
    args: Record<string, string>,
  ):
    | Promise<{ data?: unknown; error?: unknown | null }>
    | { data?: unknown; error?: unknown | null };
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const quotaResults = new Set<TelegramOwnerBrainQuotaResult>([
  "allowed",
  "burst_limited",
  "daily_limited",
]);

export const ownerQuotaTexts = {
  burst_limited:
    "You're sending questions faster than this agent can answer them. Give it a few minutes and ask again. Commands like /watchlist and /alerts still work.",
  daily_limited:
    "This agent has reached today's limit for AI answers. It resets within 24 hours. Commands like /watchlist, /alerts, and your price alerts keep working.",
} as const;

export async function consumeTelegramOwnerBrainQuota(input: {
  agentId: unknown;
  rpcClient: TelegramOwnerQuotaRpcClient;
}): Promise<TelegramOwnerBrainQuotaResult> {
  if (typeof input.agentId !== "string" || !uuidPattern.test(input.agentId)) {
    throw ownerQuotaFailure();
  }

  let data: unknown;

  try {
    const result = await input.rpcClient.rpc(
      "consume_telegram_owner_brain_quota",
      { p_agent_id: input.agentId },
    );

    if (!result || result.error) {
      throw ownerQuotaFailure();
    }

    data = result.data;
  } catch {
    throw ownerQuotaFailure();
  }

  if (typeof data !== "string" || !quotaResults.has(data as TelegramOwnerBrainQuotaResult)) {
    throw ownerQuotaFailure();
  }

  return data as TelegramOwnerBrainQuotaResult;
}

function ownerQuotaFailure() {
  return new HttpError(
    500,
    "telegram_owner_quota_failed",
    "Telegram owner quota is unavailable.",
  );
}
