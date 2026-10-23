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
  markTelegramUpdateDelivered,
  sanitizeTelegramUpdateClaimRpcError,
  sanitizeTelegramUpdateDeliveryMarkRpcError,
  type TelegramUpdateClaimResult,
  type TelegramUpdateClaimRpcClient,
  type TelegramUpdateDeliveryMarkResult,
  type TelegramUpdateDeliveryMarkRpcClient,
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
  appendTelegramChatMemory,
  forgetTelegramChatMemory,
  loadTelegramChatMemory,
  type TelegramChatMemoryRpcClient,
  type TelegramChatMemoryTurn,
} from "./chat-memory.ts";
import {
  consumeTelegramCommunityQuota,
  isTelegramCommunityChatEnabled,
  setTelegramCommunityChat,
  type TelegramCommunityQuotaResult,
  type TelegramCommunityRpcClient,
  type TelegramCommunitySetResult,
} from "./community.ts";
import {
  defaultMiniAppUrl,
  handleTradingCommand,
  isTradingCommand,
  type MiniAppButton,
  type TradingCommand,
  type TradingCommandReply,
  type TradingRpcClient,
  tradingTexts,
} from "./trading-commands.ts";
import {
  consumeTelegramOwnerBrainQuota,
  ownerQuotaTexts,
  type TelegramOwnerBrainQuotaResult,
  type TelegramOwnerQuotaRpcClient,
} from "./owner-quota.ts";
import {
  handleMonitoringCommand,
  isMonitoringCommand,
  type MonitoringCommand,
  type MonitoringRpcClient,
  monitoringTexts,
} from "./monitoring-commands.ts";
import {
  type ChainDataTargets,
  createBatchRpc,
  extractChainDataTargets,
  hasChainDataTargets,
  readChainDataRpcConfig,
  readLiveChainData,
  robinhoodLogsRpcUrl,
} from "./chain-data.ts";
import { readTokenPricesUsd, wethAddress } from "./prices.ts";
import {
  createOpenAiCompatibleTelegramAgentBrainProvider,
  type TelegramAgentBrainProviderFetch,
} from "./agent-brain-provider.ts";
import {
  parseTelegramWebhookUpdate,
  type TelegramWebhookParsedCommand,
} from "./update-parser.ts";
import { planTelegramClaimedReadOnlyResponse } from "./claim-aware-response.ts";
import { reviewTelegramExecutionGate } from "./execution-gate.ts";
import { logSafeEvent } from "../_shared/safe-log.ts";
import {
  buildTelegramOwnerLinkReply,
  buildTelegramTemplateHelpText,
  classifyTelegramReadOnlyChatIntent,
  communityTexts,
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
import { buildTelegramTemplateChatFallback } from "./template-context.ts";
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
  assertTelegramUpdateDeliveryMarkResult,
  assertTelegramUpdateDeliveryMarkRpcResult,
  claimTelegramUpdate,
  markTelegramUpdateDelivered,
  sanitizeTelegramUpdateClaimError,
  sanitizeTelegramUpdateClaimRpcError,
  sanitizeTelegramUpdateDeliveryMarkError,
  sanitizeTelegramUpdateDeliveryMarkRpcError,
  shouldProcessTelegramUpdateClaim,
} from "./idempotency.ts";
export type {
  TelegramUpdateClaimResult,
  TelegramUpdateClaimRpcClient,
  TelegramUpdateClaimRpcResult,
  TelegramUpdateDeliveryMarkResult,
  TelegramUpdateDeliveryMarkRpcClient,
  TelegramUpdateDeliveryMarkRpcResult,
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
  fetchChainData?: typeof fetch;
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
  markTelegramUpdateDelivered?: (input: {
    telegramSessionId: string;
    telegramUpdateId: string;
  }) => Promise<TelegramUpdateDeliveryMarkResult>;
  deliverTelegramReadOnlyResponse?: (input: {
    telegramSessionId: string;
    telegramChatId: string;
    response: TelegramReadOnlyCommandResponse;
    replyToMessageId?: string;
    miniAppButton?: MiniAppButton;
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
  loadTelegramChatMemory?: (input: {
    telegramSessionId: string;
    telegramChatId: string;
  }) => Promise<TelegramChatMemoryTurn[]>;
  appendTelegramChatMemory?: (input: {
    telegramSessionId: string;
    telegramChatId: string;
    userText: string;
    assistantText: string;
  }) => Promise<void>;
  forgetTelegramChatMemory?: (input: {
    telegramSessionId: string;
    telegramChatId: string;
  }) => Promise<number>;
  readLiveChainData?: (targets: ChainDataTargets) => Promise<string>;
  setTelegramCommunityChat?: (input: {
    agentId: string;
    telegramUserId: string;
    telegramChatId: string;
    chatTitle: string;
    enabled: boolean;
  }) => Promise<TelegramCommunitySetResult>;
  isTelegramCommunityChatEnabled?: (input: {
    agentId: string;
    telegramChatId: string;
  }) => Promise<boolean>;
  consumeTelegramCommunityQuota?: (input: {
    agentId: string;
    telegramChatId: string;
    telegramUserId: string;
  }) => Promise<TelegramCommunityQuotaResult>;
  consumeTelegramOwnerBrainQuota?: (input: {
    agentId: string;
  }) => Promise<TelegramOwnerBrainQuotaResult>;
  runMonitoringCommand?: (input: {
    command: MonitoringCommand;
    args: string;
    agentId: string;
  }) => Promise<string>;
  runTradingCommand?: (input: {
    command: TradingCommand;
    args: string;
    agentId: string;
  }) => Promise<TradingCommandReply>;
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
// Short-term chat memory follows the agent brain; set this to "false" to turn
// it off without disabling the brain.
const telegramChatMemoryEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_CHAT_MEMORY_ENABLED";
// Live Robinhood Chain reads use the same reviewed RPC secret as receipt
// verification; set this to "false" to turn them off.
const telegramChainDataEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_CHAIN_DATA_ENABLED";
const telegramCommunityEnabledEnvKey =
  "KYRA_TELEGRAM_WEBHOOK_COMMUNITY_ENABLED";
const telegramAgentBrainModelEnvKey = "KYRA_TELEGRAM_AGENT_BRAIN_MODEL";
const telegramAgentBrainEndpointEnvKey = "KYRA_TELEGRAM_AGENT_BRAIN_ENDPOINT";
const telegramAgentBrainTimeoutMsEnvKey =
  "KYRA_TELEGRAM_AGENT_BRAIN_TIMEOUT_MS";

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
        timeoutMs: options.telegramAgentBrainTimeoutMs ??
          Number(readOptionalEnv(telegramAgentBrainTimeoutMsEnvKey)),
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

    // Community mode (groups) can be switched off without touching owner chat.
    if (
      readOptionalEnv(telegramCommunityEnabledEnvKey)?.trim().toLowerCase() !==
        "false"
    ) {
      const getCommunityRpcClient = () =>
        getRpcClient() as unknown as TelegramCommunityRpcClient;

      dependencies.setTelegramCommunityChat = async (input) => {
        return await setTelegramCommunityChat({
          ...input,
          rpcClient: getCommunityRpcClient(),
        });
      };
      dependencies.isTelegramCommunityChatEnabled = async (input) => {
        return await isTelegramCommunityChatEnabled({
          ...input,
          rpcClient: getCommunityRpcClient(),
        });
      };
      dependencies.consumeTelegramCommunityQuota = async (input) => {
        return await consumeTelegramCommunityQuota({
          ...input,
          rpcClient: getCommunityRpcClient(),
        });
      };
    }
  }

  if (claimRuntimeConfig.enabled) {
    dependencies.claimTelegramUpdate = async (input) => {
      return await claimTelegramUpdate({
        ...input,
        rpcClient: getRpcClient() as unknown as TelegramUpdateClaimRpcClient,
      });
    };

    dependencies.markTelegramUpdateDelivered = async (input) => {
      return await markTelegramUpdateDelivered({
        ...input,
        rpcClient:
          getRpcClient() as unknown as TelegramUpdateDeliveryMarkRpcClient,
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
          replyToMessageId: input.replyToMessageId,
          miniAppButton: input.miniAppButton,
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

  const chainDataRpcConfig =
    readOptionalEnv(telegramChainDataEnabledEnvKey)?.trim().toLowerCase() !==
        "false"
      ? readChainDataRpcConfig(readOptionalEnv)
      : null;

  if (chatAuthRuntimeConfig.enabled) {
    dependencies.runMonitoringCommand = async (input) => {
      return await handleMonitoringCommand({
        ...input,
        rpcClient: getRpcClient() as unknown as MonitoringRpcClient,
        chainRpcUrl: chainDataRpcConfig?.rpcUrl ?? null,
        fetchImpl: options.fetchChainData,
      });
    };
    dependencies.runTradingCommand = async (input) => {
      return await handleTradingCommand({
        ...input,
        rpcClient: getRpcClient() as unknown as TradingRpcClient,
        miniAppUrl: readOptionalEnv("KYRA_MINIAPP_URL")?.trim() || defaultMiniAppUrl,
        ...(chainDataRpcConfig
          ? {
            ethPriceUsd: async () => {
              const rpc = createBatchRpc(chainDataRpcConfig.rpcUrl, options.fetchChainData ?? fetch, 6_000);
              const prices = await readTokenPricesUsd(rpc, [{ address: wethAddress, decimals: 18 }]);
              return prices.get(wethAddress)?.usd ?? null;
            },
          }
          : {}),
      });
    };
  }

  if (chainDataRpcConfig) {
    dependencies.readLiveChainData = async (targets) => {
      return await readLiveChainData({
        targets,
        rpcUrl: chainDataRpcConfig.rpcUrl,
        logsRpcUrl: robinhoodLogsRpcUrl,
        fetchImpl: options.fetchChainData,
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
    dependencies.consumeTelegramOwnerBrainQuota = async (input) => {
      return await consumeTelegramOwnerBrainQuota({
        ...input,
        rpcClient: getRpcClient() as unknown as TelegramOwnerQuotaRpcClient,
      });
    };

    if (
      readOptionalEnv(telegramChatMemoryEnabledEnvKey)?.trim().toLowerCase() !==
        "false"
    ) {
      const getMemoryRpcClient = () =>
        getRpcClient() as unknown as TelegramChatMemoryRpcClient;

      dependencies.loadTelegramChatMemory = async (input) => {
        return await loadTelegramChatMemory({
          ...input,
          rpcClient: getMemoryRpcClient(),
        });
      };
      dependencies.appendTelegramChatMemory = async (input) => {
        await appendTelegramChatMemory({
          ...input,
          rpcClient: getMemoryRpcClient(),
        });
      };
      dependencies.forgetTelegramChatMemory = async (input) => {
        return await forgetTelegramChatMemory({
          ...input,
          rpcClient: getMemoryRpcClient(),
        });
      };
    }
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
      const ownerLinkSessionId = lookupSession.sessionId;

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
          notifyOwnerLinkOutcome: deliveryRuntimeConfig.enabled &&
              dependencies.deliverTelegramReadOnlyResponse
            ? async (notice) => {
              await dependencies.deliverTelegramReadOnlyResponse?.({
                telegramSessionId: ownerLinkSessionId,
                telegramChatId: notice.telegramChatId,
                response: buildTelegramOwnerLinkReply(notice.outcome),
              });
              await dependencies.markTelegramUpdateDelivered?.({
                telegramSessionId: ownerLinkSessionId,
                telegramUpdateId: notice.telegramUpdateId,
              });
            }
            : undefined,
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

    // Group chatter that is not meant for the bot is never processed.
    if (parsedUpdate?.addressedToBot === false) {
      return ignoredTelegramUpdateResponse();
    }

    const isGroupChat = parsedUpdate?.chatType === "group" ||
      parsedUpdate?.chatType === "supergroup";

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

      try {
        chatAuthorization = await dependencies.lookupTelegramChatAuthorization({
          agentId: lookupSession.agentId,
          telegramUserId: parsedUpdate.telegramUserId,
          telegramChatId: parsedUpdate.telegramChatId,
          commandKind: parsedUpdate.commandKind,
        });
      } catch (error) {
        if (
          !(error instanceof HttpError) ||
          error.statusCode !== 403 ||
          error.code !== "chat_not_authorized"
        ) {
          throw error;
        }

        // Outside the owner chat, a group can still be served as a community:
        // /community_on and /community_off go on (the database checks the
        // sender is the owner); everything else needs community mode on.
        const communityCommand = parsedUpdate.command === "community_on" ||
          parsedUpdate.command === "community_off";
        let communityAccess = false;

        if (isGroupChat && dependencies.isTelegramCommunityChatEnabled) {
          communityAccess = communityCommand ||
            await dependencies.isTelegramCommunityChatEnabled({
              agentId: lookupSession.agentId,
              telegramChatId: parsedUpdate.telegramChatId,
            });
        }

        if (!communityAccess) {
          return ignoredTelegramUpdateResponse();
        }

        chatAuthorization = { authorized: true, role: "member" };
      }
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
      let rememberedReply: string | null = null;
      // Group members reached through community mode: read-only, no memory,
      // rate limited, and no access to the owner's private settings.
      const isCommunityMember = chatAuthorization?.role === "member";

      if (
        parsedUpdate.command === "community_on" ||
        parsedUpdate.command === "community_off"
      ) {
        let text: string = communityTexts.notGroup;

        if (isGroupChat && dependencies.setTelegramCommunityChat) {
          try {
            text = getCommunitySetReply(
              await dependencies.setTelegramCommunityChat({
                agentId: lookupSession.agentId,
                telegramUserId: parsedUpdate.telegramUserId,
                telegramChatId: parsedUpdate.telegramChatId,
                chatTitle: parsedUpdate.chatTitle ?? "",
                enabled: parsedUpdate.command === "community_on",
              }),
            );
          } catch (error) {
            logSafeEvent(
              "telegram_community_fallback",
              error instanceof HttpError ? error.code : "unexpected_error",
            );
            text = communityTexts.failed;
          }
        } else if (isGroupChat) {
          text = communityTexts.failed;
        }

        response = {
          command: parsedUpdate.command,
          text: withAskBotHandle(text, lookupSession.botHandle),
        };
      }

      if (isMonitoringCommand(parsedUpdate.command)) {
        let text = monitoringTexts.failed;

        if (isCommunityMember || isGroupChat) {
          text = monitoringTexts.ownerOnly;
        } else if (dependencies.runMonitoringCommand) {
          try {
            text = await dependencies.runMonitoringCommand({
              command: parsedUpdate.command,
              args: parsedUpdate.text ?? "",
              agentId: lookupSession.agentId,
            });
          } catch (error) {
            logSafeEvent(
              "telegram_monitoring_fallback",
              error instanceof HttpError ? error.code : "unexpected_error",
            );
          }
        }

        response = { command: parsedUpdate.command, text };
      }

      // Swap commands are owner-only and private: the Mini App button
      // they return cannot open in groups.
      let miniAppButton: MiniAppButton | undefined;
      if (isTradingCommand(parsedUpdate.command)) {
        let text = tradingTexts.failed;

        if (isCommunityMember || isGroupChat) {
          text = tradingTexts.ownerOnly;
        } else if (dependencies.runTradingCommand) {
          try {
            const reply = await dependencies.runTradingCommand({
              command: parsedUpdate.command,
              args: parsedUpdate.text ?? "",
              agentId: lookupSession.agentId,
            });
            text = reply.text;
            miniAppButton = reply.button;
          } catch (error) {
            logSafeEvent(
              "telegram_trading_fallback",
              error instanceof HttpError ? error.code : "unexpected_error",
            );
          }
        }

        response = { command: parsedUpdate.command, text };
      }

      if (isCommunityMember && parsedUpdate.command === "help") {
        response = {
          command: "help",
          text: withAskBotHandle(communityTexts.help, lookupSession.botHandle),
        };
      }

      if (isCommunityMember && parsedUpdate.command === "forget") {
        response = { command: "forget", text: communityTexts.memberForget };
      } else if (parsedUpdate.command === "forget") {
        if (!dependencies.forgetTelegramChatMemory) {
          response = {
            command: parsedUpdate.command,
            text: "Chat memory is off for this agent, so there is nothing to clear.",
          };
        } else {
          try {
            await dependencies.forgetTelegramChatMemory({
              telegramSessionId: lookupSession.sessionId,
              telegramChatId: parsedUpdate.telegramChatId,
            });
          } catch (error) {
            logSafeEvent(
              "telegram_chat_memory_fallback",
              error instanceof HttpError ? error.code : "unexpected_error",
            );
            response = {
              command: parsedUpdate.command,
              text:
                "I could not clear this chat's memory right now. Try /forget again in a moment.",
            };
          }
        }
      }

      const executionGate = parsedUpdate.command === "chat" &&
          chatAuthorization
        ? reviewTelegramExecutionGate({
          text: parsedUpdate.text,
          command: parsedUpdate.command,
          authorizationRole: chatAuthorization.role,
        })
        : null;

      if (executionGate && executionGate.status !== "read_only_allowed") {
        response = {
          command: parsedUpdate.command,
          text: executionGate.responseText,
        };
      }

      // Owners get /help that leads with their template's strengths. If the
      // template cannot be read, the standard help still goes out.
      if (
        parsedUpdate.command === "help" && !isCommunityMember &&
        templateContextRuntimeConfig.enabled &&
        dependencies.lookupTelegramTemplateContext
      ) {
        try {
          const helpContext = await dependencies.lookupTelegramTemplateContext(
            lookupSession.agentId,
            "agent",
          );
          response = {
            command: "help",
            text: buildTelegramTemplateHelpText(helpContext.context.templateId),
          };
        } catch (error) {
          logSafeEvent(
            "telegram_help_template_fallback",
            error instanceof HttpError ? error.code : "unexpected_error",
          );
        }
      }

      let templateContext: TelegramTemplateContextLookupOutput | null = null;

      if (
        templateContextRuntimeConfig.enabled &&
        shouldUseTelegramTemplateContext(parsedUpdate.command) &&
        executionGate?.status !== "blocked"
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
        } else if (
          !executionGate || executionGate.status === "read_only_allowed"
        ) {
          response = {
            command: parsedUpdate.command,
            text: buildTelegramTemplateChatFallback(
              templateContext.context,
              classifyTelegramReadOnlyChatIntent(parsedUpdate.text),
              parsedUpdate.text,
            ),
          };
        }
      }

      // A review or plan about a wallet action ("review a swap of 500 USDC")
      // gets a read-only answer; a bare command keeps the gate's refusal.
      let answerableChat = shouldUseTelegramAgentBrain(parsedUpdate.command) &&
        executionGate?.status !== "blocked" &&
        (executionGate?.status !== "approval_draft_candidate" ||
          classifyTelegramReadOnlyChatIntent(parsedUpdate.text) !==
            "unsafe_execution");
      let chatHistory: TelegramChatMemoryTurn[] = [];
      let liveChainData = "";

      // Community questions count against per-member and per-group limits.
      // If the quota check itself fails, the question is not answered.
      if (answerableChat && isCommunityMember) {
        let quota: TelegramCommunityQuotaResult = "group_limited";

        if (dependencies.consumeTelegramCommunityQuota) {
          try {
            quota = await dependencies.consumeTelegramCommunityQuota({
              agentId: lookupSession.agentId,
              telegramChatId: parsedUpdate.telegramChatId,
              telegramUserId: parsedUpdate.telegramUserId,
            });
          } catch (error) {
            logSafeEvent(
              "telegram_community_fallback",
              error instanceof HttpError ? error.code : "unexpected_error",
            );
          }
        }

        if (quota !== "allowed") {
          answerableChat = false;
          response = {
            command: parsedUpdate.command,
            text: quota === "member_limited"
              ? communityTexts.memberLimited
              : communityTexts.groupLimited,
          };
        }
      }

      if (
        answerableChat && !isCommunityMember &&
        dependencies.loadTelegramChatMemory
      ) {
        try {
          chatHistory = await dependencies.loadTelegramChatMemory({
            telegramSessionId: lookupSession.sessionId,
            telegramChatId: parsedUpdate.telegramChatId,
          });
        } catch (error) {
          // Memory is optional: answer without it rather than fail.
          logSafeEvent(
            "telegram_chat_memory_fallback",
            error instanceof HttpError ? error.code : "unexpected_error",
          );
        }
      }

      if (answerableChat && dependencies.readLiveChainData) {
        const chainTargets = extractChainDataTargets(
          parsedUpdate.text,
          chatHistory,
        );

        if (hasChainDataTargets(chainTargets)) {
          try {
            liveChainData = await dependencies.readLiveChainData(chainTargets);
            // If the brain is off or fails, the owner still gets the facts.
            response = { command: parsedUpdate.command, text: liveChainData };
          } catch (error) {
            logSafeEvent(
              "telegram_chain_data_fallback",
              error instanceof HttpError ? error.code : "unexpected_error",
            );
          }
        }
      }

      // Owner chats are capped too, so one account cannot drain the model
      // credits. If the check itself fails, the owner is still answered.
      if (
        answerableChat && !isCommunityMember &&
        agentBrainRuntimeConfig.enabled &&
        dependencies.generateTelegramAgentBrainReply &&
        dependencies.consumeTelegramOwnerBrainQuota &&
        templateContext !== null
      ) {
        let quota: TelegramOwnerBrainQuotaResult = "allowed";

        try {
          quota = await dependencies.consumeTelegramOwnerBrainQuota({
            agentId: lookupSession.agentId,
          });
        } catch (error) {
          logSafeEvent(
            "telegram_owner_quota_fallback",
            error instanceof HttpError ? error.code : "unexpected_error",
          );
        }

        if (quota !== "allowed") {
          answerableChat = false;
          response = {
            command: parsedUpdate.command,
            text: liveChainData
              ? `${liveChainData}\n\n${ownerQuotaTexts[quota]}`
              : ownerQuotaTexts[quota],
          };
        }
      }

      if (
        agentBrainRuntimeConfig.enabled &&
        dependencies.generateTelegramAgentBrainReply &&
        templateContext !== null &&
        answerableChat
      ) {
        try {
          const agentBrainReply = await dependencies
            .generateTelegramAgentBrainReply({
              command: parsedUpdate.command,
              templateId: templateContext?.context.templateId,
              agentName: templateContext?.context.name,
              agentRole: templateContext?.context.role,
              agentSummary: templateContext?.context.summary,
              capabilities: templateContext?.context.readOnlyActions,
              gatedActions: templateContext?.context.gatedActions,
              modules: templateContext?.context.modules,
              safetyNote: templateContext?.context.safetyNote,
              userRequest: parsedUpdate.text,
              chatIntent: classifyTelegramReadOnlyChatIntent(parsedUpdate.text),
              languageCode: parsedUpdate.languageCode,
              history: chatHistory,
              persona: templateContext?.context.ownerSettings?.persona,
              ownerInstructions: templateContext?.context.ownerSettings
                ?.instructions,
              projectKnowledge: templateContext?.context.ownerSettings
                ?.knowledge,
              // The owner's risk profile and review limit stay private.
              riskProfile: isCommunityMember
                ? undefined
                : templateContext?.context.ownerSettings?.riskProfile,
              maxReviewUsd: isCommunityMember
                ? undefined
                : templateContext?.context.ownerSettings?.maxReviewUsd,
              liveChainData,
              audience: isCommunityMember ? "community" : "owner",
            });
          response = {
            command: parsedUpdate.command,
            text: agentBrainReply.text,
          };
          // Group members' messages are never stored.
          rememberedReply = isCommunityMember ? null : agentBrainReply.text;
        } catch (error) {
          // Agent-brain is optional. Preserve read-only delivery if the provider
          // times out, rejects output, or returns a malformed response. Log the
          // reason code only, never the message or the model output.
          logSafeEvent(
            "telegram_agent_brain_fallback",
            error instanceof HttpError ? error.code : "unexpected_error",
          );
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
          ...(isGroupChat ? { replyToMessageId: parsedUpdate.messageId } : {}),
          ...(miniAppButton && !isGroupChat ? { miniAppButton } : {}),
        });
      } catch (error) {
        if (error instanceof HttpError) {
          throw error;
        }

        throw sanitizeTelegramResponseDeliveryError(error);
      }

      if (dependencies.markTelegramUpdateDelivered) {
        try {
          await dependencies.markTelegramUpdateDelivered({
            telegramSessionId: lookupSession.sessionId,
            telegramUpdateId: parsedUpdate.updateId,
          });
        } catch (error) {
          if (error instanceof HttpError) {
            throw error;
          }

          throw sanitizeTelegramUpdateDeliveryMarkRpcError(error);
        }
      }

      // Remember only exchanges the agent brain answered and the owner
      // actually received; refusals, fallbacks, and commands are not stored.
      if (rememberedReply && dependencies.appendTelegramChatMemory) {
        try {
          await dependencies.appendTelegramChatMemory({
            telegramSessionId: lookupSession.sessionId,
            telegramChatId: parsedUpdate.telegramChatId,
            userText: parsedUpdate.text ?? "",
            assistantText: rememberedReply,
          });
        } catch (error) {
          logSafeEvent(
            "telegram_chat_memory_fallback",
            error instanceof HttpError ? error.code : "unexpected_error",
          );
        }
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
    // Stickers, photos, joins, edits, and unknown commands are acknowledged
    // so Telegram does not keep retrying them.
    if (error instanceof HttpError && error.code === "unsupported_update") {
      return ignoredTelegramUpdateResponse();
    }

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
        message: "Kyra could not process this Telegram update safely.",
      },
      500,
    );
  }
}

function ignoredTelegramUpdateResponse() {
  return jsonResponse(
    {
      ok: true,
      status: "ignored",
      message: "Telegram update ignored.",
    },
    200,
  );
}

// Telegram only passes "/ask@bot" (or replies) to bots in groups, so spell
// out the exact command with this bot's name.
function withAskBotHandle(text: string, botHandle: string | null | undefined) {
  return botHandle && /^@[A-Za-z0-9_]{5,32}$/.test(botHandle)
    ? text.replace("/ask followed", `/ask${botHandle} followed`)
    : text;
}

function getCommunitySetReply(result: TelegramCommunitySetResult) {
  switch (result) {
    case "enabled":
      return communityTexts.enabled;
    case "already_enabled":
      return communityTexts.alreadyEnabled;
    case "disabled":
      return communityTexts.disabled;
    case "already_disabled":
      return communityTexts.alreadyDisabled;
    case "not_owner":
      return communityTexts.notOwner;
    case "not_group":
      return communityTexts.notGroup;
    case "limit_reached":
      return communityTexts.limitReached;
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
  return command === "chat";
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
