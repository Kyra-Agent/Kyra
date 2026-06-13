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
  createTelegramWebhookAgentBrainProviderRuntimeConfig,
  createTelegramWebhookAgentBrainRuntimeConfig,
  createTelegramWebhookChatAuthRuntimeConfig,
  createTelegramWebhookClaimRuntimeConfig,
  createTelegramWebhookDeliveryRuntimeConfig,
  createTelegramWebhookLookupRuntimeConfig,
  createTelegramWebhookOwnerLinkConsumeRuntimeConfig,
  createTelegramWebhookParseRuntimeConfig,
  createTelegramWebhookTemplateContextRuntimeConfig,
  type OptionalEnvReader,
  type TelegramWebhookAgentBrainProviderRuntimeConfig,
  type TelegramWebhookAgentBrainRuntimeConfig,
  type TelegramWebhookChatAuthRuntimeConfig,
  type TelegramWebhookClaimRuntimeConfig,
  type TelegramWebhookDeliveryRuntimeConfig,
  type TelegramWebhookLookupRuntimeConfig,
  type TelegramWebhookOwnerLinkConsumeRuntimeConfig,
  type TelegramWebhookParseRuntimeConfig,
  type TelegramWebhookTemplateContextRuntimeConfig,
} from "./runtime-config.ts";
import {
  generateTelegramAgentBrainReply
    as generateTelegramAgentBrainReplyWithProvider,
  type TelegramAgentBrainPromptInput,
  type TelegramAgentBrainProvider,
  type TelegramAgentBrainReply,
} from "./agent-brain.ts";
import {
  createOpenAiCompatibleTelegramAgentBrainProvider,
  type TelegramAgentBrainProviderFetch,
} from "./agent-brain-provider.ts";
import {
  parseTelegramWebhookUpdate,
  type TelegramWebhookParsedCommand,
} from "./update-parser.ts";
import { planTelegramClaimedReadOnlyResponse } from "./claim-aware-response.ts";
import {
  classifyTelegramReadOnlyChatIntent,
  type TelegramReadOnlyCommandResponse,
} from "./read-only-response.ts";
import {
  deliverTelegramReadOnlyResponse as deliverTelegramReadOnlyResponseToApi,
  sanitizeTelegramResponseDeliveryError,
  type TelegramResponseDeliveryFetch,
} from "./response-delivery.ts";
import {
  resolveTelegramDeliveryBotToken,
  type TelegramDeliveryTokenResolverRpcClient,
} from "./token-resolver.ts";
import {
  consumeTelegramOwnerLinkChallenge,
  type TelegramOwnerLinkConsumeResult,
  type TelegramOwnerLinkConsumeRpcClient,
} from "./owner-link-consume.ts";
import { dispatchVerifiedTelegramWebhookUpdate } from "./owner-link-dispatch.ts";
import {
  lookupTelegramTemplateContext,
  type TelegramTemplateContextLookupClient,
  type TelegramTemplateContextLookupOutput,
} from "./template-context-lookup.ts";

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
export {
  buildTelegramReadOnlyCommandResponse,
  classifyTelegramReadOnlyChatIntent,
} from "./read-only-response.ts";
export type {
  TelegramReadOnlyChatIntent,
  TelegramReadOnlyCommandResponse,
} from "./read-only-response.ts";
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
  assertTelegramAgentBrainCommand,
  assertTelegramAgentBrainReply,
  buildTelegramAgentBrainRequest,
  generateTelegramAgentBrainReply,
  sanitizeTelegramAgentBrainProviderError,
} from "./agent-brain.ts";
export type {
  TelegramAgentBrainMessage,
  TelegramAgentBrainPromptInput,
  TelegramAgentBrainProvider,
  TelegramAgentBrainReply,
  TelegramAgentBrainRequest,
} from "./agent-brain.ts";
export {
  buildOpenAiCompatibleAgentBrainPayload,
  createOpenAiCompatibleTelegramAgentBrainProvider,
} from "./agent-brain-provider.ts";
export type {
  OpenAiCompatibleTelegramAgentBrainProviderOptions,
  TelegramAgentBrainProviderFetch,
} from "./agent-brain-provider.ts";
export {
  buildTelegramTemplateContext,
  buildTelegramTemplateContextReply,
  classifyTemplateAction,
} from "./template-context.ts";
export type {
  TelegramTemplateActionAvailability,
  TelegramTemplateActionContext,
  TelegramTemplateContext,
  TelegramTemplateContextSource,
  TelegramTemplateModuleContext,
} from "./template-context.ts";
export {
  lookupTelegramTemplateContext,
  sanitizeTelegramTemplateContextLookupError,
} from "./template-context-lookup.ts";
export type {
  TelegramTemplateContextLookupBuilder,
  TelegramTemplateContextLookupClient,
  TelegramTemplateContextLookupOutput,
  TelegramTemplateContextLookupResult,
} from "./template-context-lookup.ts";
export {
  assertResolvedTelegramDeliveryBotToken,
  assertTelegramDeliveryTokenResolverRpcResult,
  resolveTelegramDeliveryBotToken,
  sanitizeTelegramDeliveryTokenResolverError,
  sanitizeTelegramDeliveryTokenResolverRpcError,
} from "./token-resolver.ts";
export type {
  TelegramDeliveryTokenResolverResult,
  TelegramDeliveryTokenResolverRpcClient,
  TelegramDeliveryTokenResolverRpcResult,
} from "./token-resolver.ts";
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
  createTelegramWebhookAgentBrainProviderRuntimeConfig,
  createTelegramWebhookAgentBrainRuntimeConfig,
  createTelegramWebhookChatAuthRuntimeConfig,
  createTelegramWebhookClaimRuntimeConfig,
  createTelegramWebhookDeliveryRuntimeConfig,
  createTelegramWebhookLookupRuntimeConfig,
  createTelegramWebhookOwnerLinkConsumeRuntimeConfig,
  createTelegramWebhookParseRuntimeConfig,
  createTelegramWebhookTemplateContextRuntimeConfig,
  isTelegramWebhookAgentBrainEnabled,
  isTelegramWebhookAgentBrainProviderEnabled,
  isTelegramWebhookChatAuthEnabled,
  isTelegramWebhookClaimEnabled,
  isTelegramWebhookDeliveryEnabled,
  isTelegramWebhookLookupEnabled,
  isTelegramWebhookOwnerLinkConsumeEnabled,
  isTelegramWebhookParseEnabled,
  isTelegramWebhookTemplateContextEnabled,
  telegramWebhookAgentBrainEnabledEnvKey,
  telegramWebhookAgentBrainProviderEnabledEnvKey,
  telegramWebhookChatAuthEnabledEnvKey,
  telegramWebhookClaimEnabledEnvKey,
  telegramWebhookDeliveryEnabledEnvKey,
  telegramWebhookLookupEnabledEnvKey,
  telegramWebhookOwnerLinkConsumeEnabledEnvKey,
  telegramWebhookParseEnabledEnvKey,
  telegramWebhookTemplateContextEnabledEnvKey,
} from "./runtime-config.ts";
export type {
  OptionalEnvReader,
  TelegramWebhookAgentBrainProviderRuntimeConfig,
  TelegramWebhookAgentBrainRuntimeConfig,
  TelegramWebhookChatAuthRuntimeConfig,
  TelegramWebhookClaimRuntimeConfig,
  TelegramWebhookDeliveryRuntimeConfig,
  TelegramWebhookLookupRuntimeConfig,
  TelegramWebhookOwnerLinkConsumeRuntimeConfig,
  TelegramWebhookParseRuntimeConfig,
  TelegramWebhookTemplateContextRuntimeConfig,
} from "./runtime-config.ts";

export interface TelegramWebhookRuntimeOptions {
  getEnv?: (key: string) => string;
  getOptionalEnv?: OptionalEnvReader;
  fetchRpc?: typeof fetch;
  fetchTelegram?: TelegramResponseDeliveryFetch;
  fetchAgentBrain?: TelegramAgentBrainProviderFetch;
  telegramDeliveryTimeoutMs?: number;
  telegramAgentBrainTimeoutMs?: number;
}

export interface TelegramWebhookDependencies {
  lookupRuntimeConfig?: TelegramWebhookLookupRuntimeConfig;
  parseRuntimeConfig?: TelegramWebhookParseRuntimeConfig;
  chatAuthRuntimeConfig?: TelegramWebhookChatAuthRuntimeConfig;
  claimRuntimeConfig?: TelegramWebhookClaimRuntimeConfig;
  deliveryRuntimeConfig?: TelegramWebhookDeliveryRuntimeConfig;
  ownerLinkConsumeRuntimeConfig?: TelegramWebhookOwnerLinkConsumeRuntimeConfig;
  templateContextRuntimeConfig?: TelegramWebhookTemplateContextRuntimeConfig;
  agentBrainRuntimeConfig?: TelegramWebhookAgentBrainRuntimeConfig;
  agentBrainProviderRuntimeConfig?:
    TelegramWebhookAgentBrainProviderRuntimeConfig;
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
  consumeTelegramOwnerLinkChallenge?: (input: {
    telegramSessionId: string;
    telegramUpdateId: string;
    telegramUserId: string;
    telegramChatId: string;
    challengeHash: string;
  }) => Promise<TelegramOwnerLinkConsumeResult>;
  lookupTelegramTemplateContext?: (
    agentId: string,
    command: "agent" | "actions" | "modules",
  ) => Promise<TelegramTemplateContextLookupOutput>;
  generateTelegramAgentBrainReply?: (
    input: TelegramAgentBrainPromptInput,
  ) => Promise<TelegramAgentBrainReply>;
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
const disabledTelegramWebhookOwnerLinkConsumeRuntimeConfig:
  TelegramWebhookOwnerLinkConsumeRuntimeConfig = { enabled: false };
const disabledTelegramWebhookTemplateContextRuntimeConfig:
  TelegramWebhookTemplateContextRuntimeConfig = { enabled: false };
const disabledTelegramWebhookAgentBrainRuntimeConfig:
  TelegramWebhookAgentBrainRuntimeConfig = { enabled: false };

const telegramAgentBrainApiKeyEnvKey = "KYRA_TELEGRAM_AGENT_BRAIN_API_KEY";
const telegramAgentBrainModelEnvKey = "KYRA_TELEGRAM_AGENT_BRAIN_MODEL";
const telegramAgentBrainEndpointEnvKey = "KYRA_TELEGRAM_AGENT_BRAIN_ENDPOINT";

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

export function createTelegramWebhookRestLookupClient(
  supabaseUrl: string,
  serviceRoleKey: string,
  fetchRpc: typeof fetch = fetch,
): TelegramTemplateContextLookupClient {
  const restBaseUrl = `${supabaseUrl.replace(/\/+$/, "")}/rest/v1`;

  return {
    from(table) {
      let selectedColumns = "";
      const filters: Array<{ column: string; value: string }> = [];

      return {
        select(columns) {
          selectedColumns = columns;
          return this;
        },
        eq(column, value) {
          filters.push({ column, value });
          return this;
        },
        async limit<T>(count: number) {
          const url = new URL(`${restBaseUrl}/${table}`);

          url.searchParams.set("select", selectedColumns);
          url.searchParams.set("limit", String(count));

          for (const filter of filters) {
            url.searchParams.set(filter.column, `eq.${filter.value}`);
          }

          const response = await fetchRpc(url.toString(), {
            method: "GET",
            headers: {
              apikey: serviceRoleKey,
              authorization: `Bearer ${serviceRoleKey}`,
            },
          });
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
                message: "Telegram template context lookup failed.",
              },
            };
          }

          return { data: payload as T[], error: null };
        },
      };
    },
  };
}

export function createTelegramWebhookDependencies(
  options: TelegramWebhookRuntimeOptions = {},
): TelegramWebhookDependencies {
  const readRequiredEnv = options.getEnv ?? getEnv;
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
  const ownerLinkConsumeRuntimeConfig =
    createTelegramWebhookOwnerLinkConsumeRuntimeConfig(readOptionalEnv);
  const templateContextRuntimeConfig =
    createTelegramWebhookTemplateContextRuntimeConfig(readOptionalEnv);
  const agentBrainRuntimeConfig = createTelegramWebhookAgentBrainRuntimeConfig(
    readOptionalEnv,
  );
  const agentBrainProviderRuntimeConfig =
    createTelegramWebhookAgentBrainProviderRuntimeConfig(readOptionalEnv);
  const dependencies: TelegramWebhookDependencies = {
    lookupRuntimeConfig,
    parseRuntimeConfig,
    chatAuthRuntimeConfig,
    claimRuntimeConfig,
    deliveryRuntimeConfig,
    ownerLinkConsumeRuntimeConfig,
    templateContextRuntimeConfig,
    agentBrainRuntimeConfig,
    agentBrainProviderRuntimeConfig,
  };

  if (!lookupRuntimeConfig.enabled) {
    return dependencies;
  }

  const fetchRpc = options.fetchRpc ?? fetch;
  let rpcClient: TelegramWebhookSessionLookupRpcClient | null = null;
  let restClient: TelegramTemplateContextLookupClient | null = null;
  let agentBrainProvider: TelegramAgentBrainProvider | null = null;
  const getRpcClient = () => {
    if (!rpcClient) {
      const supabaseUrl = readRequiredEnv("SUPABASE_URL");
      const serviceRoleKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
      rpcClient = createTelegramWebhookSessionLookupRpcClient(
        supabaseUrl,
        serviceRoleKey,
        fetchRpc,
      );
    }

    return rpcClient;
  };
  const getRestClient = () => {
    if (!restClient) {
      const supabaseUrl = readRequiredEnv("SUPABASE_URL");
      const serviceRoleKey = readRequiredEnv("SUPABASE_SERVICE_ROLE_KEY");
      restClient = createTelegramWebhookRestLookupClient(
        supabaseUrl,
        serviceRoleKey,
        fetchRpc,
      );
    }

    return restClient;
  };
  const getAgentBrainProvider = () => {
    if (!agentBrainProvider) {
      agentBrainProvider = createOpenAiCompatibleTelegramAgentBrainProvider({
        apiKey: readRequiredEnv(telegramAgentBrainApiKeyEnvKey),
        model: readRequiredEnv(telegramAgentBrainModelEnvKey),
        endpoint: readOptionalEnv(telegramAgentBrainEndpointEnvKey),
        fetch: options.fetchAgentBrain,
        timeoutMs: options.telegramAgentBrainTimeoutMs,
      });
    }

    return agentBrainProvider;
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

  if (deliveryRuntimeConfig.enabled) {
    dependencies.deliverTelegramReadOnlyResponse = async (input) => {
      const { botToken } = await resolveTelegramDeliveryBotToken({
        telegramSessionId: input.telegramSessionId,
        rpcClient:
          getRpcClient() as unknown as TelegramDeliveryTokenResolverRpcClient,
      });

      return await deliverTelegramReadOnlyResponseToApi(
        {
          botToken,
          telegramChatId: input.telegramChatId,
          response: input.response,
        },
        {
          fetch: options.fetchTelegram,
          timeoutMs: options.telegramDeliveryTimeoutMs,
        },
      );
    };
  }

  if (ownerLinkConsumeRuntimeConfig.enabled) {
    dependencies.consumeTelegramOwnerLinkChallenge = async (input) => {
      return await consumeTelegramOwnerLinkChallenge({
        ...input,
        rpcClient:
          getRpcClient() as unknown as TelegramOwnerLinkConsumeRpcClient,
      });
    };
  }

  if (templateContextRuntimeConfig.enabled) {
    dependencies.lookupTelegramTemplateContext = async (agentId, command) => {
      return await lookupTelegramTemplateContext({
        agentId,
        command,
        serviceClient: getRestClient(),
      });
    };
  }

  if (
    agentBrainRuntimeConfig.enabled &&
    agentBrainProviderRuntimeConfig.enabled
  ) {
    dependencies.generateTelegramAgentBrainReply = async (input) => {
      return await generateTelegramAgentBrainReplyWithProvider(
        input,
        getAgentBrainProvider(),
      );
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
    const ownerLinkConsumeRuntimeConfig =
      dependencies.ownerLinkConsumeRuntimeConfig ??
        disabledTelegramWebhookOwnerLinkConsumeRuntimeConfig;
    const templateContextRuntimeConfig =
      dependencies.templateContextRuntimeConfig ??
        disabledTelegramWebhookTemplateContextRuntimeConfig;
    const agentBrainRuntimeConfig = dependencies.agentBrainRuntimeConfig ??
      disabledTelegramWebhookAgentBrainRuntimeConfig;
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

    if (ownerLinkConsumeRuntimeConfig.enabled) {
      if (!lookupSession) {
        throw new HttpError(
          500,
          "server_error",
          "Telegram owner-link consume requires session lookup.",
        );
      }

      const update = await readTelegramWebhookUpdateBody(request);

      const dispatchResult = await dispatchVerifiedTelegramWebhookUpdate(
        {
          update,
          telegramSessionId: lookupSession.sessionId,
          expectedBotUsername: lookupSession.botHandle,
          ownerLinkConsumeEnabled: true,
        },
        {
          consumeOwnerLinkChallenge:
            dependencies.consumeTelegramOwnerLinkChallenge,
        },
      );

      if (dispatchResult.route === "owner_link") {
        return jsonResponse(
          {
            ok: dispatchResult.ok,
            status: dispatchResult.status,
            message: dispatchResult.message,
          },
          200,
        );
      }

      if (parseRuntimeConfig.enabled) {
        parsedUpdate = dispatchResult.parsedUpdate;
      }
    } else if (parseRuntimeConfig.enabled) {
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
        parsedUpdate.text,
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

      let response = deliveryPlan.response;
      let templateContext: TelegramTemplateContextLookupOutput | null = null;

      if (
        templateContextRuntimeConfig.enabled &&
        shouldUseTelegramTemplateContext(parsedUpdate.command)
      ) {
        if (!dependencies.lookupTelegramTemplateContext) {
          throw new HttpError(
            500,
            "server_error",
            "Telegram template context lookup is not configured.",
          );
        }

        templateContext = await dependencies.lookupTelegramTemplateContext(
          lookupSession.agentId,
          getTelegramTemplateContextCommand(parsedUpdate.command),
        );
        if (parsedUpdate.command !== "chat") {
          response = {
            command: parsedUpdate.command,
            text: templateContext.text,
          };
        }
      }

      if (
        agentBrainRuntimeConfig.enabled &&
        dependencies.generateTelegramAgentBrainReply &&
        shouldUseTelegramAgentBrain(parsedUpdate.command)
      ) {
        try {
          const agentBrainReply = await dependencies
            .generateTelegramAgentBrainReply({
              command: parsedUpdate.command,
              agentName: templateContext?.context.name,
              agentRole: templateContext?.context.role,
              agentSummary: templateContext?.context.summary,
              capabilities: templateContext?.context.readOnlyActions,
              gatedActions: templateContext?.context.gatedActions,
              modules: templateContext?.context.modules,
              safetyNote: templateContext?.context.safetyNote,
              userRequest: parsedUpdate.text,
              chatIntent: classifyTelegramReadOnlyChatIntent(parsedUpdate.text),
            });
          response = {
            command: parsedUpdate.command,
            text: agentBrainReply.text,
          };
        } catch {
          // Agent-brain is optional. Preserve read-only delivery if the provider
          // times out, rejects output, or returns a malformed response.
        }
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
          response,
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

function shouldUseTelegramTemplateContext(
  command: TelegramWebhookParsedCommand["command"],
) {
  return command === "agent" || command === "actions" ||
    command === "modules" ||
    command === "chat";
}

function shouldUseTelegramAgentBrain(
  command: TelegramWebhookParsedCommand["command"],
) {
  return command === "agent" || command === "actions" ||
    command === "modules" ||
    command === "chat";
}

function getTelegramTemplateContextCommand(
  command: TelegramWebhookParsedCommand["command"],
): "agent" | "actions" | "modules" {
  return command === "actions" || command === "modules" ? command : "agent";
}

if (import.meta.main) {
  const dependencies = createTelegramWebhookDependencies();

  Deno.serve((request) => handleTelegramWebhookRequest(request, dependencies));
}
