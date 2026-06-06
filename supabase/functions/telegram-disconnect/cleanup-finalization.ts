import {
  assertBotToken,
  HttpError,
} from "../telegram-connect/core.ts";
import type {
  ResolveTelegramBotTokenResult,
  RevokeTelegramBotTokenResult,
} from "../telegram-connect/secret-store.ts";
import {
  assertRevokeTelegramWebhookSecretResult,
  assertTelegramWebhookSecretRef,
  type RevokeTelegramWebhookSecretResult,
} from "../telegram-connect/webhook-secret.ts";
import type { TelegramDisconnectClaimResult } from "./session-claim.ts";

export type TelegramDisconnectCleanupAction = "disconnect" | "revoke";

export interface TelegramDisconnectCleanupDependencies {
  resolveTelegramBotToken: (input: {
    tokenSecretRef: string;
  }) => Promise<ResolveTelegramBotTokenResult>;
  unregisterTelegramWebhook: (input: { botToken: string }) => Promise<unknown>;
  revokeTelegramWebhookSecret: (input: {
    webhookSecretRef: string;
  }) => Promise<RevokeTelegramWebhookSecretResult>;
  revokeTelegramBotToken: (input: {
    tokenSecretRef: string;
  }) => Promise<RevokeTelegramBotTokenResult>;
}

export interface TelegramDisconnectCleanupResult {
  finalized: true;
  action: TelegramDisconnectCleanupAction;
}

interface DisconnectCleanupClaim {
  action: TelegramDisconnectCleanupAction;
  tokenSecretRef: string;
  webhookSecretRef: string;
}

export async function finalizeTelegramDisconnectCleanup(
  claim: TelegramDisconnectClaimResult,
  dependencies: TelegramDisconnectCleanupDependencies,
): Promise<TelegramDisconnectCleanupResult> {
  const cleanupClaim = assertDisconnectCleanupClaim(claim);
  const cleanupErrors: unknown[] = [];
  let botToken: string | null = null;

  try {
    botToken = assertResolveTelegramBotTokenResult(
      await dependencies.resolveTelegramBotToken({
        tokenSecretRef: cleanupClaim.tokenSecretRef,
      }),
    ).botToken;
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (botToken) {
    try {
      await dependencies.unregisterTelegramWebhook({ botToken });
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  try {
    assertRevokeTelegramWebhookSecretResult(
      await dependencies.revokeTelegramWebhookSecret({
        webhookSecretRef: cleanupClaim.webhookSecretRef,
      }),
    );
  } catch (error) {
    cleanupErrors.push(error);
  }

  if (cleanupClaim.action === "revoke") {
    try {
      assertRevokeTelegramBotTokenResult(
        await dependencies.revokeTelegramBotToken({
          tokenSecretRef: cleanupClaim.tokenSecretRef,
        }),
      );
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (cleanupErrors.length > 0) {
    throw sanitizeTelegramDisconnectCleanupError(cleanupErrors[0]);
  }

  return {
    finalized: true,
    action: cleanupClaim.action,
  };
}

export function assertDisconnectCleanupClaim(
  claim: TelegramDisconnectClaimResult,
): DisconnectCleanupClaim {
  if (claim.action !== "disconnect" && claim.action !== "revoke") {
    throw new HttpError(
      400,
      "invalid_request",
      "Telegram disconnect cleanup action is invalid.",
    );
  }

  if (!claim.tokenSecretRef || !claim.webhookSecretRef) {
    throw new HttpError(
      409,
      "telegram_disconnect_unavailable",
      "Telegram disconnect cleanup is unavailable.",
    );
  }

  return {
    action: claim.action,
    tokenSecretRef: assertOpaqueTokenSecretRef(claim.tokenSecretRef),
    webhookSecretRef: assertTelegramWebhookSecretRef(claim.webhookSecretRef),
  };
}

export function sanitizeTelegramDisconnectCleanupError(_error: unknown) {
  return new HttpError(
    424,
    "telegram_disconnect_cleanup_failed",
    "Telegram disconnect cleanup failed.",
  );
}

function assertResolveTelegramBotTokenResult(
  value: ResolveTelegramBotTokenResult,
) {
  if (!value || typeof value !== "object") {
    throw new Error("Telegram token resolve result was invalid.");
  }

  return {
    botToken: assertBotToken(value.botToken),
  };
}

function assertRevokeTelegramBotTokenResult(
  value: RevokeTelegramBotTokenResult,
) {
  if (!value || typeof value !== "object" || value.revoked !== true) {
    throw new Error("Telegram token secret was not revoked.");
  }

  return { revoked: true };
}

function assertOpaqueTokenSecretRef(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(
      409,
      "telegram_disconnect_unavailable",
      "Telegram disconnect cleanup is unavailable.",
    );
  }

  const tokenSecretRef = value.trim();

  if (!/^[A-Za-z0-9][A-Za-z0-9:_-]{15,255}$/.test(tokenSecretRef)) {
    throw new HttpError(
      409,
      "telegram_disconnect_unavailable",
      "Telegram disconnect cleanup is unavailable.",
    );
  }

  return tokenSecretRef;
}
