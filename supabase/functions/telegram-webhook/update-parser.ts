import { HttpError } from "./core.ts";

export type TelegramWebhookParsedCommandName =
  | "help"
  | "status"
  | "agent"
  | "actions"
  | "modules"
  | "policy"
  | "forget"
  | "community_on"
  | "community_off"
  | "watch"
  | "unwatch"
  | "watchlist"
  | "alert"
  | "alerts"
  | "alerts_clear"
  | "launches"
  | "swap"
  | "dca"
  | "stoploss"
  | "takeprofit"
  | "rules"
  | "rules_clear"
  | "chat";

export type TelegramChatType = "private" | "group" | "supergroup" | "other";

export interface TelegramWebhookParsedCommand {
  updateId: string;
  messageId: string;
  telegramUserId: string;
  telegramChatId: string;
  languageCode?: string;
  command: TelegramWebhookParsedCommandName;
  commandKind: "read_only";
  text?: string;
  // Absent on older fixtures; treated as a private chat.
  chatType?: TelegramChatType;
  // In groups, true only for /ask, commands, replies to the bot, or messages
  // that mention it. Private chats are always addressed to the bot.
  addressedToBot?: boolean;
  chatTitle?: string;
}

export interface TelegramWebhookUpdateParseOptions {
  expectedBotUsername?: string | null;
}

const supportedCommands = new Set<TelegramWebhookParsedCommandName>([
  "help",
  "status",
  "agent",
  "actions",
  "modules",
  "policy",
  "forget",
  "community_on",
  "community_off",
  "watchlist",
  "alerts",
  "alerts_clear",
  "rules",
  "rules_clear",
]);
// Monitoring commands that carry arguments ("/watch 0x...", "/launches on").
const argumentCommands = new Set<TelegramWebhookParsedCommandName>([
  "watch",
  "unwatch",
  "alert",
  "launches",
  "swap",
  "dca",
  "stoploss",
  "takeprofit",
]);
const telegramCommandPattern =
  /^\/([A-Za-z][A-Za-z0-9_]*)(?:@([A-Za-z0-9_]{5,32}))?$/;
const telegramArgumentCommandPattern =
  /^\/([A-Za-z][A-Za-z0-9_]*)(?:@([A-Za-z0-9_]{5,32}))?(?:\s+([\s\S]*))?$/;
const telegramAskPattern =
  /^\/ask(?:@([A-Za-z0-9_]{5,32}))?(?:\s+([\s\S]*))?$/i;
const telegramBotUsernamePattern = /^[A-Za-z0-9_]{5,32}$/;
const telegramLanguageCodePattern = /^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/;
const maxReadOnlyChatTextLength = 1000;

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
  const languageCode = readLanguageCode(from.language_code);
  const chatType = readChatType(chat.type);
  const parsedMessage = parseReadOnlyMessageText(
    message.text,
    options.expectedBotUsername,
  );
  const isGroup = chatType === "group" || chatType === "supergroup";
  const botUsername = normalizeExpectedBotUsername(options.expectedBotUsername);
  let text = parsedMessage.text;
  let addressedToBot = !isGroup || parsedMessage.addressed;

  if (isGroup && parsedMessage.command === "chat" && !parsedMessage.addressed) {
    const mentionsBot = Boolean(
      botUsername && text?.toLowerCase().includes(`@${botUsername}`),
    );
    addressedToBot = mentionsBot || isReplyToBot(message.reply_to_message, botUsername);

    if (mentionsBot && text && botUsername) {
      // botUsername is limited to [A-Za-z0-9_], so it is safe inside a RegExp.
      text = text.replace(new RegExp(`@${botUsername}\\b`, "gi"), "")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  const chatTitle = isGroup ? readChatTitle(chat.title) : "";

  return {
    updateId: String(updateId),
    messageId: String(messageId),
    telegramUserId: String(telegramUserId),
    telegramChatId: String(telegramChatId),
    ...(languageCode ? { languageCode } : {}),
    command: parsedMessage.command,
    commandKind: "read_only",
    ...(text ? { text } : {}),
    chatType,
    addressedToBot,
    ...(chatTitle ? { chatTitle } : {}),
  };
}

function readChatType(value: unknown): TelegramChatType {
  return value === "private" || value === "group" || value === "supergroup"
    ? value
    : value === undefined
    ? "private"
    : "other";
}

function readChatTitle(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  return value.replace(/[\u0000-\u001f\u007f<>`]/g, "").trim().slice(0, 64);
}

function isReplyToBot(value: unknown, botUsername: string | null) {
  if (!botUsername || typeof value !== "object" || value === null) {
    return false;
  }

  const from = (value as Record<string, unknown>).from;

  if (typeof from !== "object" || from === null) {
    return false;
  }

  const sender = from as Record<string, unknown>;
  return sender.is_bot === true &&
    typeof sender.username === "string" &&
    sender.username.toLowerCase() === botUsername;
}

function readLanguageCode(value: unknown) {
  if (
    typeof value !== "string" ||
    !telegramLanguageCodePattern.test(value)
  ) {
    return null;
  }

  return value;
}

function readMessage(value: unknown) {
  if (value === undefined) {
    throw unsupportedUpdate();
  }

  return assertRecord(value);
}

function parseReadOnlyMessageText(
  value: unknown,
  expectedBotUsername: string | null | undefined,
): {
  command: TelegramWebhookParsedCommandName;
  text?: string;
  // True when the message targets the bot explicitly (a command or /ask).
  addressed: boolean;
} {
  if (typeof value !== "string") {
    throw unsupportedUpdate();
  }

  const text = value.trim();

  if (!text) {
    throw unsupportedUpdate();
  }

  if (!value.startsWith("/")) {
    if (text.length > maxReadOnlyChatTextLength) {
      throw unsupportedUpdate();
    }

    return { command: "chat", text, addressed: false };
  }

  const argumentMatch = telegramArgumentCommandPattern.exec(text);
  const argumentCommand = argumentMatch?.[1]?.toLowerCase() as
    | TelegramWebhookParsedCommandName
    | undefined;

  if (argumentMatch && argumentCommand && argumentCommands.has(argumentCommand)) {
    const targetBotUsername = argumentMatch[2];

    if (
      targetBotUsername &&
      targetBotUsername.toLowerCase() !==
        normalizeExpectedBotUsername(expectedBotUsername)
    ) {
      throw unsupportedUpdate();
    }

    const args = (argumentMatch[3] ?? "").trim().replace(/\s+/g, " ");

    if (args.length > 200) {
      throw unsupportedUpdate();
    }

    return {
      command: argumentCommand,
      ...(args ? { text: args } : {}),
      addressed: true,
    };
  }

  // "/ask <question>" is how group members talk to the bot when Telegram's
  // privacy mode hides plain messages from it.
  const askMatch = telegramAskPattern.exec(text);

  if (askMatch) {
    const targetBotUsername = askMatch[1];

    if (
      targetBotUsername &&
      targetBotUsername.toLowerCase() !==
        normalizeExpectedBotUsername(expectedBotUsername)
    ) {
      throw unsupportedUpdate();
    }

    const question = (askMatch[2] ?? "").trim();

    if (!question) {
      return { command: "help", addressed: true };
    }

    if (question.length > maxReadOnlyChatTextLength) {
      throw unsupportedUpdate();
    }

    return { command: "chat", text: question, addressed: true };
  }

  if (text !== value) {
    throw unsupportedUpdate();
  }

  const match = telegramCommandPattern.exec(text);
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

  return { command: command as TelegramWebhookParsedCommandName, addressed: true };
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
