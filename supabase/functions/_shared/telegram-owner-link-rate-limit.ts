export class TelegramOwnerLinkRateLimitContractError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export type TelegramOwnerLinkRateLimitDecision =
  | { allowed: true; status: "allowed" }
  | { allowed: false; status: "rate_limited" };

export interface TelegramOwnerLinkRateLimitedResponse {
  ok: false;
  status: "rate_limited";
  message: "Telegram owner-link requests are temporarily limited.";
}

export const telegramOwnerLinkIssueAgentWindowMs = 15 * 60 * 1000;
export const telegramOwnerLinkIssueAgentMax = 3;
export const telegramOwnerLinkIssueSessionWindowMs = 15 * 60 * 1000;
export const telegramOwnerLinkIssueSessionMax = 3;
export const telegramOwnerLinkIssueOwnerWindowMs = 24 * 60 * 60 * 1000;
export const telegramOwnerLinkIssueOwnerMax = 20;
export const telegramOwnerLinkConsumeIdentityWindowMs = 10 * 60 * 1000;
export const telegramOwnerLinkConsumeIdentityMax = 5;
export const telegramOwnerLinkConsumeSessionWindowMs = 10 * 60 * 1000;
export const telegramOwnerLinkConsumeSessionMax = 30;
export const telegramOwnerLinkConsumeBlockMs = 30 * 60 * 1000;

export function decideTelegramOwnerLinkIssueRateLimit(input: {
  agentWindowCount: unknown;
  sessionWindowCount: unknown;
  ownerWindowCount: unknown;
}): TelegramOwnerLinkRateLimitDecision {
  try {
    const agentWindowCount = readNonnegativeSafeInteger(
      input.agentWindowCount,
    );
    const sessionWindowCount = readNonnegativeSafeInteger(
      input.sessionWindowCount,
    );
    const ownerWindowCount = readNonnegativeSafeInteger(
      input.ownerWindowCount,
    );

    if (
      agentWindowCount >= telegramOwnerLinkIssueAgentMax ||
      sessionWindowCount >= telegramOwnerLinkIssueSessionMax ||
      ownerWindowCount >= telegramOwnerLinkIssueOwnerMax
    ) {
      return rateLimitedDecision();
    }

    return allowedDecision();
  } catch (error) {
    throw sanitizeTelegramOwnerLinkRateLimitContractError(error);
  }
}

export function decideTelegramOwnerLinkConsumeRateLimit(input: {
  identityWindowCount: unknown;
  sessionWindowCount: unknown;
  blockedUntil?: unknown;
  nowMs?: unknown;
}): TelegramOwnerLinkRateLimitDecision {
  try {
    const identityWindowCount = readNonnegativeSafeInteger(
      input.identityWindowCount,
    );
    const sessionWindowCount = readNonnegativeSafeInteger(
      input.sessionWindowCount,
    );
    const nowMs = readNonnegativeSafeInteger(input.nowMs ?? Date.now());
    const blockedUntilMs = readOptionalFutureTime(input.blockedUntil);

    if (
      blockedUntilMs > nowMs ||
      identityWindowCount >= telegramOwnerLinkConsumeIdentityMax ||
      sessionWindowCount >= telegramOwnerLinkConsumeSessionMax
    ) {
      return rateLimitedDecision();
    }

    return allowedDecision();
  } catch (error) {
    throw sanitizeTelegramOwnerLinkRateLimitContractError(error);
  }
}

export function createTelegramOwnerLinkRateLimitedResponse(): TelegramOwnerLinkRateLimitedResponse {
  return {
    ok: false,
    status: "rate_limited",
    message: "Telegram owner-link requests are temporarily limited.",
  };
}

export function sanitizeTelegramOwnerLinkRateLimitContractError(
  _error: unknown,
) {
  return new TelegramOwnerLinkRateLimitContractError(
    500,
    "server_error",
    "Telegram owner-link rate limit contract failed.",
  );
}

function allowedDecision(): TelegramOwnerLinkRateLimitDecision {
  return { allowed: true, status: "allowed" };
}

function rateLimitedDecision(): TelegramOwnerLinkRateLimitDecision {
  return { allowed: false, status: "rate_limited" };
}

function readNonnegativeSafeInteger(value: unknown) {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    throw new Error("Unexpected Telegram owner-link rate limit count.");
  }

  return value;
}

function readOptionalFutureTime(value: unknown) {
  if (value === undefined || value === null) {
    return 0;
  }

  if (typeof value !== "string") {
    throw new Error("Unexpected Telegram owner-link blocked-until value.");
  }

  const blockedUntilMs = Date.parse(value);

  if (!Number.isFinite(blockedUntilMs) || blockedUntilMs < 0) {
    throw new Error("Unexpected Telegram owner-link blocked-until value.");
  }

  return blockedUntilMs;
}
