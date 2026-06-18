import { HttpError } from "./core.ts";

export type TelegramExecutionGateStatus =
  | "read_only_allowed"
  | "approval_draft_candidate"
  | "blocked";

export type TelegramExecutionDraftKind =
  | "swap_review"
  | "transfer_review"
  | "approval_review"
  | "contract_review"
  | "wallet_review"
  | "unknown_review";

export type TelegramExecutionGateRole =
  | "owner"
  | "admin"
  | "member"
  | "public_read_only";

export interface TelegramExecutionGateInput {
  text: unknown;
  command: unknown;
  authorizationRole: unknown;
  updateId?: unknown;
  messageId?: unknown;
  telegramSessionId?: unknown;
}

export interface TelegramExecutionGateDecision {
  status: TelegramExecutionGateStatus;
  draftKind: TelegramExecutionDraftKind | null;
  canExecuteFromTelegram: false;
  canCreateDraftNow: false;
  requiresOwnerDashboardApproval: boolean;
  replayProtectionRequired: boolean;
  rateLimitRequired: boolean;
  responseText: string;
}

export interface TelegramExecutionDraftReplayScope {
  telegramSessionId: string;
  updateId: string;
  messageId: string;
}

const maxExecutionGateTextLength = 1000;
const directExecutionPattern =
  /\b(execute|submit|broadcast|send\s+now|do\s+it|confirm\s+it|sign\s+now|approve\s+now|swap\s+now|transfer\s+now)\b/i;
const draftCandidatePattern =
  /\b(swap|transfer|send|approve|approval|allowance|permit|revoke|sign|bridge|mint|burn|stake|unstake|claim|withdraw|deposit|buy|sell|delegate|wrap|unwrap|borrow|lend|liquidate|repay|wallet|base\s*mcp|onchain|contract\s+call|calldata|transaction|tx)\b/i;
const swapPattern = /\b(swap|buy|sell|wrap|unwrap)\b/i;
const transferPattern = /\b(transfer|send|withdraw|deposit|bridge)\b/i;
const approvalPattern = /\b(approve|approval|allowance|permit|revoke)\b/i;
const contractPattern =
  /\b(contract\s+call|calldata|mint|burn|stake|unstake|delegate|borrow|lend|liquidate|repay)\b/i;
const walletPattern = /\b(wallet|sign|transaction|tx|onchain|base\s*mcp)\b/i;
const secretLikePattern =
  /(?:\d{5,20}:[A-Za-z0-9_-]{20,128}|sk-or-v1-[A-Za-z0-9_-]+|sb_secret_[A-Za-z0-9_-]+|private\s+key|seed\s+phrase|mnemonic)/i;

export function reviewTelegramExecutionGate(
  input: TelegramExecutionGateInput,
): TelegramExecutionGateDecision {
  const command = readCommand(input.command);
  const role = readAuthorizationRole(input.authorizationRole);
  const text = readGateText(input.text);

  if (command !== "chat") {
    return readOnlyDecision();
  }

  if (!draftCandidatePattern.test(text)) {
    return readOnlyDecision();
  }

  if (secretLikePattern.test(text)) {
    return blockedDecision(
      "Telegram cannot process secrets, wallet keys, or token material.",
      detectDraftKind(text),
    );
  }

  if (role !== "owner" && role !== "admin") {
    return blockedDecision(
      "Only an owner dashboard flow can create approval drafts. Telegram cannot execute wallet or onchain actions.",
      detectDraftKind(text),
    );
  }

  if (directExecutionPattern.test(text)) {
    return blockedDecision(
      "Command rejected: Telegram cannot execute, sign, submit, or approve wallet actions.",
      detectDraftKind(text),
    );
  }

  return {
    status: "approval_draft_candidate",
    draftKind: detectDraftKind(text),
    canExecuteFromTelegram: false,
    canCreateDraftNow: false,
    requiresOwnerDashboardApproval: true,
    replayProtectionRequired: true,
    rateLimitRequired: true,
    responseText: [
      "Telegram execution stays disabled.",
      "This can only become an owner-scoped dashboard approval draft after Phase 6 gates are enabled.",
      "No wallet prompt, signature, Base MCP call, or transaction submission was created.",
    ].join("\n"),
  };
}

export function buildTelegramExecutionDraftReplayKey(
  scope: TelegramExecutionDraftReplayScope,
) {
  const telegramSessionId = readReplayPart(scope.telegramSessionId);
  const updateId = readReplayPart(scope.updateId);
  const messageId = readReplayPart(scope.messageId);

  return `telegram-draft:${telegramSessionId}:${updateId}:${messageId}`;
}

function readOnlyDecision(): TelegramExecutionGateDecision {
  return {
    status: "read_only_allowed",
    draftKind: null,
    canExecuteFromTelegram: false,
    canCreateDraftNow: false,
    requiresOwnerDashboardApproval: false,
    replayProtectionRequired: false,
    rateLimitRequired: false,
    responseText: "Telegram read-only request allowed.",
  };
}

function blockedDecision(
  responseText: string,
  draftKind: TelegramExecutionDraftKind | null,
): TelegramExecutionGateDecision {
  return {
    status: "blocked",
    draftKind,
    canExecuteFromTelegram: false,
    canCreateDraftNow: false,
    requiresOwnerDashboardApproval: true,
    replayProtectionRequired: true,
    rateLimitRequired: true,
    responseText,
  };
}

function detectDraftKind(text: string): TelegramExecutionDraftKind {
  if (approvalPattern.test(text)) {
    return "approval_review";
  }

  if (swapPattern.test(text)) {
    return "swap_review";
  }

  if (transferPattern.test(text)) {
    return "transfer_review";
  }

  if (contractPattern.test(text)) {
    return "contract_review";
  }

  if (walletPattern.test(text)) {
    return "wallet_review";
  }

  return "unknown_review";
}

function readCommand(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw invalidGateInput();
  }

  return value.trim();
}

function readAuthorizationRole(value: unknown): TelegramExecutionGateRole {
  if (
    value === "owner" || value === "admin" || value === "member" ||
    value === "public_read_only"
  ) {
    return value;
  }

  throw invalidGateInput();
}

function readGateText(value: unknown) {
  if (typeof value !== "string") {
    return "";
  }

  const text = value.trim();

  if (text.length > maxExecutionGateTextLength) {
    throw invalidGateInput();
  }

  return text;
}

function readReplayPart(value: unknown) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,96}$/u.test(value)) {
    throw invalidGateInput();
  }

  return value;
}

function invalidGateInput() {
  return new HttpError(
    400,
    "invalid_update",
    "Telegram update is invalid.",
  );
}
