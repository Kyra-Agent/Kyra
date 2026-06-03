import { HttpError } from "./core.ts";

export type TelegramSecretStoreProvider =
  | "mock"
  | "supabase_vault"
  | "encrypted_private_table"
  | "external_secret_manager";

export interface StoreTelegramBotTokenInput {
  agentId: string;
  ownerUserId: string;
  telegramBotId: string;
  botToken: string;
}

export interface StoreTelegramBotTokenResult {
  tokenSecretRef: string;
  provider: TelegramSecretStoreProvider;
}

export interface ResolveTelegramBotTokenInput {
  tokenSecretRef: string;
}

export interface ResolveTelegramBotTokenResult {
  botToken: string;
}

export interface RevokeTelegramBotTokenInput {
  tokenSecretRef: string;
}

export interface RevokeTelegramBotTokenResult {
  revoked: boolean;
}

export interface TelegramBotTokenSecretStore {
  storeTelegramBotToken: (
    input: StoreTelegramBotTokenInput,
  ) => Promise<StoreTelegramBotTokenResult>;
  resolveTelegramBotToken: (
    input: ResolveTelegramBotTokenInput,
  ) => Promise<ResolveTelegramBotTokenResult>;
  revokeTelegramBotToken: (
    input: RevokeTelegramBotTokenInput,
  ) => Promise<RevokeTelegramBotTokenResult>;
}

const tokenSecretRefPattern = /^[A-Za-z0-9][A-Za-z0-9:_-]{15,255}$/;

function assertNonEmptyString(value: string, fieldName: string) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "invalid_request", `${fieldName} is required.`);
  }

  return value.trim();
}

export function assertTokenSecretRef(value: unknown) {
  if (typeof value !== "string" || !value.trim()) {
    throw new HttpError(400, "invalid_request", "tokenSecretRef is required.");
  }

  const tokenSecretRef = value.trim();

  if (!tokenSecretRefPattern.test(tokenSecretRef)) {
    throw new HttpError(400, "invalid_request", "tokenSecretRef is invalid.");
  }

  return tokenSecretRef;
}

export function sanitizeSecretStoreError(error: unknown) {
  if (error instanceof HttpError) {
    return error;
  }

  return new HttpError(
    500,
    "server_error",
    "Telegram token secret store failed.",
  );
}

export function createMockTelegramBotTokenSecretStore(): TelegramBotTokenSecretStore {
  const storedTokens = new Map<string, string>();
  let nextId = 1;

  return {
    async storeTelegramBotToken(input) {
      assertNonEmptyString(input.agentId, "agentId");
      assertNonEmptyString(input.ownerUserId, "ownerUserId");
      assertNonEmptyString(input.telegramBotId, "telegramBotId");
      const botToken = assertNonEmptyString(input.botToken, "botToken");
      const tokenSecretRef = `mock_telegram_token_ref_${
        String(nextId++).padStart(6, "0")
      }`;

      storedTokens.set(tokenSecretRef, botToken);

      return {
        tokenSecretRef,
        provider: "mock",
      };
    },

    async resolveTelegramBotToken(input) {
      const tokenSecretRef = assertTokenSecretRef(input.tokenSecretRef);
      const botToken = storedTokens.get(tokenSecretRef);

      if (!botToken) {
        throw new HttpError(
          404,
          "secret_not_found",
          "Telegram token secret was not found.",
        );
      }

      return {
        botToken,
      };
    },

    async revokeTelegramBotToken(input) {
      const tokenSecretRef = assertTokenSecretRef(input.tokenSecretRef);

      storedTokens.delete(tokenSecretRef);

      return {
        revoked: true,
      };
    },
  };
}
