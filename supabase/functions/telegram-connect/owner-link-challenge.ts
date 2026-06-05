import {
  createTelegramOwnerLinkChallengeStoreInput,
  TelegramOwnerLinkContractError,
} from "../_shared/telegram-owner-link.ts";
import { HttpError } from "./core.ts";

export interface TelegramOwnerLinkIssueResult {
  issued: true;
  status: "issued";
}

export interface TelegramOwnerLinkIssueRpcResult {
  data?: unknown;
  error?: unknown | null;
}

export interface TelegramOwnerLinkIssueRpcClient {
  rpc(
    functionName: "issue_telegram_owner_link_challenge",
    args: {
      p_agent_id: string;
      p_telegram_session_id: string;
      p_issued_by_user_id: string;
      p_challenge_hash: string;
      p_expires_at: string;
    },
  ): Promise<TelegramOwnerLinkIssueRpcResult> | TelegramOwnerLinkIssueRpcResult;
}

export async function issueTelegramOwnerLinkChallenge(input: {
  agentId: unknown;
  telegramSessionId: unknown;
  issuedByUserId: unknown;
  challengeHash: unknown;
  expiresAt: unknown;
  nowMs?: number;
  rpcClient: TelegramOwnerLinkIssueRpcClient;
}): Promise<TelegramOwnerLinkIssueResult> {
  try {
    const storeInput = createTelegramOwnerLinkChallengeStoreInput(
      {
        agentId: input.agentId,
        telegramSessionId: input.telegramSessionId,
        issuedByUserId: input.issuedByUserId,
        challengeHash: input.challengeHash,
        expiresAt: input.expiresAt,
      },
      input.nowMs,
    );
    const result = await input.rpcClient.rpc(
      "issue_telegram_owner_link_challenge",
      {
        p_agent_id: storeInput.agentId,
        p_telegram_session_id: storeInput.telegramSessionId,
        p_issued_by_user_id: storeInput.issuedByUserId,
        p_challenge_hash: storeInput.challengeHash,
        p_expires_at: storeInput.expiresAt,
      },
    );

    return assertTelegramOwnerLinkIssueRpcResult(result);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (
      error instanceof TelegramOwnerLinkContractError &&
      error.statusCode === 400
    ) {
      throw new HttpError(
        400,
        "invalid_owner_link",
        "Telegram owner-link request is invalid.",
      );
    }

    throw sanitizeTelegramOwnerLinkIssueError(error);
  }
}

export function assertTelegramOwnerLinkIssueRpcResult(
  result: TelegramOwnerLinkIssueRpcResult,
): TelegramOwnerLinkIssueResult {
  if (result.error) {
    throw sanitizeTelegramOwnerLinkIssueError(result.error);
  }

  if (!Array.isArray(result.data)) {
    throw sanitizeTelegramOwnerLinkIssueError(
      new Error("Unexpected Telegram owner-link issue result."),
    );
  }

  if (!result.data.length) {
    throw new HttpError(
      409,
      "owner_link_unavailable",
      "Telegram owner-link challenge is unavailable.",
    );
  }

  if (result.data.length !== 1) {
    throw sanitizeTelegramOwnerLinkIssueError(
      new Error("Unexpected Telegram owner-link issue result."),
    );
  }

  return assertTelegramOwnerLinkIssueRow(result.data[0]);
}

export function assertTelegramOwnerLinkIssueRow(
  value: unknown,
): TelegramOwnerLinkIssueResult {
  try {
    if (!isPlainRecord(value)) {
      throw new Error("Unexpected Telegram owner-link issue row.");
    }

    if (Object.keys(value).sort().join(",") !== "issued,status") {
      throw new Error("Unexpected Telegram owner-link issue row.");
    }

    if (value.issued !== true || value.status !== "issued") {
      throw new Error("Unexpected Telegram owner-link issue row.");
    }

    return { issued: true, status: "issued" };
  } catch (error) {
    throw sanitizeTelegramOwnerLinkIssueError(error);
  }
}

export function sanitizeTelegramOwnerLinkIssueError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram owner-link challenge issue failed.",
  );
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
