import {
  assertBodySizeFromHeaders,
  assertJsonContentType,
  assertPostMethod,
  assertWebhookSecretHeader,
  corsHeaders,
  getUnknownErrorMessage,
  HttpError,
  jsonResponse,
  maxTelegramWebhookBodyBytes,
  readTelegramWebhookUpdateBody,
  sanitizeErrorMessage,
  sanitizeTelegramWebhookSessionLookupError,
  type TelegramWebhookChatAuthorization,
  type TelegramWebhookCommandKind,
  type TelegramWebhookSessionLookupRecord,
} from "./core.ts";
import {
  lookupTelegramWebhookSessionBySecretHeader,
  type TelegramWebhookSessionLookupRpcClient,
} from "./session-lookup.ts";
import {
  lookupTelegramChatAuthorization,
  type TelegramChatAuthorizationLookupRpcClient,
} from "./chat-authorization-lookup.ts";
import {
  claimTelegramUpdate,
  sanitizeTelegramUpdateClaimRpcError,
  type TelegramUpdateClaimResult,
  type TelegramUpdateClaimRpcClient,
} from "./idempotency.ts";
import {
  createTelegramWebhookChatAuthRuntimeConfig,
  createTelegramWebhookClaimRuntimeConfig,
  createTelegramWebhookDeliveryRuntimeConfig,
  createTelegramWebhookLookupRuntimeConfig,
  createTelegramWebhookParseRuntimeConfig,
  type OptionalEnvReader,
  type TelegramWebhookChatAuthRuntimeConfig,
  type TelegramWebhookClaimRuntimeConfig,
  type TelegramWebhookDeliveryRuntimeConfig,
  type TelegramWebhookLookupRuntimeConfig,
  type TelegramWebhookParseRuntimeConfig,
} from "./runtime-config.ts";
import {
  parseTelegramWebhookUpdate,
  type TelegramWebhookParsedCommand,
} from "./update-parser.ts";
import { planTelegramClaimedReadOnlyResponse } from "./claim-aware-response.ts";
import type { TelegramReadOnlyCommandResponse } from "./read-only-response.ts";
import { sanitizeTelegramResponseDeliveryError } from "./response-delivery.ts";

export {
  assertActiveTelegramWebhookSession,
  assertBodySizeFromHeaders,
  assertJsonContentType,
  assertPostMethod,
  assertTelegramWebhookChatAuthorized,
  assertTelegramWebhookSecretHash,
  assertTelegramWebhookSessionLookupResult,
  assertTelegramWebhookSessionLookupRows,
  assertWebhookSecretHeader,
  corsHeaders,
  getUnknownErrorMessage,
  HttpError,
  jsonResponse,
  maxTelegramWebhookBodyBytes,
  readJsonObjectBody,
  readTelegramWebhookUpdateBody,
  sanitizeErrorMessage,
  sanitizeTelegramWebhookSessionLookupError,
} from "./core.ts";
export type {
  TelegramWebhookChatAuthorization,
  TelegramWebhookChatAuthorizationPolicy,
  TelegramWebhookChatIdentity,
  TelegramWebhookCommandKind,
  TelegramWebhookCommunityChatPolicy,
  TelegramWebhookPersonalChatPolicy,
  TelegramWebhookSessionLookupRecord,
  TelegramWebhookSessionLookupRpcResult,
  TelegramWebhookSessionLookupRpcRow,
} from "./core.ts";
export { parseTelegramWebhookUpdate } from "./update-parser.ts";
export type {
  TelegramWebhookParsedCommand,
  TelegramWebhookParsedCommandName,
  TelegramWebhookUpdateParseOptions,
} from "./update-parser.ts";
export { buildTelegramReadOnlyCommandResponse } from "./read-only-response.ts";
export type { TelegramReadOnlyCommandResponse } from "./read-only-response.ts";
export { processVerifiedTelegramReadOnlyUpdate } from "./read-only-pipeline.ts";
export type {
  TelegramVerifiedReadOnlyPipelineInput,
  TelegramVerifiedReadOnlyPipelineResult,
} from "./read-only-pipeline.ts";
export {
  assertTelegramUpdateClaimResult,
  assertTelegramUpdateClaimRows,
  assertTelegramUpdateClaimRpcResult,
  claimTelegramUpdate,
  sanitizeTelegramUpdateClaimError,
  sanitizeTelegramUpdateClaimRpcError,
  shouldProcessTelegramUpdateClaim,
} from "./idempotency.ts";
export type {
  TelegramUpdateClaimResult,
  TelegramUpdateClaimRpcClient,
  TelegramUpdateClaimRpcResult,
} from "./idempotency.ts";
export { planTelegramClaimedReadOnlyResponse } from "./claim-aware-response.ts";
export type { TelegramClaimedReadOnlyResponsePlan } from "./claim-aware-response.ts";
export {
  assertTelegramDeliveryBotToken,
  assertTelegramDeliveryChatId,
  assertTelegramDeliveryResponse,
  deliverTelegramReadOnlyResponse,
  sanitizeTelegramResponseDeliveryError,
} from "./response-delivery.ts";
export type {
  TelegramResponseDeliveryFetch,
  TelegramResponseDeliveryInput,
  TelegramResponseDeliveryOptions,
  TelegramResponseDeliveryResult,
} from "./response-delivery.ts";
export {
  assertTelegramWebhookSecretHeaderValue,
  hashTelegramWebhookSecretHeader,
  lookupTelegramWebhookSessionBySecretHeader,
} from "./session-lookup.ts";
export type { TelegramWebhookSessionLookupRpcClient } from "./session-lookup.ts";
export {
  assertTelegramChatAuthorizationLookupResult,
  assertTelegramChatAuthorizationLookupRows,
  lookupTelegramChatAuthorization,
  sanitizeTelegramChatAuthorizationLookupError,
} from "./chat-authorization-lookup.ts";
export type {
  TelegramChatAuthorizationLookupRpcClient,
  TelegramChatAuthorizationLookupRpcResult,
  TelegramChatAuthorizationLookupRpcRow,
} from "./chat-authorization-lookup.ts";
export {
  createTelegramWebhookChatAuthRuntimeConfig,
  createTelegramWebhookClaimRuntimeConfig,
  createTelegramWebhookDeliveryRuntimeConfig,
  createTelegramWebhookLookupRuntimeConfig,
  createTelegramWebhookParseRuntimeConfig,
  isTelegramWebhookChatAuthEnabled,
  isTelegramWebhookClaimEnabled,
  isTelegramWebhookDeliveryEnabled,
  isTelegramWebhookLookupEnabled,
  isTelegramWebhookParseEnabled,
  telegramWebhookChatAuthEnabledEnvKey,
  telegramWebhookClaimEnabledEnvKey,
  telegramWebhookDeliveryEnabledEnvKey,
  telegramWebhookLookupEnabledEnvKey,
  telegramWebhookParseEnabledEnvKey,
} from "./runtime-config.ts";
export type {
  OptionalEnvReader,
  TelegramWebhookChatAuthRuntimeConfig,
  TelegramWebhookClaimRuntimeConfig,
  TelegramWebhookDeliveryRuntimeConfig,
  TelegramWebhookLookupRuntimeConfig,
  TelegramWebhookParseRuntimeConfig,
} from "./runtime-config.ts";

export interface TelegramWebhookRuntimeOptions {
  getOptionalEnv?: OptionalEnvReader;
  fetchRpc?: typeof fetch;
}

export interface TelegramWebhookDependencies {
  lookupRuntimeConfig?: TelegramWebhookLookupRuntimeConfig;
  parseRuntimeConfig?: TelegramWebhookParseRuntimeConfig;
  chatAuthRuntimeConfig?: TelegramWebhookChatAuthRuntimeConfig;
  claimRuntimeConfig?: TelegramWebhookClaimRuntimeConfig;
  deliveryRuntimeConfig?: TelegramWebhookDeliveryRuntimeConfig;
  lookupTelegramWebhookSession?: (
    webhookSecretHeader: string,
  ) => Promise<TelegramWebhookSessionLookupRecord>;
  lookupTelegramChatAuthorization?: (input: {
    agentId: string;
    telegramUserId: string;
    telegramChatId: string;
    commandKind: TelegramWebhookCommandKind;
  }) => Promise<TelegramWebhookChatAuthorization>;
  claimTelegramUpdate?: (input: {
    telegramSessionId: string;
    telegramUpdateId: string;
  }) => Promise<TelegramUpdateClaimResult>;
  deliverTelegramReadOnlyResponse?: (input: {
    telegramSessionId: string;
    telegramChatId: string;
    response: TelegramReadOnlyCommandResponse;
  }) => Promise<unknown>;
}

const disabledTelegramWebhookLookupRuntimeConfig:
  TelegramWebhookLookupRuntimeConfig = { enabled: false };
const disabledTelegramWebhookParseRuntimeConfig:
  TelegramWebhookParseRuntimeConfig = { enabled: false };
const disabledTelegramWebhookChatAuthRuntimeConfig:
  TelegramWebhookChatAuthRuntimeConfig = { enabled: false };
const disabledTelegramWebhookClaimRuntimeConfig:
  TelegramWebhookClaimRuntimeConfig = { enabled: false };
const disabledTelegramWebhookDeliveryRuntimeConfig:
  TelegramWebhookDeliveryRuntimeConfig = { enabled: false };

export function getEnv(key: string) {
  const value = Deno.env.get(key);

  if (!value) {
    throw new HttpError(
      500,
      "missing_env",
      `Missing required Edge Function secret: ${key}.`,
    );
  }

  return value;
}

export function getOptionalEnv(key: string) {
  return Deno.env.get(key) ?? "";
}

export function createTelegramWebhookSessionLookupRpcClient(
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchRpc: typeof fetch = fetch,
): TelegramWebhookSessionLookupRpcClient {
  const rpcBaseUrl = supabaseUrl.replace(/\/+$/, "");

  return {
    async rpc(functionName, args) {
      const response = await fetchRpc(
        `${rpcBaseUrl}/rest/v1/rpc/${functionName}`,
        {
          method: "POST",
          headers: {
            apikey: serviceRoleKey,
            authorization: `Bearer ${serviceRoleKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify(args),
        },
      );

      let payload: unknown = null;

      try {
        payload = await response.json();
      } catch {
        payload = null;
      }

      if (!response.ok) {
        return {
          data: null,
          error: payload ?? {
            message: "Telegram webhook session lookup failed.",
          },
        };
      }

      return { data: payload, error: null };
    },
  };
}

export function createTelegramWebhookDependencies(
  options: TelegramWebhookRuntimeOptions = {},
): TelegramWebhookDependencies {
  const readOptionalEnv = options.getOptionalEnv ?? getOptionalEnv;
  const lookupRuntimeConfig = createTelegramWebhookLookupRuntimeConfig(
    readOptionalEnv,
  );
  const parseRuntimeConfig = createTelegramWebhookParseRuntimeConfig(
    readOptionalEnv,
  );
  const chatAuthRuntimeConfig = createTelegramWebhookChatAuthRuntimeConfig(
    readOptionalEnv,
  );
  const claimRuntimeConfig = createTelegramWebhookClaimRuntimeConfig(
    readOptionalEnv,
  );
  const deliveryRuntimeConfig = createTelegramWebhookDeliveryRuntimeConfig(
    readOptionalEnv,
  );
  const dependencies: TelegramWebhookDependencies = {
    lookupRuntimeConfig,
    parseRuntimeConfig,
    chatAuthRuntimeConfig,
    claimRuntimeConfig,
    deliveryRuntimeConfig,
  };

  if (!lookupRuntimeConfig.enabled) {
    return dependencies;
  }

  const fetchRpc = options.fetchRpc ?? fetch;
  let rpcClient: TelegramWebhookSessionLookupRpcClient | null = null;
  const getRpcClient = () => {
    if (!rpcClient) {
      const supabaseUrl = getEnv("SUPABASE_URL");
      const serviceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
      rpcClient = createTelegramWebhookSessionLookupRpcClient(
        supabaseUrl,
        serviceRoleKey,
        fetchRpc,
      );
    }

    return rpcClient;
  };

  dependencies.lookupTelegramWebhookSession = async (webhookSecretHeader) => {
    return await lookupTelegramWebhookSessionBySecretHeader({
      webhookSecretHeader,
      rpcClient: getRpcClient(),
    });
  };

  if (chatAuthRuntimeConfig.enabled) {
    dependencies.lookupTelegramChatAuthorization = async (input) => {
      return await lookupTelegramChatAuthorization({
        ...input,
        rpcClient:
          getRpcClient() as unknown as TelegramChatAuthorizationLookupRpcClient,
      });
    };
  }

  if (claimRuntimeConfig.enabled) {
    dependencies.claimTelegramUpdate = async (input) => {
      return await claimTelegramUpdate({
        ...input,
        rpcClient: getRpcClient() as unknown as TelegramUpdateClaimRpcClient,
      });
    };
  }

  return dependencies;
}

export async function handleTelegramWebhookRequest(
  request: Request,
  dependencies: TelegramWebhookDependencies = {},
) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    assertPostMethod(request, "telegram-webhook");

    const webhookSecretHeader = assertWebhookSecretHeader(request);
    assertJsonContentType(request.headers);
    assertBodySizeFromHeaders(request.headers, maxTelegramWebhookBodyBytes);

    const lookupRuntimeConfig = dependencies.lookupRuntimeConfig ??
      disabledTelegramWebhookLookupRuntimeConfig;
    const parseRuntimeConfig = dependencies.parseRuntimeConfig ??
      disabledTelegramWebhookParseRuntimeConfig;
    const chatAuthRuntimeConfig = dependencies.chatAuthRuntimeConfig ??
      disabledTelegramWebhookChatAuthRuntimeConfig;
    const claimRuntimeConfig = dependencies.claimRuntimeConfig ??
      disabledTelegramWebhookClaimRuntimeConfig;
    const deliveryRuntimeConfig = dependencies.deliveryRuntimeConfig ??
      disabledTelegramWebhookDeliveryRuntimeConfig;
    let lookupSession: TelegramWebhookSessionLookupRecord | null = null;
    let parsedUpdate: TelegramWebhookParsedCommand | null = null;
    let chatAuthorization: TelegramWebhookChatAuthorization | null = null;
    let claimResult: TelegramUpdateClaimResult | null = null;

    if (lookupRuntimeConfig.enabled) {
      if (!dependencies.lookupTelegramWebhookSession) {
        throw new HttpError(
          500,
          "server_error",
          "Telegram webhook session lookup is not configured.",
        );
      }

      lookupSession = await dependencies.lookupTelegramWebhookSession(
        webhookSecretHeader,
      );
    }

    if (parseRuntimeConfig.enabled) {
      if (!lookupSession) {
        throw new HttpError(
          500,
          "server_error",
          "Telegram webhook parsing requires session lookup.",
        );
      }

      const update = await readTelegramWebhookUpdateBody(request);
      parsedUpdate = parseTelegramWebhookUpdate(update, {
        expectedBotUsername: lookupSession.botHandle,
      });
    }

    if (chatAuthRuntimeConfig.enabled) {
      if (!lookupSession || !parsedUpdate) {
        throw new HttpError(
          500,
          "server_error",
          "Telegram chat authorization requires parsed update.",
        );
      }

      if (!dependencies.lookupTelegramChatAuthorization) {
        throw new HttpError(
          500,
          "server_error",
          "Telegram chat authorization is not configured.",
        );
      }

      chatAuthorization = await dependencies.lookupTelegramChatAuthorization({
        agentId: lookupSession.agentId,
        telegramUserId: parsedUpdate.telegramUserId,
        telegramChatId: parsedUpdate.telegramChatId,
        commandKind: parsedUpdate.commandKind,
      });
    }

    if (claimRuntimeConfig.enabled) {
      if (!lookupSession || !parsedUpdate || !chatAuthorization) {
        throw new HttpError(
          500,
          "server_error",
          "Telegram update claim requires authorized parsed update.",
        );
      }

      if (!dependencies.claimTelegramUpdate) {
        throw new HttpError(
          500,
          "server_error",
          "Telegram update claim is not configured.",
        );
      }

      try {
        claimResult = await dependencies.claimTelegramUpdate({
          telegramSessionId: lookupSession.sessionId,
          telegramUpdateId: parsedUpdate.updateId,
        });
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }

        throw sanitizeTelegramUpdateClaimRpcError(error);
      }
    }

    if (deliveryRuntimeConfig.enabled) {
      if (!lookupSession || !parsedUpdate || !claimResult) {
        throw new HttpError(
          500,
          "server_error",
          "Telegram response delivery requires a claimed update.",
        );
      }

      const deliveryPlan = planTelegramClaimedReadOnlyResponse(
        claimResult,
        parsedUpdate.command,
      );

      if (!deliveryPlan.shouldDeliver) {
        return jsonResponse(
          {
            ok: true,
            status: "duplicate",
            message: "Telegram update was already processed.",
          },
          200,
        );
      }

      if (!dependencies.deliverTelegramReadOnlyResponse) {
        throw new HttpError(
          500,
          "server_error",
          "Telegram response delivery is not configured.",
        );
      }

      try {
        await dependencies.deliverTelegramReadOnlyResponse({
          telegramSessionId: lookupSession.sessionId,
          telegramChatId: parsedUpdate.telegramChatId,
          response: deliveryPlan.response,
        });
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }

        throw sanitizeTelegramResponseDeliveryError(error);
      }

      return jsonResponse(
        {
          ok: true,
          status: "delivered",
          message: "Telegram response delivered.",
        },
        200,
      );
    }

    return jsonResponse(
      {
        ok: false,
        status: "not_configured",
        message: "Telegram webhook is planned but not enabled yet.",
      },
      501,
    );
  } catch (error) {
    if (error instanceof HttpError) {
      return jsonResponse(
        {
          ok: false,
          status: error.code,
          message: error.message,
        },
        error.statusCode,
      );
    }

    return jsonResponse(
      {
        ok: false,
        status: "server_error",
        message: sanitizeErrorMessage(getUnknownErrorMessage(error)),
      },
      500,
    );
  }
}

if (import.meta.main) {
  const dependencies = createTelegramWebhookDependencies();

  Deno.serve((request) => handleTelegramWebhookRequest(request, dependencies));
}
