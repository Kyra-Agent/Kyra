import { HttpError } from "./core.ts";

export type TelegramOwnerLinkConsumeResult =
  | { linked: true; status: "linked" }
  | { linked: false; status: "duplicate" | "not_linked" };

export interface TelegramOwnerLinkConsumeRpcResult {
  data?: unknown;
  error?: unknown | null;
}

export interface TelegramOwnerLinkConsumeRpcClient {
  rpc(
    functionName: "consume_telegram_owner_link_challenge",
    args: {
      p_telegram_session_id: string;
      p_telegram_update_id: number;
      p_telegram_user_id: string;
      p_telegram_chat_id: string;
      p_challenge_hash: string;
    },
  ):
    | Promise<TelegramOwnerLinkConsumeRpcResult>
    | TelegramOwnerLinkConsumeRpcResult;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const positiveTelegramIdPattern = /^[1-9][0-9]*$/;
const challengeHashPattern = /^[0-9a-f]{64}$/;

export async function consumeTelegramOwnerLinkChallenge(input: {
  telegramSessionId: unknown;
  telegramUpdateId: unknown;
  telegramUserId: unknown;
  telegramChatId: unknown;
  challengeHash: unknown;
  rpcClient: TelegramOwnerLinkConsumeRpcClient;
}): Promise<TelegramOwnerLinkConsumeResult> {
  try {
    const telegramUserId = readPositiveTelegramId(input.telegramUserId);
    const telegramChatId = readPositiveTelegramId(input.telegramChatId);

    if (telegramUserId !== telegramChatId) {
      throwInvalidOwnerLinkUpdate();
    }

    const result = await input.rpcClient.rpc(
      "consume_telegram_owner_link_challenge",
      {
        p_telegram_session_id: readSessionId(input.telegramSessionId),
        p_telegram_update_id: readUpdateId(input.telegramUpdateId),
        p_telegram_user_id: telegramUserId,
        p_telegram_chat_id: telegramChatId,
        p_challenge_hash: readChallengeHash(input.challengeHash),
      },
    );

    return assertTelegramOwnerLinkConsumeRpcResult(result);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw sanitizeTelegramOwnerLinkConsumeError(error);
  }
}

export function assertTelegramOwnerLinkConsumeRpcResult(
  result: TelegramOwnerLinkConsumeRpcResult,
): TelegramOwnerLinkConsumeResult {
  if (result.error) {
    throw sanitizeTelegramOwnerLinkConsumeError(result.error);
  }

  if (!Array.isArray(result.data)) {
    throw sanitizeTelegramOwnerLinkConsumeError(
      new Error("Unexpected Telegram owner-link consume result."),
    );
  }

  if (!result.data.length) {
    return { linked: false, status: "not_linked" };
  }

  if (result.data.length !== 1) {
    throw sanitizeTelegramOwnerLinkConsumeError(
      new Error("Unexpected Telegram owner-link consume result."),
    );
  }

  return assertTelegramOwnerLinkConsumeRow(result.data[0]);
}

export function assertTelegramOwnerLinkConsumeRow(
  value: unknown,
): TelegramOwnerLinkConsumeResult {
  try {
    if (!isPlainRecord(value)) {
      throw new Error("Unexpected Telegram owner-link consume row.");
    }

    if (Object.keys(value).sort().join(",") !== "linked,status") {
      throw new Error("Unexpected Telegram owner-link consume row.");
    }

    if (value.linked === true && value.status === "linked") {
      return { linked: true, status: "linked" };
    }

    if (value.linked === false && value.status === "duplicate") {
      return { linked: false, status: "duplicate" };
    }

    throw new Error("Unexpected Telegram owner-link consume row.");
  } catch (error) {
    throw sanitizeTelegramOwnerLinkConsumeError(error);
  }
}

export function sanitizeTelegramOwnerLinkConsumeError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram owner-link consume failed.",
  );
}

function readSessionId(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value)) {
    throwInvalidOwnerLinkUpdate();
  }

  return value;
}

function readUpdateId(value: unknown) {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) {
    return value;
  }

  if (typeof value !== "string" || !/^(0|[1-9][0-9]*)$/.test(value)) {
    throwInvalidOwnerLinkUpdate();
  }

  const updateId = Number(value);

  if (!Number.isSafeInteger(updateId)) {
    throwInvalidOwnerLinkUpdate();
  }

  return updateId;
}

function readPositiveTelegramId(value: unknown) {
  if (typeof value !== "string" || !positiveTelegramIdPattern.test(value)) {
    throwInvalidOwnerLinkUpdate();
  }

  return value;
}

function readChallengeHash(value: unknown) {
  if (typeof value !== "string" || !challengeHashPattern.test(value)) {
    throwInvalidOwnerLinkUpdate();
  }

  return value;
}

function throwInvalidOwnerLinkUpdate(): never {
  throw new HttpError(
    400,
    "invalid_update",
    "Telegram owner-link update is invalid.",
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
