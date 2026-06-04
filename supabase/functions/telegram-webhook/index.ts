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
  sanitizeErrorMessage,
  sanitizeTelegramWebhookSessionLookupError,
} from "./core.ts";

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

export function handleTelegramWebhookRequest(request: Request) {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    assertPostMethod(request, "telegram-webhook");

    assertWebhookSecretHeader(request);
    assertJsonContentType(request.headers);
    assertBodySizeFromHeaders(request.headers, maxTelegramWebhookBodyBytes);

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
  Deno.serve((request) => handleTelegramWebhookRequest(request));
}
