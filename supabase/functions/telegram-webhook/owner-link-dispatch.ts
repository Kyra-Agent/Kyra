import {
  parseAndHashTelegramOwnerLinkUpdate,
  type TelegramOwnerLinkConsumeInput,
  TelegramOwnerLinkContractError,
} from "../_shared/telegram-owner-link.ts";
import { HttpError } from "./core.ts";
import type { TelegramOwnerLinkConsumeResult } from "./owner-link-consume.ts";
import {
  parseTelegramWebhookUpdate,
  type TelegramWebhookParsedCommand,
} from "./update-parser.ts";

export interface TelegramOwnerLinkDispatchAcknowledgement {
  route: "owner_link";
  ok: true;
  status: "received";
  message: "Telegram update received.";
}

export interface TelegramReadOnlyDispatchResult {
  route: "read_only";
  parsedUpdate: TelegramWebhookParsedCommand;
}

export type TelegramWebhookDispatchResult =
  | TelegramOwnerLinkDispatchAcknowledgement
  | TelegramReadOnlyDispatchResult;

export interface TelegramWebhookDispatchDependencies {
  parseOwnerLinkUpdate?: (
    update: unknown,
    options: { expectedBotUsername?: string | null },
  ) => Promise<TelegramOwnerLinkConsumeInput>;
  consumeOwnerLinkChallenge?: (input: {
    telegramSessionId: string;
    telegramUpdateId: string;
    telegramUserId: string;
    telegramChatId: string;
    challengeHash: string;
  }) => Promise<TelegramOwnerLinkConsumeResult>;
  parseReadOnlyUpdate?: (
    update: unknown,
    options: { expectedBotUsername?: string | null },
  ) => TelegramWebhookParsedCommand;
}

const ownerLinkCommandCandidatePattern =
  /^\/(?:start|link)(?:@[A-Za-z0-9_]{5,32})?(?:\s|$)/;

export async function dispatchVerifiedTelegramWebhookUpdate(
  input: {
    update: unknown;
    telegramSessionId: string;
    expectedBotUsername?: string | null;
    ownerLinkConsumeEnabled: boolean;
  },
  dependencies: TelegramWebhookDispatchDependencies = {},
): Promise<TelegramWebhookDispatchResult> {
  let ownerLinkCandidate = false;

  try {
    ownerLinkCandidate = isTelegramOwnerLinkCommandCandidate(input.update);
  } catch {
    throw sanitizeTelegramOwnerLinkDispatchError();
  }

  if (!input.ownerLinkConsumeEnabled || !ownerLinkCandidate) {
    const parseReadOnlyUpdate = dependencies.parseReadOnlyUpdate ??
      parseTelegramWebhookUpdate;

    return {
      route: "read_only",
      parsedUpdate: parseReadOnlyUpdate(input.update, {
        expectedBotUsername: input.expectedBotUsername,
      }),
    };
  }

  const parseOwnerLinkUpdate = dependencies.parseOwnerLinkUpdate ??
    parseAndHashTelegramOwnerLinkUpdate;
  const consumeOwnerLinkChallenge = dependencies.consumeOwnerLinkChallenge;

  if (!consumeOwnerLinkChallenge) {
    throw sanitizeTelegramOwnerLinkDispatchError();
  }

  try {
    const ownerLink = await parseOwnerLinkUpdate(input.update, {
      expectedBotUsername: input.expectedBotUsername,
    });
    const result = await consumeOwnerLinkChallenge({
      telegramSessionId: input.telegramSessionId,
      telegramUpdateId: ownerLink.telegramUpdateId,
      telegramUserId: ownerLink.telegramUserId,
      telegramChatId: ownerLink.telegramChatId,
      challengeHash: ownerLink.challengeHash,
    });
    assertTelegramOwnerLinkTerminalResult(result);

    return createTelegramOwnerLinkAcknowledgement();
  } catch (error) {
    if (
      error instanceof TelegramOwnerLinkContractError &&
      error.statusCode === 400
    ) {
      return createTelegramOwnerLinkAcknowledgement();
    }

    throw sanitizeTelegramOwnerLinkDispatchError();
  }
}

export function isTelegramOwnerLinkCommandCandidate(value: unknown) {
  if (!isPlainRecord(value) || !isPlainRecord(value.message)) {
    return false;
  }

  const text = value.message.text;
  return typeof text === "string" &&
    ownerLinkCommandCandidatePattern.test(text);
}

export function assertTelegramOwnerLinkTerminalResult(
  value: unknown,
): TelegramOwnerLinkConsumeResult {
  if (
    !isPlainRecord(value) ||
    Object.keys(value).sort().join(",") !== "linked,status"
  ) {
    throw sanitizeTelegramOwnerLinkDispatchError();
  }

  if (value.linked === true && value.status === "linked") {
    return { linked: true, status: "linked" };
  }

  if (
    value.linked === false &&
    (value.status === "duplicate" || value.status === "not_linked")
  ) {
    return { linked: false, status: value.status };
  }

  throw sanitizeTelegramOwnerLinkDispatchError();
}

export function sanitizeTelegramOwnerLinkDispatchError(_error?: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram owner-link dispatch failed.",
  );
}

function createTelegramOwnerLinkAcknowledgement(): TelegramOwnerLinkDispatchAcknowledgement {
  return {
    route: "owner_link",
    ok: true,
    status: "received",
    message: "Telegram update received.",
  };
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
