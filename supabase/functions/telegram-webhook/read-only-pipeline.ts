import {
  assertTelegramWebhookChatAuthorized,
  type TelegramWebhookChatAuthorization,
  type TelegramWebhookChatAuthorizationPolicy,
} from "./core.ts";
import {
  buildTelegramReadOnlyCommandResponse,
  type TelegramReadOnlyCommandResponse,
} from "./read-only-response.ts";
import {
  parseTelegramWebhookUpdate,
  type TelegramWebhookParsedCommandName,
} from "./update-parser.ts";

export interface TelegramVerifiedReadOnlyPipelineInput {
  update: unknown;
  expectedBotUsername?: string | null;
  chatPolicy: TelegramWebhookChatAuthorizationPolicy;
}

export interface TelegramVerifiedReadOnlyPipelineResult {
  command: TelegramWebhookParsedCommandName;
  commandKind: "read_only";
  authorizationRole: TelegramWebhookChatAuthorization["role"];
  response: TelegramReadOnlyCommandResponse;
}

export function processVerifiedTelegramReadOnlyUpdate(
  input: TelegramVerifiedReadOnlyPipelineInput,
): TelegramVerifiedReadOnlyPipelineResult {
  const parsed = parseTelegramWebhookUpdate(input.update, {
    expectedBotUsername: input.expectedBotUsername,
  });
  const authorization = assertTelegramWebhookChatAuthorized(
    {
      telegramUserId: parsed.telegramUserId,
      telegramChatId: parsed.telegramChatId,
    },
    input.chatPolicy,
    parsed.commandKind,
  );
  const response = buildTelegramReadOnlyCommandResponse(
    parsed.command,
    parsed.text,
  );

  return {
    command: parsed.command,
    commandKind: parsed.commandKind,
    authorizationRole: authorization.role,
    response,
  };
}
