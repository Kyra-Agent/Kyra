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
  type TelegramWebhookSessionLookupRecord,
} from "./core.ts";
import {
  lookupTelegramWebhookSessionBySecretHeader,
  type TelegramWebhookSessionLookupRpcClient,
} from "./session-lookup.ts";
import {
  createTelegramWebhookLookupRuntimeConfig,
  createTelegramWebhookParseRuntimeConfig,
  type OptionalEnvReader,
  type TelegramWebhookLookupRuntimeConfig,
  type TelegramWebhookParseRuntimeConfig,
} from "./runtime-config.ts";
import { parseTelegramWebhookUpdate } from "./update-parser.ts";

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
  sanitizeTelegramUpdateClaimError,
  shouldProcessTelegramUpdateClaim,
} from "./idempotency.ts";
export type { TelegramUpdateClaimResult } from "./idempotency.ts";
export { planTelegramClaimedReadOnlyResponse } from "./claim-aware-response.ts";
export type { TelegramClaimedReadOnlyResponsePlan } from "./claim-aware-response.ts";
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
  createTelegramWebhookLookupRuntimeConfig,
  createTelegramWebhookParseRuntimeConfig,
  isTelegramWebhookLookupEnabled,
  isTelegramWebhookParseEnabled,
  telegramWebhookLookupEnabledEnvKey,
  telegramWebhookParseEnabledEnvKey,
} from "./runtime-config.ts";
export type {
  OptionalEnvReader,
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
  lookupTelegramWebhookSession?: (
    webhookSecretHeader: string,
  ) => Promise<TelegramWebhookSessionLookupRecord>;
}

const disabledTelegramWebhookLookupRuntimeConfig:
  TelegramWebhookLookupRuntimeConfig = { enabled: false };
const disabledTelegramWebhookParseRuntimeConfig:
  TelegramWebhookParseRuntimeConfig = { enabled: false };

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
  const lookupRuntimeConfig =
    createTelegramWebhookLookupRuntimeConfig(readOptionalEnv);
  const parseRuntimeConfig =
    createTelegramWebhookParseRuntimeConfig(readOptionalEnv);
  const dependencies: TelegramWebhookDependencies = {
    lookupRuntimeConfig,
    parseRuntimeConfig,
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
    let lookupSession: TelegramWebhookSessionLookupRecord | null = null;

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
      parseTelegramWebhookUpdate(update, {
        expectedBotUsername: lookupSession.botHandle,
      });
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
