import { HttpError, sanitizeErrorMessage } from "./core.ts";
import type { TelegramWebhookParsedCommandName } from "./update-parser.ts";

export interface TelegramAgentBrainPromptInput {
  command: unknown;
  agentName?: unknown;
  agentRole?: unknown;
  agentSummary?: unknown;
  capabilities?: unknown;
  gatedActions?: unknown;
  modules?: unknown;
  safetyNote?: unknown;
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

interface TelegramAgentBrainPromptModule {
  name: string;
  title: string;
  status: string;
}

interface NormalizedTelegramAgentBrainPromptInput {
  command: TelegramWebhookParsedCommandName;
  agentName: string;
  agentRole: string;
  agentSummary: string;
  capabilities: readonly string[];
  gatedActions: readonly string[];
  modules: readonly TelegramAgentBrainPromptModule[];
  safetyNote: string;
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
const maxAgentSummaryLength = 180;
const maxCapabilityCount = 6;
const maxCapabilityLength = 32;
const maxGatedActionCount = 8;
const maxGatedActionLength = 32;
const maxModuleCount = 8;
const maxModuleNameLength = 32;
const maxModuleTitleLength = 48;
const maxModuleStatusLength = 16;
const maxSafetyNoteLength = 180;
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
const rawMarkdownPatterns = [
  /\*\*/,
  /^#{1,6}\s/m,
  /^```/m,
  /^---+$/m,
  /^\s*\|.+\|\s*$/m,
  /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/m,
];
const incompleteTrailingLinePattern = /(?:^|\n)\s*[A-Z]{1,3}\s*$/;
const orphanTrailingHeadingPattern =
  /(?:^|\n)\s*(active|standby|guard|gated actions|read-only boundary|current access)\s*$/i;

export function buildTelegramAgentBrainRequest(
  input: TelegramAgentBrainPromptInput,
): TelegramAgentBrainRequest {
  const context = normalizeTelegramAgentBrainPromptInput(input);

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
          "Use plain text only: no Markdown tables, bold markers, code fences, headings, or horizontal rules.",
          "Use short label lines and hyphen bullets when listing capabilities.",
          "Answer the requested command directly and do not add unfinished helper text.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Command: /${context.command}`,
          `Agent: ${context.agentName}`,
          `Role: ${context.agentRole}`,
          `Summary: ${context.agentSummary}`,
          `Read-only actions: ${context.capabilities.join(", ")}`,
          `Gated actions: ${context.gatedActions.join(", ")}`,
          `Modules: ${formatPromptModules(context.modules)}`,
          `Safety: ${context.safetyNote}`,
          `Response guide: ${buildCommandResponseGuide(context.command)}`,
        ].join("\n"),
      },
    ],
  };
}

export async function generateTelegramAgentBrainReply(
  input: TelegramAgentBrainPromptInput,
  provider: TelegramAgentBrainProvider,
): Promise<TelegramAgentBrainReply> {
  const context = normalizeTelegramAgentBrainPromptInput(input);
  const request = buildTelegramAgentBrainRequest(input);

  try {
    const response = await provider.complete(request);
    const reply = assertTelegramAgentBrainReply(response);
    assertContextualTelegramAgentBrainReply(reply.text, context);
    return reply;
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
  return sanitizePromptList(
    value,
    maxCapabilityCount,
    maxCapabilityLength,
    ["help", "status", "agent", "actions", "modules", "policy"],
  );
}

function sanitizePromptList(
  value: unknown,
  maxCount: number,
  maxLength: number,
  fallback: readonly string[],
) {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const items = value
    .filter((item): item is string => typeof item === "string")
    .map((item) => sanitizeForPrompt(item).slice(0, maxLength).trim())
    .filter(Boolean)
    .slice(0, maxCount);

  return items.length ? [...new Set(items)] : [...fallback];
}

function sanitizePromptModules(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> =>
      !!item && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) => {
      const name = sanitizePromptFragment(
        item.name,
        maxModuleNameLength,
        "",
      );
      const title = sanitizePromptFragment(
        item.title,
        maxModuleTitleLength,
        "Module",
      );
      const status = sanitizePromptFragment(
        item.telegramStatus ?? item.status,
        maxModuleStatusLength,
        "standby",
      ).toLowerCase();

      return name ? { name, title, status } : null;
    })
    .filter((item): item is TelegramAgentBrainPromptModule => item !== null)
    .slice(0, maxModuleCount);
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

function normalizeTelegramAgentBrainPromptInput(
  input: TelegramAgentBrainPromptInput,
): NormalizedTelegramAgentBrainPromptInput {
  return {
    command: assertTelegramAgentBrainCommand(input.command),
    agentName: sanitizePromptFragment(
      input.agentName,
      maxAgentNameLength,
      "Kyra Agent",
    ),
    agentRole: sanitizePromptFragment(
      input.agentRole,
      maxAgentRoleLength,
      "Telegram read-only agent",
    ),
    agentSummary: sanitizePromptFragment(
      input.agentSummary,
      maxAgentSummaryLength,
      "Kyra agent profile.",
    ),
    capabilities: sanitizeCapabilities(input.capabilities),
    gatedActions: sanitizePromptList(
      input.gatedActions,
      maxGatedActionCount,
      maxGatedActionLength,
      ["wallet", "approval", "Base MCP", "onchain execution"],
    ),
    modules: sanitizePromptModules(input.modules),
    safetyNote: sanitizePromptFragment(
      input.safetyNote,
      maxSafetyNoteLength,
      "Telegram is read-only.",
    ),
  };
}

function formatPromptModules(
  modules: readonly TelegramAgentBrainPromptModule[],
) {
  if (!modules.length) {
    return "none";
  }

  return modules
    .map((module) => `${module.name} (${module.title}, ${module.status})`)
    .join("; ");
}

function buildCommandResponseGuide(command: TelegramWebhookParsedCommandName) {
  if (command === "modules") {
    return "Use labels Template module stack, Active, Guard, Standby, Boundary. Report only actual template modules with exact names and statuses. Do not label wallet, approval, Base MCP, or onchain execution as modules.";
  }

  if (command === "actions") {
    return "Use labels Ready in Telegram, Dashboard gated, Phase 6 gated, Boundary. Separate read-only actions from gated actions. Explain Telegram can brief or plan, not execute wallet or onchain actions. Do not include module status sections.";
  }

  if (command === "agent") {
    return "Use labels Role, Focus, Telegram access, Template stack, Next. Describe the deployed template profile and keep the read-only boundary explicit.";
  }

  return "Answer the command directly with the current read-only safety boundary.";
}

function assertContextualTelegramAgentBrainReply(
  text: string,
  context: NormalizedTelegramAgentBrainPromptInput,
) {
  if (
    context.command === "modules" &&
    context.modules.length &&
    !context.modules.some((module) => includesTextFolded(text, module.name))
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "modules" &&
    /\bgated modules\b/i.test(text)
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "modules" &&
    !hasTelegramSectionLabel(text, "Active")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "modules" &&
    context.modules.some((module) => module.status === "standby") &&
    !hasTelegramSectionLabel(text, "Standby")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "actions" &&
    context.capabilities.length &&
    !context.capabilities.some((capability) =>
      includesTextFolded(text, capability)
    )
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "actions" &&
    /\b(?:active|standby|guard)\s+modules?\s*:/i.test(text)
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "agent" &&
    context.agentName !== "Kyra Agent" &&
    !includesTextFolded(text, context.agentName)
  ) {
    throw invalidAgentBrainResponse();
  }
}

function includesTextFolded(text: string, fragment: string) {
  return text.toLowerCase().includes(fragment.toLowerCase());
}

function hasTelegramSectionLabel(text: string, label: string) {
  return new RegExp(`(?:^|\\n)\\s*${label}\\s*:`, "i").test(text);
}

function assertSafeTelegramAgentBrainText(text: string) {
  if (
    incompleteTrailingLinePattern.test(text) ||
    orphanTrailingHeadingPattern.test(text)
  ) {
    throw invalidAgentBrainResponse();
  }

  for (const pattern of rawMarkdownPatterns) {
    if (pattern.test(text)) {
      throw invalidAgentBrainResponse();
    }
  }

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
