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

export interface TelegramSecretStoreRpcClient {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: unknown }>;
}

const tokenSecretRefPattern = /^[A-Za-z0-9][A-Za-z0-9:_-]{15,255}$/;
const storeTelegramBotTokenRpcName = "store_telegram_bot_token";
const resolveTelegramBotTokenRpcName = "resolve_telegram_bot_token";
const revokeTelegramBotTokenRpcName = "revoke_telegram_bot_token";

function assertNonEmptyString(value: unknown, fieldName: string) {
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

function sanitizeRpcSecretStoreError(error: unknown) {
  if (error instanceof HttpError) {
    return error;
  }

  const errorCode = typeof error === "object" && error
    ? (error as Record<string, unknown>).code
    : undefined;
  const errorMessage = typeof error === "object" && error
    ? (error as Record<string, unknown>).message
    : undefined;

  if (errorCode === "secret_not_found") {
    return new HttpError(
      404,
      "secret_not_found",
      "Telegram token secret was not found.",
    );
  }

  if (
    errorCode === "23505" ||
    errorCode === "telegram_bot_already_connected" ||
    errorMessage === "telegram_bot_already_connected"
  ) {
    return new HttpError(
      409,
      "duplicate_bot_active",
      "Telegram bot is already connected.",
    );
  }

  return new HttpError(
    503,
    "secret_store_unavailable",
    "Telegram token secret store is unavailable.",
  );
}

function assertNoRpcError(error: unknown) {
  if (error) {
    throw sanitizeRpcSecretStoreError(error);
  }
}

function assertRpcTokenSecretRef(value: unknown) {
  try {
    return assertTokenSecretRef(value);
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 400) {
      throw new HttpError(
        503,
        "secret_store_unavailable",
        "Telegram token secret store returned an invalid response.",
      );
    }

    throw error;
  }
}

function assertRpcBotToken(value: unknown) {
  try {
    return assertNonEmptyString(value, "botToken");
  } catch (error) {
    if (error instanceof HttpError && error.statusCode === 400) {
      throw new HttpError(
        503,
        "secret_store_unavailable",
        "Telegram token secret store returned an invalid response.",
      );
    }

    throw error;
  }
}

function assertRpcRevokeResult(value: unknown) {
  if (typeof value !== "boolean") {
    throw new HttpError(
      503,
      "secret_store_unavailable",
      "Telegram token secret store returned an invalid response.",
    );
  }

  return value;
}

export function createRpcTelegramBotTokenSecretStore(
  rpcClient: TelegramSecretStoreRpcClient,
): TelegramBotTokenSecretStore {
  return {
    async storeTelegramBotToken(input) {
      const agentId = assertNonEmptyString(input.agentId, "agentId");
      const ownerUserId = assertNonEmptyString(
        input.ownerUserId,
        "ownerUserId",
      );
      const telegramBotId = assertNonEmptyString(
        input.telegramBotId,
        "telegramBotId",
      );
      const botToken = assertNonEmptyString(input.botToken, "botToken");

      try {
        const { data, error } = await rpcClient.rpc(
          storeTelegramBotTokenRpcName,
          {
            p_agent_id: agentId,
            p_owner_user_id: ownerUserId,
            p_telegram_bot_id: telegramBotId,
            p_bot_token: botToken,
          },
        );

        assertNoRpcError(error);

        return {
          tokenSecretRef: assertRpcTokenSecretRef(data),
          provider: "supabase_vault",
        };
      } catch (error) {
        throw sanitizeSecretStoreError(error);
      }
    },

    async resolveTelegramBotToken(input) {
      const tokenSecretRef = assertTokenSecretRef(input.tokenSecretRef);

      try {
        const { data, error } = await rpcClient.rpc(
          resolveTelegramBotTokenRpcName,
          {
            p_token_secret_ref: tokenSecretRef,
          },
        );

        assertNoRpcError(error);

        return {
          botToken: assertRpcBotToken(data),
        };
      } catch (error) {
        throw sanitizeSecretStoreError(error);
      }
    },

    async revokeTelegramBotToken(input) {
      const tokenSecretRef = assertTokenSecretRef(input.tokenSecretRef);

      try {
        const { data, error } = await rpcClient.rpc(
          revokeTelegramBotTokenRpcName,
          {
            p_token_secret_ref: tokenSecretRef,
          },
        );

        assertNoRpcError(error);

        return {
          revoked: assertRpcRevokeResult(data),
        };
      } catch (error) {
        throw sanitizeSecretStoreError(error);
      }
    },
  };
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
