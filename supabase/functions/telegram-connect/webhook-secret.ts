import { HttpError } from "./core.ts";

export interface TelegramWebhookSecretMaterial {
  webhookSecretToken: string;
  webhookSecretHash: string;
  webhookSecretRef: string;
}

export interface TelegramWebhookSecretStoreInput {
  telegramSessionId: string;
  webhookSecretHash: string;
  webhookSecretRef: string;
}

export interface StoreTelegramWebhookSecretResult {
  webhookSecretRef: string;
}

export interface RevokeTelegramWebhookSecretResult {
  revoked: boolean;
}

export interface ActivateTelegramSessionResult {
  activated: boolean;
  telegramSessionId: string;
}

export interface FinalizeTelegramWebhookRegistrationInput {
  telegramSessionId: string;
  botToken: string;
  webhookUrl: string;
  webhookSecretToken: string;
  webhookSecretHash: string;
  webhookSecretRef: string;
}

export interface FinalizeTelegramWebhookRegistrationResult {
  registered: true;
}

export interface FinalizeTelegramWebhookRegistrationDependencies {
  storeTelegramWebhookSecret: (
    input: TelegramWebhookSecretStoreInput,
  ) => Promise<StoreTelegramWebhookSecretResult>;
  registerTelegramWebhook: (input: {
    botToken: string;
    webhookUrl: string;
    webhookSecretToken: string;
  }) => Promise<unknown>;
  activateTelegramSession: (input: {
    telegramSessionId: string;
  }) => Promise<ActivateTelegramSessionResult>;
  revokeTelegramWebhookSecret?: (input: {
    webhookSecretRef: string;
  }) => Promise<RevokeTelegramWebhookSecretResult>;
  unregisterTelegramWebhook?: (input: {
    botToken: string;
  }) => Promise<unknown>;
}

export interface CreateTelegramWebhookSecretMaterialOptions {
  getRandomValues?: (bytes: Uint8Array) => Uint8Array;
  randomUUID?: () => string;
  webhookSecretToken?: string;
  webhookSecretRef?: string;
}

const webhookSecretTokenPattern = /^[0-9a-f]{64}$/;
const webhookSecretHashPattern = /^[0-9a-f]{64}$/;
const webhookSecretRefPattern =
  /^webhook:telegram:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function assertTelegramWebhookSecretToken(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(
      400,
      "invalid_request",
      "webhookSecretToken is required.",
    );
  }

  const webhookSecretToken = value.trim();

  if (!webhookSecretTokenPattern.test(webhookSecretToken)) {
    throw new HttpError(
      400,
      "invalid_request",
      "webhookSecretToken is invalid.",
    );
  }

  return webhookSecretToken;
}

export function assertTelegramWebhookSecretHash(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(
      400,
      "invalid_request",
      "webhookSecretHash is required.",
    );
  }

  const webhookSecretHash = value.trim();

  if (!webhookSecretHashPattern.test(webhookSecretHash)) {
    throw new HttpError(
      400,
      "invalid_request",
      "webhookSecretHash is invalid.",
    );
  }

  return webhookSecretHash;
}

export function assertTelegramWebhookSecretRef(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(
      400,
      "invalid_request",
      "webhookSecretRef is required.",
    );
  }

  const webhookSecretRef = value.trim();

  if (!webhookSecretRefPattern.test(webhookSecretRef)) {
    throw new HttpError(
      400,
      "invalid_request",
      "webhookSecretRef is invalid.",
    );
  }

  return webhookSecretRef;
}

export function assertTelegramSessionId(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(
      400,
      "invalid_request",
      "telegramSessionId is required.",
    );
  }

  const telegramSessionId = value.trim();

  if (!uuidPattern.test(telegramSessionId)) {
    throw new HttpError(
      400,
      "invalid_request",
      "telegramSessionId is invalid.",
    );
  }

  return telegramSessionId;
}

export function generateTelegramWebhookSecretToken(
  getRandomValues: (bytes: Uint8Array) => Uint8Array = (bytes) =>
    crypto.getRandomValues(bytes),
) {
  const bytes = new Uint8Array(32);
  getRandomValues(bytes);

  return bytesToHex(bytes);
}

export function generateTelegramWebhookSecretRef(
  randomUUID: () => string = () => crypto.randomUUID(),
) {
  return assertTelegramWebhookSecretRef(`webhook:telegram:${randomUUID()}`);
}

export async function hashTelegramWebhookSecretToken(value: unknown) {
  const webhookSecretToken = assertTelegramWebhookSecretToken(value);
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(webhookSecretToken),
  );

  return bytesToHex(new Uint8Array(digest));
}

export async function createTelegramWebhookSecretMaterial(
  options: CreateTelegramWebhookSecretMaterialOptions = {},
): Promise<TelegramWebhookSecretMaterial> {
  const webhookSecretToken = options.webhookSecretToken
    ? assertTelegramWebhookSecretToken(options.webhookSecretToken)
    : generateTelegramWebhookSecretToken(options.getRandomValues);
  const webhookSecretHash = await hashTelegramWebhookSecretToken(
    webhookSecretToken,
  );
  const webhookSecretRef = options.webhookSecretRef
    ? assertTelegramWebhookSecretRef(options.webhookSecretRef)
    : generateTelegramWebhookSecretRef(options.randomUUID);

  return {
    webhookSecretToken,
    webhookSecretHash,
    webhookSecretRef,
  };
}

export function createTelegramWebhookSecretStoreInput(input: {
  telegramSessionId: unknown;
  webhookSecretHash: unknown;
  webhookSecretRef: unknown;
}): TelegramWebhookSecretStoreInput {
  return {
    telegramSessionId: assertTelegramSessionId(input.telegramSessionId),
    webhookSecretHash: assertTelegramWebhookSecretHash(
      input.webhookSecretHash,
    ),
    webhookSecretRef: assertTelegramWebhookSecretRef(input.webhookSecretRef),
  };
}

export function assertStoreTelegramWebhookSecretResult(
  value: unknown,
  expectedWebhookSecretRef?: string,
): StoreTelegramWebhookSecretResult {
  if (!value || typeof value !== "object") {
    throw new Error("Telegram webhook secret store result was invalid.");
  }

  const webhookSecretRef = assertTelegramWebhookSecretRef(
    (value as Record<string, unknown>).webhookSecretRef,
  );

  if (
    expectedWebhookSecretRef !== undefined &&
    webhookSecretRef !==
      assertTelegramWebhookSecretRef(expectedWebhookSecretRef)
  ) {
    throw new Error(
      "Telegram webhook secret store returned an unexpected ref.",
    );
  }

  return { webhookSecretRef };
}

export function assertRevokeTelegramWebhookSecretResult(
  value: unknown,
): RevokeTelegramWebhookSecretResult {
  if (!value || typeof value !== "object") {
    throw new Error("Telegram webhook secret revoke result was invalid.");
  }

  const revoked = (value as Record<string, unknown>).revoked;

  if (revoked !== true) {
    throw new Error("Telegram webhook secret was not revoked.");
  }

  return { revoked };
}

export function assertActivateTelegramSessionResult(
  value: unknown,
  expectedTelegramSessionId: unknown,
): ActivateTelegramSessionResult {
  if (!value || typeof value !== "object") {
    throw new Error("Telegram session activation result was invalid.");
  }

  const expectedSessionId = assertTelegramSessionId(expectedTelegramSessionId);
  const telegramSessionId = assertTelegramSessionId(
    (value as Record<string, unknown>).telegramSessionId,
  );
  const activated = (value as Record<string, unknown>).activated;

  if (telegramSessionId !== expectedSessionId) {
    throw new Error("Telegram session activation returned an unexpected row.");
  }

  if (activated !== true) {
    throw new Error("Telegram session was not activated.");
  }

  return {
    activated,
    telegramSessionId,
  };
}

export function sanitizeTelegramWebhookSecretPersistenceError(error: unknown) {
  if (error instanceof HttpError) {
    return error;
  }

  return new HttpError(
    500,
    "server_error",
    "Telegram webhook secret persistence failed.",
  );
}

export function sanitizeTelegramSessionActivationError(error: unknown) {
  if (error instanceof HttpError) {
    return error;
  }

  return new HttpError(
    500,
    "server_error",
    "Telegram session activation failed.",
  );
}

export function sanitizeTelegramWebhookRegistrationFinalizeError(
  error: unknown,
) {
  if (error instanceof HttpError) {
    return error;
  }

  return new HttpError(
    424,
    "webhook_registration_failed",
    "Telegram webhook registration failed.",
  );
}

export async function finalizeTelegramWebhookRegistration(
  input: FinalizeTelegramWebhookRegistrationInput,
  dependencies: FinalizeTelegramWebhookRegistrationDependencies,
): Promise<FinalizeTelegramWebhookRegistrationResult> {
  const telegramSessionId = assertTelegramSessionId(input.telegramSessionId);
  const webhookSecretToken = assertTelegramWebhookSecretToken(
    input.webhookSecretToken,
  );
  const storeInput = createTelegramWebhookSecretStoreInput({
    telegramSessionId,
    webhookSecretHash: input.webhookSecretHash,
    webhookSecretRef: input.webhookSecretRef,
  });

  let storedWebhookSecretRef: string;

  try {
    const stored = await dependencies.storeTelegramWebhookSecret(storeInput);
    storedWebhookSecretRef = assertStoreTelegramWebhookSecretResult(
      stored,
      storeInput.webhookSecretRef,
    ).webhookSecretRef;
  } catch (error) {
    throw sanitizeTelegramWebhookSecretPersistenceError(error);
  }

  try {
    await dependencies.registerTelegramWebhook({
      botToken: input.botToken,
      webhookUrl: input.webhookUrl,
      webhookSecretToken,
    });
  } catch (error) {
    if (dependencies.revokeTelegramWebhookSecret) {
      try {
        assertRevokeTelegramWebhookSecretResult(
          await dependencies.revokeTelegramWebhookSecret({
            webhookSecretRef: storedWebhookSecretRef,
          }),
        );
      } catch {
        // Best-effort cleanup only. Never expose rollback internals.
      }
    }

    throw sanitizeTelegramWebhookRegistrationFinalizeError(error);
  }

  try {
    assertActivateTelegramSessionResult(
      await dependencies.activateTelegramSession({ telegramSessionId }),
      telegramSessionId,
    );
  } catch (error) {
    if (dependencies.unregisterTelegramWebhook) {
      try {
        await dependencies.unregisterTelegramWebhook({
          botToken: input.botToken,
        });
      } catch {
        // Best-effort cleanup only. Never expose rollback internals.
      }
    }

    if (dependencies.revokeTelegramWebhookSecret) {
      try {
        assertRevokeTelegramWebhookSecretResult(
          await dependencies.revokeTelegramWebhookSecret({
            webhookSecretRef: storedWebhookSecretRef,
          }),
        );
      } catch {
        // Best-effort cleanup only. Never expose rollback internals.
      }
    }

    throw sanitizeTelegramSessionActivationError(error);
  }

  return { registered: true };
}
