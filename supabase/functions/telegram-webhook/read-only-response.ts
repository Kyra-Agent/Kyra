import { HttpError } from "./core.ts";
import type { TelegramWebhookParsedCommandName } from "./update-parser.ts";

export interface TelegramReadOnlyCommandResponse {
  command: TelegramWebhookParsedCommandName;
  text: string;
}

const helpText = [
  "Kyra Telegram commands",
  "/help, /status, /agent, /actions, /modules",
  "Read-only mode.",
  "Write, approval, wallet, and onchain actions are disabled.",
].join("\n");

const statusText = [
  "Kyra Telegram session: active",
  "Command access: read-only",
  "Write, approval, wallet, and onchain actions: disabled",
].join("\n");

const agentText = [
  "Kyra agent: active",
  "Mode: read-only Telegram interface",
  "Wallet and onchain actions require dashboard approval.",
].join("\n");

const actionsText = [
  "Available read-only commands: /help, /status, /agent, /actions, /modules",
  "Write, wallet, approval, and onchain actions are disabled.",
].join("\n");

const modulesText = [
  "Kyra modules: available through read-only Telegram context",
  "Module execution, wallet actions, and onchain actions stay gated.",
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

  if (command === "agent") {
    return { command, text: agentText };
  }

  if (command === "actions") {
    return { command, text: actionsText };
  }

  if (command === "modules") {
    return { command, text: modulesText };
  }

  throw new HttpError(
    422,
    "unsupported_update",
    "Telegram update is not supported.",
  );
}
