import {
  assertTelegramWebhookChatAuthorized,
  type TelegramWebhookChatAuthorization,
  type TelegramWebhookChatAuthorizationPolicy,
} from "./core.ts";
import {
  buildTelegramReadOnlyCommandResponse,
  type TelegramReadOnlyCommandResponse,
} from "./read-only-response.ts";
import { reviewTelegramExecutionGate } from "./execution-gate.ts";
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
  const staticResponse = buildTelegramReadOnlyCommandResponse(
    parsed.command,
    parsed.text,
  );
  const executionGate = parsed.command === "chat"
    ? reviewTelegramExecutionGate({
      text: parsed.text,
      command: parsed.command,
      authorizationRole: authorization.role,
    })
    : null;
  const response = executionGate && executionGate.status !== "read_only_allowed"
    ? {
      command: parsed.command,
      text: executionGate.responseText,
    }
    : staticResponse;

  return {
    command: parsed.command,
    commandKind: parsed.commandKind,
    authorizationRole: authorization.role,
    response,
  };
}
