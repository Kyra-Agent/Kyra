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
