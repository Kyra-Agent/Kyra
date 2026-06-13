import { HttpError } from "./core.ts";
import type { TelegramWebhookParsedCommandName } from "./update-parser.ts";

export interface TelegramReadOnlyCommandResponse {
  command: TelegramWebhookParsedCommandName;
  text: string;
}

const helpText = [
  "Kyra Telegram commands",
  "/help, /status, /agent, /actions, /modules, /policy",
  "Use /agent for profile, /actions for ready work, /modules for stack.",
  "Boundary: wallet, write, approval, and onchain execution are disabled.",
].join("\n");

const statusText = [
  "Kyra Telegram session: active",
  "Command access: read-only",
  "Live replies: agent, actions, modules",
  "Execution: wallet, write, approval, and onchain disabled",
].join("\n");

const agentText = [
  "Kyra agent interface",
  "Role: read-only Telegram operator",
  "Focus: template profile, actions, and module stack",
  "Next: /actions or /modules",
].join("\n");

const actionsText = [
  "Kyra actions",
  "Ready in Telegram: /help, /status, /agent, /actions, /modules",
  "Dashboard gated: write and approval",
  "Phase 6 gated: wallet and onchain execution",
].join("\n");

const modulesText = [
  "Kyra modules view",
  "Shows the deployed template stack when context is available.",
  "Global module activation and execution stay gated outside Telegram.",
].join("\n");

const policyText = [
  "Kyra policy: approval required",
  "Telegram can brief and plan only.",
  "Wallet, write, approval, and onchain execution stay disabled.",
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

  if (command === "policy") {
    return { command, text: policyText };
  }

  throw new HttpError(
    422,
    "unsupported_update",
    "Telegram update is not supported.",
  );
}
