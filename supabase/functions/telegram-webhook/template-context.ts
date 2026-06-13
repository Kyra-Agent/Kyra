import { HttpError, sanitizeErrorMessage } from "./core.ts";

export type TelegramTemplateActionAvailability =
  | "read_only_ready"
  | "dashboard_gated"
  | "phase6_wallet_gated";

export interface TelegramTemplateContextSource {
  templateId?: unknown;
  name?: unknown;
  role?: unknown;
  summary?: unknown;
  actions?: unknown;
  modules?: unknown;
}

export interface TelegramTemplateActionContext {
  name: string;
  availability: TelegramTemplateActionAvailability;
}

export interface TelegramTemplateModuleContext {
  name: string;
  title: string;
  telegramStatus: "active" | "guard" | "standby";
}

export interface TelegramTemplateContext {
  templateId: string;
  name: string;
  role: string;
  summary: string;
  actions: readonly TelegramTemplateActionContext[];
  modules: readonly TelegramTemplateModuleContext[];
  readOnlyActions: readonly string[];
  gatedActions: readonly string[];
  safetyNote: string;
}

export type TelegramTemplateContextReplyCommand =
  | "agent"
  | "actions"
  | "modules";

const maxTemplateIdLength = 48;
const maxTemplateNameLength = 48;
const maxTemplateRoleLength = 72;
const maxTemplateSummaryLength = 220;
const maxTemplateActionCount = 8;
const maxTemplateActionLength = 40;
const maxTemplateModuleCount = 8;
const maxTemplateModuleLength = 32;
const maxTemplateContextReplyCharacters = 700;

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

const walletOrExecutionActions = new Set([
  "approve",
  "balance",
  "conditional swap",
  "dca",
  "holder verify",
  "lend",
  "lp manage",
  "portfolio",
  "send",
  "stop loss",
  "swap",
  "tx history",
]);

const dashboardGatedActions = new Set([
  "announcement",
  "choose actions",
  "choose modules",
  "custom prompt",
  "price alert",
  "safety limits",
]);

const moduleCatalog = new Map<string, TelegramTemplateModuleContext>([
  [
    "NIRA-01",
    { name: "NIRA-01", title: "Lead Agent", telegramStatus: "active" },
  ],
  [
    "VEXA-02",
    { name: "VEXA-02", title: "Recon Agent", telegramStatus: "active" },
  ],
  [
    "ASTRA-03",
    { name: "ASTRA-03", title: "Research Agent", telegramStatus: "active" },
  ],
  [
    "NOVA-04",
    { name: "NOVA-04", title: "Data Agent", telegramStatus: "standby" },
  ],
  [
    "NYX-05",
    { name: "NYX-05", title: "Security Agent", telegramStatus: "guard" },
  ],
]);

export function buildTelegramTemplateContext(
  source: TelegramTemplateContextSource,
): TelegramTemplateContext {
  const templateId = sanitizeTemplateId(source.templateId);
  const name = sanitizeTemplateText(
    source.name,
    maxTemplateNameLength,
    "Kyra Agent",
  );
  const role = sanitizeTemplateText(
    source.role,
    maxTemplateRoleLength,
    "Read-only Telegram agent",
  );
  const summary = sanitizeTemplateText(
    source.summary,
    maxTemplateSummaryLength,
    "Kyra agent profile.",
  );
  const actions = sanitizeActionList(source.actions).map((action) => ({
    name: action,
    availability: classifyTemplateAction(action),
  }));
  const modules = sanitizeModuleList(source.modules);
  const readOnlyActions = actions
    .filter((action) => action.availability === "read_only_ready")
    .map((action) => action.name);
  const gatedActions = actions
    .filter((action) => action.availability !== "read_only_ready")
    .map((action) => action.name);

  return {
    templateId,
    name,
    role,
    summary,
    actions,
    modules,
    readOnlyActions,
    gatedActions,
    safetyNote:
      "Telegram is read-only. Wallet, approval, Base MCP, and onchain execution stay gated for Phase 6.",
  };
}

export function buildTelegramTemplateContextReply(
  source: TelegramTemplateContextSource,
  command: TelegramTemplateContextReplyCommand = "agent",
) {
  const context = buildTelegramTemplateContext(source);
  const lines = buildTelegramTemplateContextReplyLines(context, command);
  const text = lines.join("\n").slice(0, maxTemplateContextReplyCharacters)
    .trim();

  assertSafeTelegramTemplateContextText(text);

  return {
    context,
    text,
  };
}

function buildTelegramTemplateContextReplyLines(
  context: TelegramTemplateContext,
  command: TelegramTemplateContextReplyCommand,
) {
  const activeModules = context.modules
    .filter((module) => module.telegramStatus === "active")
    .map((module) => module.name);
  const guardModules = context.modules
    .filter((module) => module.telegramStatus === "guard")
    .map((module) => module.name);
  const standbyModules = context.modules
    .filter((module) => module.telegramStatus === "standby")
    .map((module) => module.name);

  if (command === "actions") {
    return [
      `${context.name} actions`,
      `Read-only: ${formatTelegramContextList(context.readOnlyActions)}`,
      `Gated: ${formatTelegramContextList(context.gatedActions)}`,
      "Write, wallet, approval, and onchain actions stay disabled from Telegram.",
    ];
  }

  if (command === "modules") {
    return [
      `${context.name} modules`,
      `Active: ${formatTelegramContextList(activeModules)}`,
      `Guard: ${formatTelegramContextList(guardModules)}`,
      `Standby: ${formatTelegramContextList(standbyModules)}`,
      "Module execution stays gated. Telegram can only describe module readiness.",
    ];
  }

  return [
    `${context.name}: ${context.role}`,
    context.summary,
    `Telegram access: read-only`,
    `Active modules: ${formatTelegramContextList(activeModules)}`,
    "Use /actions or /modules for focused details.",
    context.safetyNote,
  ];
}

export function classifyTemplateAction(
  action: unknown,
): TelegramTemplateActionAvailability {
  const name = sanitizeTemplateText(
    action,
    maxTemplateActionLength,
    "",
  ).toLowerCase();

  if (!name) {
    throw invalidTemplateContext();
  }

  if (walletOrExecutionActions.has(name)) {
    return "phase6_wallet_gated";
  }

  if (dashboardGatedActions.has(name)) {
    return "dashboard_gated";
  }

  return "read_only_ready";
}

function sanitizeTemplateId(value: unknown) {
  if (typeof value !== "string") {
    throw invalidTemplateContext();
  }

  const normalized = sanitizeTemplateText(value, maxTemplateIdLength, "")
    .toLowerCase();

  if (!/^[a-z0-9_-]{2,48}$/.test(normalized)) {
    throw invalidTemplateContext();
  }

  return normalized;
}

function sanitizeActionList(value: unknown) {
  if (!Array.isArray(value)) {
    throw invalidTemplateContext();
  }

  const actions = value
    .filter((action): action is string => typeof action === "string")
    .map((action) =>
      sanitizeTemplateText(action, maxTemplateActionLength, "").toLowerCase()
    )
    .filter(Boolean)
    .slice(0, maxTemplateActionCount);

  if (!actions.length) {
    throw invalidTemplateContext();
  }

  return [...new Set(actions)];
}

function sanitizeModuleList(value: unknown) {
  if (!Array.isArray(value)) {
    throw invalidTemplateContext();
  }

  const modules = value
    .filter((module): module is string => typeof module === "string")
    .map((module) => sanitizeTemplateText(module, maxTemplateModuleLength, ""))
    .filter(Boolean)
    .slice(0, maxTemplateModuleCount)
    .map((module) => moduleCatalog.get(module) ?? {
      name: module,
      title: "Custom Module",
      telegramStatus: "standby" as const,
    });

  if (!modules.length) {
    throw invalidTemplateContext();
  }

  return modules;
}

function sanitizeTemplateText(
  value: unknown,
  maxLength: number,
  fallback: string,
) {
  if (typeof value !== "string") {
    return fallback;
  }

  let sanitized = sanitizeErrorMessage(value)
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[<>`*_#[\]]/g, "")
    .trim();

  for (const pattern of secretLikePatterns) {
    sanitized = sanitized.replace(pattern, "[hidden]");
  }

  return sanitized.slice(0, maxLength).trim() || fallback;
}

function formatTelegramContextList(values: readonly string[]) {
  return values.length ? values.join(", ") : "none";
}

function assertSafeTelegramTemplateContextText(text: string) {
  if (!text || text.length > maxTemplateContextReplyCharacters) {
    throw invalidTemplateContext();
  }

  for (const pattern of secretLikePatterns) {
    if (pattern.test(text)) {
      throw invalidTemplateContext();
    }
  }

  if (/transaction\s+(sent|executed|submitted|confirmed)/i.test(text)) {
    throw invalidTemplateContext();
  }
}

function invalidTemplateContext(): never {
  throw new HttpError(
    400,
    "invalid_template_context",
    "Telegram template context is invalid.",
  );
}
