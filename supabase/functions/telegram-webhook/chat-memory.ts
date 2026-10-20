import { HttpError } from "./core.ts";

// Short-term memory for the owner's Telegram chat. The database keeps at most
// the last six messages for 24 hours (see the telegram_chat_memory migration);
// this module redacts and bounds what goes in and validates what comes out.

export type TelegramChatMemoryRole = "user" | "assistant";

export interface TelegramChatMemoryTurn {
  role: TelegramChatMemoryRole;
  content: string;
}

export interface TelegramChatMemoryRpcResult {
  data?: unknown;
  error?: unknown | null;
}

export interface TelegramChatMemoryRpcClient {
  rpc(
    functionName:
      | "load_telegram_chat_memory"
      | "append_telegram_chat_memory"
      | "forget_telegram_chat_memory",
    args: Record<string, string>,
  ): Promise<TelegramChatMemoryRpcResult> | TelegramChatMemoryRpcResult;
}

export const maxTelegramChatMemoryTurns = 6;
export const maxTelegramChatMemoryContentLength = 1000;

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const telegramChatIdPattern = /^-?[0-9]{1,20}$/;
const memorySecretPatterns = [
  /\d{5,20}:[A-Za-z0-9_-]{20,128}/g,
  /sk-(?:or-v1-)?[A-Za-z0-9_-]{20,}/g,
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /(?<![0-9A-Fa-fx])[0-9A-Fa-f]{64}(?![0-9A-Fa-f])/g,
  /\b(?:private\s+key|kunci\s+privat|seed\s+phrase|frasa\s+seed|recovery\s+phrase|frasa\s+pemulihan|mnemonic)\b[^\n]*/gi,
];

export function redactTelegramChatMemoryText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  let text = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "");

  for (const pattern of memorySecretPatterns) {
    text = text.replace(pattern, "[redacted]");
  }

  return text.trim().slice(0, maxTelegramChatMemoryContentLength).trim();
}

export async function loadTelegramChatMemory(input: {
  telegramSessionId: unknown;
  telegramChatId: unknown;
  rpcClient: TelegramChatMemoryRpcClient;
}): Promise<TelegramChatMemoryTurn[]> {
  const result = await callMemoryRpc(input.rpcClient, "load_telegram_chat_memory", {
    p_telegram_session_id: readSessionId(input.telegramSessionId),
    p_telegram_chat_id: readChatId(input.telegramChatId),
  });

  if (!Array.isArray(result)) {
    throw memoryFailure();
  }

  return result
    .slice(-maxTelegramChatMemoryTurns)
    .map(readMemoryTurn)
    .filter((turn): turn is TelegramChatMemoryTurn => turn !== null);
}

export async function appendTelegramChatMemory(input: {
  telegramSessionId: unknown;
  telegramChatId: unknown;
  userText: unknown;
  assistantText: unknown;
  rpcClient: TelegramChatMemoryRpcClient;
}) {
  const userContent = redactTelegramChatMemoryText(input.userText);
  const assistantContent = redactTelegramChatMemoryText(input.assistantText);

  if (!userContent || !assistantContent) {
    return;
  }

  await callMemoryRpc(input.rpcClient, "append_telegram_chat_memory", {
    p_telegram_session_id: readSessionId(input.telegramSessionId),
    p_telegram_chat_id: readChatId(input.telegramChatId),
    p_user_content: userContent,
    p_assistant_content: assistantContent,
  });
}

export async function forgetTelegramChatMemory(input: {
  telegramSessionId: unknown;
  telegramChatId: unknown;
  rpcClient: TelegramChatMemoryRpcClient;
}) {
  const result = await callMemoryRpc(
    input.rpcClient,
    "forget_telegram_chat_memory",
    {
      p_telegram_session_id: readSessionId(input.telegramSessionId),
      p_telegram_chat_id: readChatId(input.telegramChatId),
    },
  );

  return typeof result === "number" && Number.isSafeInteger(result) &&
      result >= 0
    ? result
    : 0;
}

async function callMemoryRpc(
  client: TelegramChatMemoryRpcClient,
  functionName:
    | "load_telegram_chat_memory"
    | "append_telegram_chat_memory"
    | "forget_telegram_chat_memory",
  args: Record<string, string>,
) {
  try {
    const result = await client.rpc(functionName, args);

    if (!result || result.error) {
      throw memoryFailure();
    }

    return result.data;
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw memoryFailure();
  }
}

function readMemoryTurn(value: unknown): TelegramChatMemoryTurn | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const row = value as Record<string, unknown>;

  if (row.role !== "user" && row.role !== "assistant") {
    return null;
  }

  const content = redactTelegramChatMemoryText(row.content);

  return content ? { role: row.role, content } : null;
}

function readSessionId(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throw memoryFailure();
  }

  return value;
}

function readChatId(value: unknown) {
  if (typeof value !== "string" || !telegramChatIdPattern.test(value)) {
    throw memoryFailure();
  }

  return value;
}

function memoryFailure() {
  return new HttpError(
    500,
    "telegram_chat_memory_failed",
    "Telegram chat memory is unavailable.",
  );
}
