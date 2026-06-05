import {
  assertActivateTelegramSessionResult,
  assertStoreTelegramWebhookSecretResult,
  assertTelegramSessionId,
  assertTelegramWebhookSecretRef,
  createTelegramWebhookSecretStoreInput,
  type ActivateTelegramSessionResult,
  type RevokeTelegramWebhookSecretResult,
  type StoreTelegramWebhookSecretResult,
  type TelegramWebhookSecretStoreInput,
} from "./webhook-secret.ts";

export interface TelegramWebhookPersistenceResult<T> {
  data: T | null;
  error: unknown;
}

export interface TelegramWebhookPersistenceBuilder {
  insert: (
    payload: Record<string, unknown>,
  ) => TelegramWebhookPersistenceBuilder;
  update: (
    payload: Record<string, unknown>,
  ) => TelegramWebhookPersistenceBuilder;
  eq: (
    column: string,
    value: unknown,
  ) => TelegramWebhookPersistenceBuilder;
  is: (
    column: string,
    value: unknown,
  ) => TelegramWebhookPersistenceBuilder;
  not: (
    column: string,
    operator: string,
    value: unknown,
  ) => TelegramWebhookPersistenceBuilder;
  select: (
    columns: string,
  ) => TelegramWebhookPersistenceBuilder;
  maybeSingle: <T>() => Promise<TelegramWebhookPersistenceResult<T>>;
}

export interface TelegramWebhookPersistenceClient {
  from: (table: string) => TelegramWebhookPersistenceBuilder;
}

export interface RevokeTelegramWebhookSecretRecordOptions {
  now?: () => Date;
}

export async function storeTelegramWebhookSecretRecord(
  serviceClient: TelegramWebhookPersistenceClient,
  input: TelegramWebhookSecretStoreInput,
): Promise<StoreTelegramWebhookSecretResult> {
  const storeInput = createTelegramWebhookSecretStoreInput(input);
  const { data, error } = await serviceClient
    .from("telegram_webhook_secrets")
    .insert({
      webhook_secret_ref: storeInput.webhookSecretRef,
      webhook_secret_hash: storeInput.webhookSecretHash,
      telegram_session_id: storeInput.telegramSessionId,
    })
    .select("webhook_secret_ref")
    .maybeSingle<{ webhook_secret_ref?: unknown }>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Telegram webhook secret was not stored.");
  }

  return assertStoreTelegramWebhookSecretResult(
    { webhookSecretRef: data.webhook_secret_ref },
    storeInput.webhookSecretRef,
  );
}

export async function revokeTelegramWebhookSecretRecord(
  serviceClient: TelegramWebhookPersistenceClient,
  input: { webhookSecretRef: unknown },
  options: RevokeTelegramWebhookSecretRecordOptions = {},
): Promise<RevokeTelegramWebhookSecretResult> {
  const webhookSecretRef = assertTelegramWebhookSecretRef(
    input.webhookSecretRef,
  );
  const revokedAt = (options.now ?? (() => new Date()))().toISOString();
  const { data, error } = await serviceClient
    .from("telegram_webhook_secrets")
    .update({ revoked_at: revokedAt })
    .eq("webhook_secret_ref", webhookSecretRef)
    .is("revoked_at", null)
    .select("webhook_secret_ref")
    .maybeSingle<{ webhook_secret_ref?: unknown }>();

  if (error) {
    throw error;
  }

  if (!data || data.webhook_secret_ref !== webhookSecretRef) {
    throw new Error("Telegram webhook secret was not revoked.");
  }

  return { revoked: true };
}

export async function activateTelegramSessionRecord(
  serviceClient: TelegramWebhookPersistenceClient,
  input: { telegramSessionId: unknown },
): Promise<ActivateTelegramSessionResult> {
  const telegramSessionId = assertTelegramSessionId(input.telegramSessionId);
  const { data, error } = await serviceClient
    .from("telegram_sessions")
    .update({ webhook_status: "active" })
    .eq("id", telegramSessionId)
    .eq("webhook_status", "queued")
    .not("token_secret_ref", "is", null)
    .select("id")
    .maybeSingle<{ id?: unknown }>();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Telegram session was not activated.");
  }

  return assertActivateTelegramSessionResult(
    {
      activated: true,
      telegramSessionId: data.id,
    },
    telegramSessionId,
  );
}
