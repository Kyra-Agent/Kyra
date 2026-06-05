export class TelegramOwnerLinkContractError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface TelegramOwnerLinkChallengeMaterial {
  challenge: string;
  challengeHash: string;
  expiresAt: string;
}

export interface TelegramOwnerLinkChallengeStoreInput {
  agentId: string;
  telegramSessionId: string;
  issuedByUserId: string;
  challengeHash: string;
  expiresAt: string;
}

export interface TelegramOwnerLinkConsumeInput {
  telegramUpdateId: string;
  telegramUserId: string;
  telegramChatId: string;
  challengeHash: string;
}

export interface CreateTelegramOwnerLinkChallengeMaterialOptions {
  getRandomValues?: (bytes: Uint8Array) => Uint8Array;
  nowMs?: number;
}

export interface ParseTelegramOwnerLinkUpdateOptions {
  expectedBotUsername?: string | null;
  hashChallenge?: (challenge: unknown) => Promise<string>;
}

export const telegramOwnerLinkChallengeBytes = 32;
export const telegramOwnerLinkChallengeTtlMs = 10 * 60 * 1000;

const challengePattern = /^[0-9a-f]{64}$/;
const challengeHashPattern = /^[0-9a-f]{64}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const telegramBotUsernamePattern = /^[A-Za-z0-9_]{5,32}$/;
const telegramOwnerLinkCommandPattern =
  /^\/(?:start|link)(?:@([A-Za-z0-9_]{5,32}))? ([0-9a-f]{64})$/;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function throwInvalidOwnerLinkRequest(): never {
  throw new TelegramOwnerLinkContractError(
    400,
    "invalid_owner_link",
    "Telegram owner-link request is invalid.",
  );
}

function assertUuid(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throwInvalidOwnerLinkRequest();
  }

  return value;
}

function assertNowMs(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw sanitizeTelegramOwnerLinkContractError(value);
  }

  return value;
}

function assertChallengeExpiry(value: unknown, nowMs: number) {
  if (typeof value !== "string") {
    throwInvalidOwnerLinkRequest();
  }

  const expiresAtMs = Date.parse(value);

  if (
    !Number.isFinite(expiresAtMs) ||
    expiresAtMs <= nowMs ||
    expiresAtMs > nowMs + telegramOwnerLinkChallengeTtlMs
  ) {
    throwInvalidOwnerLinkRequest();
  }

  return new Date(expiresAtMs).toISOString();
}

function assertRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throwInvalidOwnerLinkRequest();
  }

  return value as Record<string, unknown>;
}

function readNonnegativeSafeInteger(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throwInvalidOwnerLinkRequest();
  }

  return value as number;
}

function readPositiveSafeInteger(value: unknown) {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throwInvalidOwnerLinkRequest();
  }

  return value as number;
}

function normalizeExpectedBotUsername(value: unknown) {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throwInvalidOwnerLinkRequest();
  }

  const username = value.startsWith("@") ? value.slice(1) : value;

  if (!telegramBotUsernamePattern.test(username)) {
    throwInvalidOwnerLinkRequest();
  }

  return username.toLowerCase();
}

function parseChallengeFromCommand(
  value: unknown,
  expectedBotUsername: string | null | undefined,
) {
  if (typeof value !== "string") {
    throwInvalidOwnerLinkRequest();
  }

  const match = telegramOwnerLinkCommandPattern.exec(value);
  const targetBotUsername = match?.[1];
  const challenge = match?.[2];

  if (!challenge) {
    throwInvalidOwnerLinkRequest();
  }

  if (
    targetBotUsername &&
    targetBotUsername.toLowerCase() !==
      normalizeExpectedBotUsername(expectedBotUsername)
  ) {
    throwInvalidOwnerLinkRequest();
  }

  return assertTelegramOwnerLinkChallenge(challenge);
}

export function assertTelegramOwnerLinkChallenge(value: unknown) {
  if (typeof value !== "string" || !challengePattern.test(value)) {
    throwInvalidOwnerLinkRequest();
  }

  return value;
}

export function assertTelegramOwnerLinkChallengeHash(value: unknown) {
  if (typeof value !== "string" || !challengeHashPattern.test(value)) {
    throwInvalidOwnerLinkRequest();
  }

  return value;
}

export function generateTelegramOwnerLinkChallenge(
  getRandomValues: (bytes: Uint8Array) => Uint8Array = (bytes) =>
    crypto.getRandomValues(bytes),
) {
  const bytes = new Uint8Array(telegramOwnerLinkChallengeBytes);
  getRandomValues(bytes);

  return assertTelegramOwnerLinkChallenge(bytesToHex(bytes));
}

export async function hashTelegramOwnerLinkChallenge(value: unknown) {
  const challenge = assertTelegramOwnerLinkChallenge(value);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(challenge),
  );

  return assertTelegramOwnerLinkChallengeHash(
    bytesToHex(new Uint8Array(digest)),
  );
}

export async function createTelegramOwnerLinkChallengeMaterial(
  options: CreateTelegramOwnerLinkChallengeMaterialOptions = {},
): Promise<TelegramOwnerLinkChallengeMaterial> {
  const nowMs = assertNowMs(options.nowMs ?? Date.now());
  const challenge = generateTelegramOwnerLinkChallenge(
    options.getRandomValues,
  );
  const challengeHash = await hashTelegramOwnerLinkChallenge(challenge);

  return {
    challenge,
    challengeHash,
    expiresAt: new Date(nowMs + telegramOwnerLinkChallengeTtlMs).toISOString(),
  };
}

export function createTelegramOwnerLinkChallengeStoreInput(
  input: {
    agentId: unknown;
    telegramSessionId: unknown;
    issuedByUserId: unknown;
    challengeHash: unknown;
    expiresAt: unknown;
  },
  nowMs: number = Date.now(),
): TelegramOwnerLinkChallengeStoreInput {
  const validatedNowMs = assertNowMs(nowMs);

  return {
    agentId: assertUuid(input.agentId),
    telegramSessionId: assertUuid(input.telegramSessionId),
    issuedByUserId: assertUuid(input.issuedByUserId),
    challengeHash: assertTelegramOwnerLinkChallengeHash(input.challengeHash),
    expiresAt: assertChallengeExpiry(input.expiresAt, validatedNowMs),
  };
}

export function buildTelegramOwnerLinkDeepLink(
  botUsername: unknown,
  challenge: unknown,
) {
  const username = normalizeExpectedBotUsername(botUsername);

  if (!username) {
    throwInvalidOwnerLinkRequest();
  }

  return `https://t.me/${username}?start=${
    assertTelegramOwnerLinkChallenge(challenge)
  }`;
}

export async function parseAndHashTelegramOwnerLinkUpdate(
  value: unknown,
  options: ParseTelegramOwnerLinkUpdateOptions = {},
): Promise<TelegramOwnerLinkConsumeInput> {
  try {
    const update = assertRecord(value);
    const telegramUpdateId = readNonnegativeSafeInteger(update.update_id);
    const message = assertRecord(update.message);
    const from = assertRecord(message.from);
    const chat = assertRecord(message.chat);
    const telegramUserId = readPositiveSafeInteger(from.id);
    const telegramChatId = readPositiveSafeInteger(chat.id);

    if (chat.type !== "private" || telegramUserId !== telegramChatId) {
      throwInvalidOwnerLinkRequest();
    }

    const challenge = parseChallengeFromCommand(
      message.text,
      options.expectedBotUsername,
    );
    const hashChallenge = options.hashChallenge ??
      hashTelegramOwnerLinkChallenge;
    const challengeHash = assertTelegramOwnerLinkChallengeHash(
      await hashChallenge(challenge),
    );

    return {
      telegramUpdateId: String(telegramUpdateId),
      telegramUserId: String(telegramUserId),
      telegramChatId: String(telegramChatId),
      challengeHash,
    };
  } catch (error) {
    if (error instanceof TelegramOwnerLinkContractError) {
      throw error;
    }

    throw sanitizeTelegramOwnerLinkContractError(error);
  }
}

export function sanitizeTelegramOwnerLinkContractError(_error: unknown) {
  return new TelegramOwnerLinkContractError(
    500,
    "server_error",
    "Telegram owner-link challenge processing failed.",
  );
}
