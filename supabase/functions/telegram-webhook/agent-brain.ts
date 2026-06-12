import { HttpError, sanitizeErrorMessage } from "./core.ts";
import type { TelegramWebhookParsedCommandName } from "./update-parser.ts";

export interface TelegramAgentBrainPromptInput {
  command: unknown;
  agentName?: unknown;
  agentRole?: unknown;
  capabilities?: unknown;
}

export interface TelegramAgentBrainRequest {
  messages: readonly TelegramAgentBrainMessage[];
  maxOutputCharacters: number;
  mode: "read_only";
}

export interface TelegramAgentBrainMessage {
  role: "system" | "user";
  content: string;
}

export interface TelegramAgentBrainProvider {
  complete(request: TelegramAgentBrainRequest): Promise<unknown>;
}

export interface TelegramAgentBrainReply {
  text: string;
}

const supportedReadOnlyCommands = new Set<TelegramWebhookParsedCommandName>([
  "help",
  "status",
  "agent",
  "actions",
  "modules",
  "policy",
]);
const maxAgentNameLength = 48;
const maxAgentRoleLength = 72;
const maxCapabilityCount = 6;
const maxCapabilityLength = 32;
const maxAgentBrainOutputCharacters = 700;
const secretLikePatterns = [
  /\d{5,20}:[A-Za-z0-9_-]{20,128}/,
  /sb_secret_[A-Za-z0-9_-]+/,
  /sb_publishable_[A-Za-z0-9_-]+/,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/,
  /token_secret_ref/i,
  /webhook_secret/i,
  /owner_user_id/i,
  /workspace_id/i,
  /telegramUserId/i,
  /telegramChatId/i,
  /api\.telegram\.org/i,
];
const unsafeExecutionClaims = [
  /transaction\s+(sent|executed|submitted|confirmed)/i,
  /(swap|send|transfer)\s+(completed|executed|submitted)/i,
  /wallet\s+(approved|signed)/i,
  /private\s+key/i,
  /seed\s+phrase/i,
];

export function buildTelegramAgentBrainRequest(
  input: TelegramAgentBrainPromptInput,
): TelegramAgentBrainRequest {
  const command = assertTelegramAgentBrainCommand(input.command);
  const agentName = sanitizePromptFragment(
    input.agentName,
    maxAgentNameLength,
    "Kyra Agent",
  );
  const agentRole = sanitizePromptFragment(
    input.agentRole,
    maxAgentRoleLength,
    "Telegram read-only agent",
  );
  const capabilities = sanitizeCapabilities(input.capabilities);

  return {
    mode: "read_only",
    maxOutputCharacters: maxAgentBrainOutputCharacters,
    messages: [
      {
        role: "system",
        content: [
          "You are Kyra's Telegram agent brain.",
          "Answer only in read-only mode.",
          "Do not claim that wallet, approval, Base, or onchain actions were executed.",
          "Do not include secrets, internal IDs, token refs, webhook refs, or raw database details.",
          "Keep the reply concise and safe for Telegram.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Command: /${command}`,
          `Agent: ${agentName}`,
          `Role: ${agentRole}`,
          `Allowed capabilities: ${capabilities.join(", ")}`,
        ].join("\n"),
      },
    ],
  };
}

export async function generateTelegramAgentBrainReply(
  input: TelegramAgentBrainPromptInput,
  provider: TelegramAgentBrainProvider,
): Promise<TelegramAgentBrainReply> {
  const request = buildTelegramAgentBrainRequest(input);

  try {
    const response = await provider.complete(request);
    return assertTelegramAgentBrainReply(response);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw sanitizeTelegramAgentBrainProviderError(error);
  }
}

export function assertTelegramAgentBrainCommand(
  value: unknown,
): TelegramWebhookParsedCommandName {
  if (
    typeof value !== "string" ||
    !supportedReadOnlyCommands.has(value as TelegramWebhookParsedCommandName)
  ) {
    throw new HttpError(
      422,
      "unsupported_update",
      "Telegram update is not supported.",
    );
  }

  return value as TelegramWebhookParsedCommandName;
}

export function assertTelegramAgentBrainReply(
  value: unknown,
): TelegramAgentBrainReply {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw invalidAgentBrainResponse();
  }

  const response = value as Record<string, unknown>;
  const keys = Object.keys(response).sort();

  if (keys.join(",") !== "text") {
    throw invalidAgentBrainResponse();
  }

  if (typeof response.text !== "string") {
    throw invalidAgentBrainResponse();
  }

  const text = response.text.trim();

  if (!text || text.length > maxAgentBrainOutputCharacters) {
    throw invalidAgentBrainResponse();
  }

  assertSafeTelegramAgentBrainText(text);

  return { text };
}

export function sanitizeTelegramAgentBrainProviderError(_error: unknown) {
  return new HttpError(
    503,
    "agent_brain_unavailable",
    "Kyra agent brain is unavailable.",
  );
}

function sanitizePromptFragment(
  value: unknown,
  maxLength: number,
  fallback: string,
) {
  if (typeof value !== "string") {
    return fallback;
  }

  const sanitized = sanitizeForPrompt(value).slice(0, maxLength).trim();
  return sanitized || fallback;
}

function sanitizeCapabilities(value: unknown) {
  if (!Array.isArray(value)) {
    return ["help", "status", "agent", "actions", "modules", "policy"];
  }

  const capabilities = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeForPrompt(item).slice(0, maxCapabilityLength).trim())
    .filter(Boolean)
    .slice(0, maxCapabilityCount);

  return capabilities.length
    ? capabilities
    : ["help", "status", "agent", "actions", "modules", "policy"];
}

function sanitizeForPrompt(value: string) {
  let sanitized = sanitizeErrorMessage(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[<>`]/g, "")
    .trim();

  for (const pattern of secretLikePatterns) {
    sanitized = sanitized.replace(pattern, "[hidden]");
  }

  return sanitized;
}

function assertSafeTelegramAgentBrainText(text: string) {
  for (const pattern of secretLikePatterns) {
    if (pattern.test(text)) {
      throw invalidAgentBrainResponse();
    }
  }

  for (const pattern of unsafeExecutionClaims) {
    if (pattern.test(text)) {
      throw invalidAgentBrainResponse();
    }
  }
}

function invalidAgentBrainResponse(): never {
  throw new HttpError(
    502,
    "agent_brain_invalid_response",
    "Kyra agent brain returned an invalid response.",
  );
}
