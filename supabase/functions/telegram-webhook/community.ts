import { HttpError } from "./core.ts";

// Community mode for Telegram groups (see the telegram_community_chats
// migration). These wrappers validate identifiers and RPC results; the
// database decides ownership and limits.

export type TelegramCommunitySetResult =
  | "enabled"
  | "already_enabled"
  | "disabled"
  | "already_disabled"
  | "not_owner"
  | "not_group"
  | "limit_reached";

export type TelegramCommunityQuotaResult =
  | "allowed"
  | "member_limited"
  | "group_limited";

export interface TelegramCommunityRpcResult {
  data?: unknown;
  error?: unknown | null;
}

export interface TelegramCommunityRpcClient {
  rpc(
    functionName:
      | "set_telegram_community_chat"
      | "resolve_telegram_community_chat"
      | "consume_telegram_community_quota",
    args: Record<string, string | boolean>,
  ): Promise<TelegramCommunityRpcResult> | TelegramCommunityRpcResult;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const groupChatIdPattern = /^-[1-9][0-9]{0,19}$/;
const userIdPattern = /^[1-9][0-9]{0,19}$/;
const setResults = new Set<TelegramCommunitySetResult>([
  "enabled",
  "already_enabled",
  "disabled",
  "already_disabled",
  "not_owner",
  "not_group",
  "limit_reached",
]);
const quotaResults = new Set<TelegramCommunityQuotaResult>([
  "allowed",
  "member_limited",
  "group_limited",
]);

export function isTelegramGroupChatId(value: unknown) {
  return typeof value === "string" && groupChatIdPattern.test(value);
}

export async function setTelegramCommunityChat(input: {
  agentId: unknown;
  telegramUserId: unknown;
  telegramChatId: unknown;
  chatTitle: unknown;
  enabled: boolean;
  rpcClient: TelegramCommunityRpcClient;
}): Promise<TelegramCommunitySetResult> {
  if (!isTelegramGroupChatId(input.telegramChatId)) {
    return "not_group";
  }

  const data = await callCommunityRpc(input.rpcClient, "set_telegram_community_chat", {
    p_agent_id: readAgentId(input.agentId),
    p_telegram_user_id: readUserId(input.telegramUserId),
    p_telegram_chat_id: input.telegramChatId as string,
    p_chat_title: typeof input.chatTitle === "string" ? input.chatTitle.slice(0, 64) : "",
    p_enabled: input.enabled,
  });

  if (typeof data !== "string" || !setResults.has(data as TelegramCommunitySetResult)) {
    throw communityFailure();
  }

  return data as TelegramCommunitySetResult;
}

export async function isTelegramCommunityChatEnabled(input: {
  agentId: unknown;
  telegramChatId: unknown;
  rpcClient: TelegramCommunityRpcClient;
}) {
  if (!isTelegramGroupChatId(input.telegramChatId)) {
    return false;
  }

  const data = await callCommunityRpc(
    input.rpcClient,
    "resolve_telegram_community_chat",
    {
      p_agent_id: readAgentId(input.agentId),
      p_telegram_chat_id: input.telegramChatId as string,
    },
  );

  return data === true;
}

export async function consumeTelegramCommunityQuota(input: {
  agentId: unknown;
  telegramChatId: unknown;
  telegramUserId: unknown;
  rpcClient: TelegramCommunityRpcClient;
}): Promise<TelegramCommunityQuotaResult> {
  if (!isTelegramGroupChatId(input.telegramChatId)) {
    throw communityFailure();
  }

  const data = await callCommunityRpc(
    input.rpcClient,
    "consume_telegram_community_quota",
    {
      p_agent_id: readAgentId(input.agentId),
      p_telegram_chat_id: input.telegramChatId as string,
      p_telegram_user_id: readUserId(input.telegramUserId),
    },
  );

  if (typeof data !== "string" || !quotaResults.has(data as TelegramCommunityQuotaResult)) {
    throw communityFailure();
  }

  return data as TelegramCommunityQuotaResult;
}

async function callCommunityRpc(
  client: TelegramCommunityRpcClient,
  functionName:
    | "set_telegram_community_chat"
    | "resolve_telegram_community_chat"
    | "consume_telegram_community_quota",
  args: Record<string, string | boolean>,
) {
  try {
    const result = await client.rpc(functionName, args);

    if (!result || result.error) {
      throw communityFailure();
    }

    return result.data;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw communityFailure();
  }
}

function readAgentId(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw communityFailure();
  }

  return value;
}

function readUserId(value: unknown) {
  if (typeof value !== "string" || !userIdPattern.test(value)) {
    throw communityFailure();
  }

  return value;
}

function communityFailure() {
  return new HttpError(
    500,
    "telegram_community_failed",
    "Telegram community mode is unavailable.",
  );
}
