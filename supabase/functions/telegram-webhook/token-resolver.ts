import { HttpError } from "./core.ts";
import { assertTelegramDeliveryBotToken } from "./response-delivery.ts";

export interface TelegramDeliveryTokenResolverResult {
  botToken: string;
}

export interface TelegramDeliveryTokenResolverRpcResult {
  data?: unknown;
  error?: unknown | null;
}

export interface TelegramDeliveryTokenResolverRpcClient {
  rpc(
    functionName: "resolve_telegram_delivery_token",
    args: { p_telegram_session_id: string },
  ):
    | Promise<TelegramDeliveryTokenResolverRpcResult>
    | TelegramDeliveryTokenResolverRpcResult;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function resolveTelegramDeliveryBotToken(input: {
  telegramSessionId: unknown;
  rpcClient: TelegramDeliveryTokenResolverRpcClient;
}): Promise<TelegramDeliveryTokenResolverResult> {
  try {
    const result = await input.rpcClient.rpc("resolve_telegram_delivery_token", {
      p_telegram_session_id: readTelegramSessionId(input.telegramSessionId),
    });

    return assertTelegramDeliveryTokenResolverRpcResult(result);
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    throw sanitizeTelegramDeliveryTokenResolverError(error);
  }
}

export function assertTelegramDeliveryTokenResolverRpcResult(
  result: TelegramDeliveryTokenResolverRpcResult,
): TelegramDeliveryTokenResolverResult {
  if (result.error) {
    throw sanitizeTelegramDeliveryTokenResolverRpcError(result.error);
  }

  return assertResolvedTelegramDeliveryBotToken(result.data);
}

export function assertResolvedTelegramDeliveryBotToken(
  value: unknown,
): TelegramDeliveryTokenResolverResult {
  try {
    return {
      botToken: assertTelegramDeliveryBotToken(value),
    };
  } catch (error) {
    throw sanitizeTelegramDeliveryTokenResolverRpcError(error);
  }
}

export function sanitizeTelegramDeliveryTokenResolverError(_error: unknown) {
  return new HttpError(
    500,
    "server_error",
    "Telegram delivery token resolution failed.",
  );
}

export function sanitizeTelegramDeliveryTokenResolverRpcError(
  _error: unknown,
) {
  return new HttpError(
    503,
    "telegram_unavailable",
    "Telegram delivery token is unavailable.",
  );
}

function readTelegramSessionId(value: unknown) {
  if (typeof value !== "string" || !uuidPattern.test(value.trim())) {
    throw sanitizeTelegramDeliveryTokenResolverError(
      new Error("Invalid Telegram session id."),
    );
  }

  return value.trim();
}
