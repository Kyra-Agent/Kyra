import { HttpError, sanitizeErrorMessage } from "./core.ts";
import type { TelegramReadOnlyChatIntent } from "./read-only-response.ts";
import type { TelegramWebhookParsedCommandName } from "./update-parser.ts";

export interface TelegramAgentBrainPromptInput {
  command: unknown;
  templateId?: unknown;
  agentName?: unknown;
  agentRole?: unknown;
  agentSummary?: unknown;
  capabilities?: unknown;
  gatedActions?: unknown;
  modules?: unknown;
  safetyNote?: unknown;
  userRequest?: unknown;
  chatIntent?: unknown;
  languageCode?: unknown;
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
  templateId: string;
  agentName: string;
  agentRole: string;
  agentSummary: string;
  capabilities: readonly string[];
  gatedActions: readonly string[];
  modules: readonly TelegramAgentBrainPromptModule[];
  safetyNote: string;
  userRequest: string;
  chatIntent: TelegramReadOnlyChatIntent;
  languageCode: string;
}

const supportedReadOnlyCommands = new Set<TelegramWebhookParsedCommandName>([
  "help",
  "status",
  "agent",
  "actions",
  "modules",
  "policy",
  "chat",
]);
const maxAgentNameLength = 48;
const maxTemplateIdLength = 48;
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
const maxUserRequestLength = 1000;
const maxLanguageCodeLength = 35;
const maxAgentBrainOutputCharacters = 3000;
const maxGenericContentReplyCharacters = 320;
const maxAgentBrainAttempts = 2;
const templateDisplayNames = new Map<string, string>([
  ["operator", "Operator"],
  ["scout", "Scout"],
  ["steward", "Steward"],
  ["executor", "Executor"],
  ["strategist", "Strategist"],
  ["custom", "Custom"],
]);
const retryableAgentBrainErrorCodes = new Set([
  "agent_brain_output_rejected",
  "agent_brain_provider_invalid_response",
  "agent_brain_incomplete_response",
  "agent_brain_network_error",
  "agent_brain_timeout",
  "agent_brain_upstream_error",
  "agent_brain_upstream_timeout",
]);
const supportedChatIntents = new Set<TelegramReadOnlyChatIntent>([
  "market_brief",
  "campaign_plan",
  "narrative_map",
  "launch_copy",
  "community_pulse",
  "risk_review",
  "module_status",
  "agent_profile",
  "policy",
  "help",
  "unsafe_execution",
  "general",
]);
const contentProducingChatIntents = new Set<TelegramReadOnlyChatIntent>([
  "market_brief",
  "campaign_plan",
  "narrative_map",
  "launch_copy",
  "community_pulse",
  "risk_review",
  "module_status",
  "agent_profile",
]);
const genericContentReplyPatterns = [
  /\b(?:Kyra\s+)?read-only chat is online\b/i,
  /\bAsk for (?:available )?planning support\b/i,
  /\b(?:chat|session)\s*:\s*active\b/i,
];
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
];
const secretMaterialPatterns = [
  /\b(?:0x)?[A-Fa-f0-9]{64}\b/,
  /\bprivate\s+key\s*[:=]\s*(?!not\b|never\b|none\b|disabled\b|unavailable\b|hidden\b)[^\s]+/i,
  /\bseed\s+phrase\s*[:=]\s*(?!not\b|never\b|none\b|disabled\b|unavailable\b|hidden\b).+/i,
];
const incompleteTrailingLinePattern =
  /(?:^|\n)\s*(?:[-*]|\d+[.)]|[A-Z]{1,3})\s*$/;
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
          "Do not claim that wallet, approval, Robinhood Chain, or onchain actions were executed.",
          "Do not include secrets, internal IDs, token refs, webhook refs, or raw database details.",
          "Keep the reply concise and safe for Telegram.",
          "Use plain text only: no Markdown tables, bold markers, code fences, headings, or horizontal rules.",
          "Use short label lines and hyphen bullets when listing capabilities.",
          "Keep the complete reply under 2600 characters.",
          "Finish every sentence and bullet. Never end with an empty bullet or an unfinished label.",
          "Answer the requested command directly and do not add unfinished helper text.",
          "When the user asks for a concrete plan, review, brief, or draft, produce that content directly instead of returning a capability menu or generic status reply.",
          "Do not claim live, real-time, current, latest, price, or market data unless the user provides that data in the request.",
          "Support multilingual users. For natural chat, reply in the same language and writing system as the user's request. For slash commands without a natural-language request, use the Telegram language hint when you can write it fluently; otherwise use English.",
          "Infer the user's semantic intent from their request in any language. The supplied intent is only a heuristic hint.",
          "Treat the deployed template context in the user message as the sole source of agent identity, role, capabilities, actions, and modules.",
          "Never identify as another Kyra template or import another template's role, capabilities, actions, modules, or strategy.",
          "Regardless of language, refuse requests to sign, approve, submit, or execute wallet and onchain actions. Offer only read-only planning, review, or checklist help.",
        ].join(" "),
      },
      {
        role: "user",
        content: [
          `Command: /${context.command}`,
          `Template: ${formatPromptTemplate(context.templateId)}`,
          `Agent: ${context.agentName}`,
          `Role: ${context.agentRole}`,
          `Summary: ${context.agentSummary}`,
          `Read-only actions: ${formatPromptList(context.capabilities)}`,
          `Gated actions: ${formatPromptList(context.gatedActions)}`,
          `Modules: ${formatPromptModules(context.modules)}`,
          `Safety: ${context.safetyNote}`,
          `User request: ${context.userRequest}`,
          `Intent: ${context.chatIntent}`,
          `Telegram language hint: ${context.languageCode}`,
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
  let request = buildTelegramAgentBrainRequest(input);
  let lastError: HttpError | undefined;

  for (let attempt = 0; attempt < maxAgentBrainAttempts; attempt += 1) {
    try {
      const response = await provider.complete(request);
      const reply = assertTelegramAgentBrainReply(response);
      assertContextualTelegramAgentBrainReply(reply.text, context);
      return reply;
    } catch (error) {
      const normalizedError = error instanceof HttpError
        ? error
        : sanitizeTelegramAgentBrainProviderError(error);
      lastError = normalizedError;

      if (
        attempt + 1 >= maxAgentBrainAttempts ||
        !retryableAgentBrainErrorCodes.has(normalizedError.code)
      ) {
        throw normalizedError;
      }

      request = buildTelegramAgentBrainRepairRequest(request, context);
    }
  }

  throw lastError ?? sanitizeTelegramAgentBrainProviderError(undefined);
}

function buildTelegramAgentBrainRepairRequest(
  request: TelegramAgentBrainRequest,
  context: NormalizedTelegramAgentBrainPromptInput,
): TelegramAgentBrainRequest {
  return {
    ...request,
    messages: [
      ...request.messages,
      {
        role: "user",
        content: [
          "Regenerate the answer from scratch because the previous attempt was incomplete, malformed, or did not satisfy the response contract.",
          "Do not mention retries, fallback, providers, validation, or the previous attempt.",
          "Answer the original request directly; do not return a generic capability menu when concrete content was requested.",
          "Use the same language and writing system as the original user request. Language hint: " +
          context.languageCode + ".",
          "Keep the exact deployed identity: agent " + context.agentName +
          ", template " + formatPromptTemplate(context.templateId) + ".",
          "Stay faithful to the deployed role: " + context.agentRole + ".",
          "Stay inside these read-only actions: " +
          formatPromptList(context.capabilities) + ".",
          "Do not identify as or borrow behavior from any other Kyra template.",
          "Use complete plain-text labels and bullets without tables or code fences.",
          "Never expose secrets or internal IDs, and never claim that a wallet or onchain action was executed.",
        ].join(" "),
      },
    ],
  };
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

  const text = normalizeTelegramAgentBrainText(response.text);

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

  return [...new Set(items)];
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
    templateId: sanitizeTemplateId(input.templateId),
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
      ["wallet", "approval", "Robinhood Chain actions", "onchain execution"],
    ),
    modules: sanitizePromptModules(input.modules),
    safetyNote: sanitizePromptFragment(
      input.safetyNote,
      maxSafetyNoteLength,
      "Telegram is read-only.",
    ),
    userRequest: sanitizePromptFragment(
      input.userRequest,
      maxUserRequestLength,
      "",
    ),
    chatIntent: sanitizeChatIntent(input.chatIntent),
    languageCode: sanitizeLanguageCode(input.languageCode),
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

function formatPromptList(values: readonly string[]) {
  return values.length ? values.join(", ") : "none";
}

function formatPromptTemplate(templateId: string) {
  return templateDisplayNames.get(templateId) ?? "unspecified";
}

function buildCommandResponseGuide(command: TelegramWebhookParsedCommandName) {
  if (command === "chat") {
    return [
      "Answer the user's read-only request directly in the same language and writing system.",
      "If the intent is unsafe_execution, only refuse clearly and offer a read-only risk review or checklist; do not add a market brief, campaign plan, sample analysis, or extra generated content.",
      "For market_brief, campaign_plan, narrative_map, launch_copy, community_pulse, or risk_review, produce useful content immediately with concise labels and bullets.",
      "Use available agent, action, and module context, but frame outputs as planning guidance unless the user supplies data.",
      "Keep wallet, approval, Robinhood Chain actions, and onchain execution disabled.",
    ].join(" ");
  }

  if (command === "modules") {
    return "Report the Template module stack using concise localized labels for active, guard, standby, and boundary. Preserve actual module names and statuses exactly. Do not label wallet, approval, Robinhood Chain actions, or onchain execution as modules.";
  }

  if (command === "actions") {
    return "Use concise localized labels for Telegram-ready actions, dashboard-gated actions, owner approval, and the safety boundary. Separate read-only actions from gated actions. Explain Telegram can brief or plan, not execute wallet or onchain actions. Do not include module status sections.";
  }

  if (command === "agent") {
    return "Use concise localized labels for role, focus, Telegram access, template stack, and next actions. Describe the deployed template profile and keep the read-only boundary explicit.";
  }

  return "Answer the command directly with the current read-only safety boundary.";
}

function assertContextualTelegramAgentBrainReply(
  text: string,
  context: NormalizedTelegramAgentBrainPromptInput,
) {
  if (hasForeignTemplateIdentityClaim(text, context)) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "chat" &&
    context.chatIntent === "agent_profile" &&
    context.templateId &&
    !includesTextFolded(text, formatPromptTemplate(context.templateId))
  ) {
    throw invalidAgentBrainResponse();
  }

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
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Active")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "modules" &&
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Guard")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "modules" &&
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Standby")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "modules" &&
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Boundary")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "actions" &&
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Ready in Telegram")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "actions" &&
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Dashboard gated")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "actions" &&
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Owner approval required")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "actions" &&
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Boundary")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "actions" &&
    hasExpectedActions(context) &&
    !context.capabilities.some((capability) =>
      includesTextFolded(text, capability)
    ) &&
    !context.gatedActions.some((action) => includesTextFolded(text, action))
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
    context.command === "actions" &&
    context.gatedActions.length === 0 &&
    /^\s*-\s*(wallet|approval|robinhood\s+chain\s+actions?|onchain\s+execution)\b/im
      .test(text)
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

  if (
    context.command === "agent" &&
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Role")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "agent" &&
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Focus")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "agent" &&
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Telegram access")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "agent" &&
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Template stack")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "agent" &&
    usesStrictEnglishCommandLabels(context) &&
    !hasTelegramSectionLabel(text, "Next")
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "chat" &&
    contentProducingChatIntents.has(context.chatIntent) &&
    isGenericContentReply(text)
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "chat" &&
    usesStrictSemanticChatValidation(context) &&
    context.chatIntent === "unsafe_execution" &&
    !/\b(cannot|can't|disabled|not execute|read-only|tidak dapat|tidak bisa|dinonaktifkan|tidak mengeksekusi|hanya baca)\b/i
      .test(text)
  ) {
    throw invalidAgentBrainResponse();
  }

  if (
    context.command === "chat" &&
    context.chatIntent === "unsafe_execution" &&
    hasUnsafeExecutionOveranswer(text)
  ) {
    throw invalidAgentBrainResponse();
  }
}

function sanitizeLanguageCode(value: unknown) {
  if (typeof value !== "string") {
    return "auto";
  }

  const languageCode = value.trim().slice(0, maxLanguageCodeLength);

  if (!/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8}){0,2}$/.test(languageCode)) {
    return "auto";
  }

  return languageCode;
}

function sanitizeTemplateId(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const templateId = value.trim().toLowerCase().slice(0, maxTemplateIdLength);
  return templateDisplayNames.has(templateId) ? templateId : "";
}

function usesStrictEnglishCommandLabels(
  context: NormalizedTelegramAgentBrainPromptInput,
) {
  return context.languageCode === "auto" ||
    /^en(?:-|$)/i.test(context.languageCode);
}

function usesStrictSemanticChatValidation(
  context: NormalizedTelegramAgentBrainPromptInput,
) {
  return context.languageCode === "auto" ||
    /^(?:en|id)(?:-|$)/i.test(context.languageCode);
}

function sanitizeChatIntent(value: unknown): TelegramReadOnlyChatIntent {
  if (
    typeof value === "string" &&
    supportedChatIntents.has(value as TelegramReadOnlyChatIntent)
  ) {
    return value as TelegramReadOnlyChatIntent;
  }

  return "general";
}

function includesTextFolded(text: string, fragment: string) {
  return text.toLowerCase().includes(fragment.toLowerCase());
}

function hasForeignTemplateIdentityClaim(
  text: string,
  context: NormalizedTelegramAgentBrainPromptInput,
) {
  if (!context.templateId) {
    return false;
  }

  for (const [templateId, displayName] of templateDisplayNames) {
    if (templateId === context.templateId) {
      continue;
    }

    const escapedName = escapeRegExp(displayName);
    const identityPatterns = [
      new RegExp(
        `(?:^|\\n)\\s*(?:template|templat|agent template|deployed template|type)\\s*:\\s*${escapedName}\\b`,
        "i",
      ),
      new RegExp(
        `(?:^|\\n)\\s*(?:i am|i'm|saya adalah|aku adalah)\\s+(?:an?\\s+)?${escapedName}\\b`,
        "i",
      ),
    ];

    if (identityPatterns.some((pattern) => pattern.test(text))) {
      return true;
    }
  }

  return false;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasExpectedActions(context: NormalizedTelegramAgentBrainPromptInput) {
  return context.capabilities.length > 0 || context.gatedActions.length > 0;
}

function hasTelegramSectionLabel(text: string, label: string) {
  return new RegExp(`(?:^|\\n)\\s*${label}\\s*:`, "i").test(text);
}

function hasUnsafeExecutionOveranswer(text: string) {
  return (
    text.split("\n").filter((line) => line.trim()).length > 4 ||
    /\b(market brief|campaign plan|sample|for context|current context|trend lens|phase\s+\d|objective:|strategy:)\b/i
      .test(text)
  );
}

function isGenericContentReply(text: string) {
  const patternMatches = genericContentReplyPatterns.reduce(
    (count, pattern) => count + Number(pattern.test(text)),
    0,
  );

  return patternMatches >= 2 ||
    (patternMatches === 1 && text.length <= maxGenericContentReplyCharacters);
}

function normalizeTelegramAgentBrainText(text: string) {
  return text
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((line) =>
      line
        .replace(/^\s{0,3}#{1,6}\s+/, "")
        .replace(/^\s*[\u2022*]\s+/, "- ")
        .replace(/\*\*(.+?)\*\*/g, "$1")
        .replace(/__(.+?)__/g, "$1")
        .trimEnd()
    )
    .filter((line) => {
      const trimmed = line.trim();
      return !/^```/.test(trimmed) &&
        !/^(?:-{3,}|\*{3,}|_{3,})$/.test(trimmed) &&
        !isMarkdownTableSeparator(trimmed);
    })
    .map((line) => {
      const trimmed = line.trim();

      if (/^\|.+\|$/.test(trimmed)) {
        return trimmed
          .slice(1, -1)
          .split("|")
          .map((cell) => cell.trim())
          .filter(Boolean)
          .join(" - ");
      }

      return line;
    })
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isMarkdownTableSeparator(line: string) {
  const normalized = line.replace(/^\||\|$/g, "").trim();

  if (!normalized.includes("|")) {
    return false;
  }

  const cells = normalized
    .split("|")
    .map((cell) => cell.trim())
    .filter(Boolean);

  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell));
}

function assertSafeTelegramAgentBrainText(text: string) {
  if (
    incompleteTrailingLinePattern.test(text) ||
    orphanTrailingHeadingPattern.test(text)
  ) {
    throw invalidAgentBrainResponse();
  }

  for (const pattern of secretLikePatterns) {
    if (pattern.test(text)) {
      throw invalidAgentBrainResponse();
    }
  }

  for (const pattern of secretMaterialPatterns) {
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
    "agent_brain_output_rejected",
    "Kyra agent brain output did not pass its safety contract.",
  );
}
