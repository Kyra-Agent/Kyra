import { HttpError } from "./core.ts";
import type { TelegramWebhookParsedCommandName } from "./update-parser.ts";

export interface TelegramReadOnlyCommandResponse {
  command: TelegramWebhookParsedCommandName;
  text: string;
}

const helpText = [
  "Kyra Telegram",
  "Commands: /help /status /agent /actions /modules /policy",
  "Plain text: campaign plan for Agent 666; launch copy; narrative map; community pulse; risk review.",
  "Boundary: wallet and onchain execution are disabled.",
].join("\n");

const statusText = [
  "Kyra Telegram session: active",
  "Command access: read-only",
  "Live replies: commands and read-only natural chat",
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
  "Ready in Telegram: market brief, campaign plan, narrative map, launch copy, community pulse",
  "Use commands or plain text requests.",
  "Dashboard gated: write and approval",
  "Owner approval required: wallet and onchain execution",
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
  text?: unknown,
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

  if (command === "chat") {
    return {
      command,
      text: buildTelegramReadOnlyChatFallbackText(text),
    };
  }

  throw new HttpError(
    422,
    "unsupported_update",
    "Telegram update is not supported.",
  );
}

export type TelegramReadOnlyChatIntent =
  | "market_brief"
  | "campaign_plan"
  | "narrative_map"
  | "launch_copy"
  | "community_pulse"
  | "module_status"
  | "agent_profile"
  | "policy"
  | "help"
  | "unsafe_execution"
  | "general";

const unsafeExecutionPattern =
  /\b(send|transfer|swap|approve|approval|allowance|permit|revoke|sign|execute|bridge|mint|burn|stake|unstake|claim|withdraw|deposit|buy|sell|delegate|wrap|unwrap|borrow|lend|liquidate|repay)\b|\b(wallet|private key|seed phrase|robinhood chain actions|onchain|contract call|calldata|transaction|tx)\b/i;

export function classifyTelegramReadOnlyChatIntent(
  value: unknown,
): TelegramReadOnlyChatIntent {
  if (typeof value !== "string") {
    return "general";
  }

  const text = value.toLowerCase();

  if (unsafeExecutionPattern.test(text)) {
    return "unsafe_execution";
  }

  if (/\b(help|what can you do|commands?|capabilities)\b/i.test(text)) {
    return "help";
  }

  if (/\b(policy|permission|allowed|disabled|gated|approval)\b/i.test(text)) {
    return "policy";
  }

  if (/\b(module|stack|nira|vexa|astra|nova|nyx)\b/i.test(text)) {
    return "module_status";
  }

  if (
    /\b(campaign|go[- ]?to[- ]?market|gtm|roadmap|launch plan)\b/i.test(text)
  ) {
    return "campaign_plan";
  }

  if (/\b(narrative|positioning|angle|thesis|story)\b/i.test(text)) {
    return "narrative_map";
  }

  if (/\b(copy|tweet|thread|announcement|caption|cta|post)\b/i.test(text)) {
    return "launch_copy";
  }

  if (
    /\b(community|sentiment|pulse|engagement|discord|telegram group)\b/i.test(
      text,
    )
  ) {
    return "community_pulse";
  }

  if (/\b(market|brief|trend|liquidity|volume|price|token)\b/i.test(text)) {
    return "market_brief";
  }

  if (/\b(agent|profile|role|who are you)\b/i.test(text)) {
    return "agent_profile";
  }

  return "general";
}

function buildTelegramReadOnlyChatFallbackText(text: unknown) {
  const intent = classifyTelegramReadOnlyChatIntent(text);

  if (intent === "unsafe_execution") {
    return [
      "Kyra cannot execute that from Telegram.",
      "Wallet signing, approvals, and onchain execution are disabled.",
      "I can turn it into a read-only risk review or checklist.",
    ].join("\n");
  }

  if (intent === "help") {
    return helpText;
  }

  if (intent === "module_status") {
    return modulesText;
  }

  if (intent === "agent_profile") {
    return agentText;
  }

  if (intent === "policy") {
    return policyText;
  }

  return [
    "Kyra read-only chat is online.",
    "Ask for market brief, campaign plan, narrative map, launch copy, or community pulse.",
    "Telegram can brief and plan only. Wallet, approval, Robinhood Chain actions, and onchain execution stay disabled.",
  ].join("\n");
}
