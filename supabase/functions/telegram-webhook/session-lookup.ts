import {
  assertTelegramWebhookSessionLookupResult,
  HttpError,
  sanitizeTelegramWebhookSessionLookupError,
  type TelegramWebhookSessionLookupRecord,
  type TelegramWebhookSessionLookupRpcResult,
} from "./core.ts";

export interface TelegramWebhookSessionLookupRpcClient {
  rpc(
    functionName: "resolve_telegram_webhook_session",
    args: { p_webhook_secret_hash: string },
  ): Promise<TelegramWebhookSessionLookupRpcResult> | TelegramWebhookSessionLookupRpcResult;
}

const textEncoder = new TextEncoder();

export function assertTelegramWebhookSecretHeaderValue(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(
      401,
      "webhook_verification_failed",
      "Telegram webhook verification failed.",
    );
  }

  return value.trim();
}

export async function hashTelegramWebhookSecretHeader(value: unknown) {
  const webhookSecretHeader = assertTelegramWebhookSecretHeaderValue(value);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    textEncoder.encode(webhookSecretHeader),
  );

  return bytesToLowerHex(new Uint8Array(digest));
}

export async function lookupTelegramWebhookSessionBySecretHeader(
  input: {
    webhookSecretHeader: unknown;
    rpcClient: TelegramWebhookSessionLookupRpcClient;
  },
): Promise<TelegramWebhookSessionLookupRecord> {
  const webhookSecretHash = await hashTelegramWebhookSecretHeader(
    input.webhookSecretHeader,
  );

  try {
    const result = await input.rpcClient.rpc(
      "resolve_telegram_webhook_session",
      { p_webhook_secret_hash: webhookSecretHash },
    );

    return assertTelegramWebhookSessionLookupResult(result);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw sanitizeTelegramWebhookSessionLookupError(error);
  }
}

function bytesToLowerHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}
