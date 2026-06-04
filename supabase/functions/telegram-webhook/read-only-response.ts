import { HttpError } from "./core.ts";
import type { TelegramWebhookParsedCommandName } from "./update-parser.ts";

export interface TelegramReadOnlyCommandResponse {
  command: TelegramWebhookParsedCommandName;
  text: string;
}

const helpText = [
  "Kyra Telegram commands",
  "/help - Show this command list",
  "/status - Show connection safety status",
  "",
  "Write, approval, wallet, and onchain actions are disabled.",
].join("\n");

const statusText = [
  "Kyra Telegram session: active",
  "Command access: read-only",
  "Write, approval, wallet, and onchain actions: disabled",
].join("\n");

export function buildTelegramReadOnlyCommandResponse(
  command: unknown,
): TelegramReadOnlyCommandResponse {
  if (command === "help") {
    return { command, text: helpText };
  }

  if (command === "status") {
    return { command, text: statusText };
  }

  throw new HttpError(
    422,
    "unsupported_update",
    "Telegram update is not supported.",
  );
}
