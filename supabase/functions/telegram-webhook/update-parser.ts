import { HttpError } from "./core.ts";

export type TelegramWebhookParsedCommandName = "help" | "status";

export interface TelegramWebhookParsedCommand {
  updateId: string;
  messageId: string;
  telegramUserId: string;
  telegramChatId: string;
  command: TelegramWebhookParsedCommandName;
  commandKind: "read_only";
}

export interface TelegramWebhookUpdateParseOptions {
  expectedBotUsername?: string | null;
}

const supportedCommands = new Set<TelegramWebhookParsedCommandName>([
  "help",
  "status",
]);
const telegramCommandPattern =
  /^\/([A-Za-z][A-Za-z0-9_]*)(?:@([A-Za-z0-9_]{5,32}))?$/;
const telegramBotUsernamePattern = /^[A-Za-z0-9_]{5,32}$/;

export function parseTelegramWebhookUpdate(
  value: unknown,
  options: TelegramWebhookUpdateParseOptions = {},
): TelegramWebhookParsedCommand {
  const update = assertRecord(value);
  const updateId = readUpdateId(update.update_id);
  const message = readMessage(update.message);
  const messageId = readPositiveSafeInteger(message.message_id);
  const from = assertRecord(message.from);
  const chat = assertRecord(message.chat);
  const telegramUserId = readPositiveSafeInteger(from.id);
  const telegramChatId = readNonZeroSafeInteger(chat.id);
  const command = parseReadOnlyCommand(
    message.text,
    options.expectedBotUsername,
  );

  return {
    updateId: String(updateId),
    messageId: String(messageId),
    telegramUserId: String(telegramUserId),
    telegramChatId: String(telegramChatId),
    command,
    commandKind: "read_only",
  };
}

function readMessage(value: unknown) {
  if (value === undefined) {
    throw unsupportedUpdate();
  }

  return assertRecord(value);
}

function parseReadOnlyCommand(
  value: unknown,
  expectedBotUsername: string | null | undefined,
): TelegramWebhookParsedCommandName {
  if (typeof value !== "string") {
    throw unsupportedUpdate();
  }

  const match = telegramCommandPattern.exec(value);
  const command = match?.[1]?.toLowerCase();
  const targetBotUsername = match?.[2];

  if (
    !command ||
    !supportedCommands.has(command as TelegramWebhookParsedCommandName)
  ) {
    throw unsupportedUpdate();
  }

  if (
    targetBotUsername &&
    targetBotUsername.toLowerCase() !==
      normalizeExpectedBotUsername(expectedBotUsername)
  ) {
    throw unsupportedUpdate();
  }

  return command as TelegramWebhookParsedCommandName;
}

function normalizeExpectedBotUsername(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const username = value.startsWith("@") ? value.slice(1) : value;

  if (!telegramBotUsernamePattern.test(username)) {
    return null;
  }

  return username.toLowerCase();
}

function assertRecord(value: unknown): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw invalidUpdate();
  }

  return value as Record<string, unknown>;
}

function readUpdateId(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw invalidUpdate();
  }

  return value as number;
}

function readPositiveSafeInteger(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw invalidUpdate();
  }

  return value as number;
}

function readNonZeroSafeInteger(value: unknown) {
  if (!Number.isSafeInteger(value) || value === 0) {
    throw invalidUpdate();
  }

  return value as number;
}

function invalidUpdate() {
  return new HttpError(
    400,
    "invalid_update",
    "Telegram update is invalid.",
  );
}

function unsupportedUpdate() {
  return new HttpError(
    422,
    "unsupported_update",
    "Telegram update is not supported.",
  );
}
