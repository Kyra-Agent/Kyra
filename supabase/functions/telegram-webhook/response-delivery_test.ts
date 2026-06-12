import { HttpError } from "./core.ts";
import {
  assertTelegramDeliveryBotToken,
  assertTelegramDeliveryChatId,
  assertTelegramDeliveryResponse,
  deliverTelegramReadOnlyResponse,
  type TelegramResponseDeliveryFetch,
} from "./response-delivery.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

async function captureError(action: () => Promise<unknown> | unknown) {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw.");
}

async function assertRejectsHttpError(
  action: () => Promise<unknown> | unknown,
  expectedStatusCode: number,
  expectedCode: string,
) {
  const error = await captureError(action);

  assert(error instanceof HttpError, "Expected HttpError.");
  assertEquals((error as HttpError).statusCode, expectedStatusCode);
  assertEquals((error as HttpError).code, expectedCode);

  return error as HttpError;
}

const testBotToken = "1234567890:abcdefghijklmnopqrstuvwxyz";
const testResponse = {
  command: "status",
  text: "Kyra Telegram session: active",
};

Deno.test("telegram response delivery builds sanitized sendMessage request", async () => {
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedBody = "";
  let capturedContentType = "";
  let signalWasProvided = false;
  const fetchTelegram: TelegramResponseDeliveryFetch = async (url, init) => {
    capturedUrl = url;
    capturedMethod = init?.method ?? "";
    capturedBody = String(init?.body ?? "");
    capturedContentType = String(
      new Headers(init?.headers).get("content-type") ?? "",
    );
    signalWasProvided = init?.signal instanceof AbortSignal;

    return jsonResponse({ ok: true, result: { message_id: 42 } });
  };

  const result = await deliverTelegramReadOnlyResponse(
    {
      botToken: testBotToken,
      telegramChatId: "-987654321",
      response: testResponse,
    },
    {
      fetch: fetchTelegram,
      timeoutMs: 1000,
    },
  );
  const payload = JSON.parse(capturedBody);

  assertEquals(result.delivered, true);
  assertEquals(Object.keys(result).join(","), "delivered");
  assert(capturedUrl.endsWith(`/bot${testBotToken}/sendMessage`), "Bad URL.");
  assertEquals(capturedMethod, "POST");
  assertEquals(capturedContentType, "application/json");
  assertEquals(signalWasProvided, true);
  assertEquals(payload.chat_id, "-987654321");
  assertEquals(payload.text, testResponse.text);
  assertEquals(payload.disable_web_page_preview, true);
  assert(
    !capturedBody.includes(testBotToken),
    "Request body must not include bot token.",
  );
});

Deno.test("telegram response delivery validates token chat and response before fetch", async () => {
  let fetchCalled = false;
  const fetchTelegram: TelegramResponseDeliveryFetch = async () => {
    fetchCalled = true;
    return jsonResponse({ ok: true, result: true });
  };

  await assertRejectsHttpError(
    () =>
      deliverTelegramReadOnlyResponse(
        {
          botToken: "invalid-token",
          telegramChatId: "123",
          response: testResponse,
        },
        { fetch: fetchTelegram },
      ),
    400,
    "invalid_request",
  );

  await assertRejectsHttpError(
    () =>
      deliverTelegramReadOnlyResponse(
        {
          botToken: testBotToken,
          telegramChatId: "0",
          response: testResponse,
        },
        { fetch: fetchTelegram },
      ),
    400,
    "invalid_update",
  );

  await assertRejectsHttpError(
    () =>
      deliverTelegramReadOnlyResponse(
        {
          botToken: testBotToken,
          telegramChatId: "123",
          response: { ...testResponse, raw: "private" },
        },
        { fetch: fetchTelegram },
      ),
    500,
    "server_error",
  );

  assert(!fetchCalled, "Invalid delivery input must not call fetch.");
});

Deno.test("telegram response delivery maps Telegram failures safely", async () => {
  const unauthorized = await assertRejectsHttpError(
    () =>
      deliverTelegramReadOnlyResponse(
        {
          botToken: testBotToken,
          telegramChatId: "123",
          response: testResponse,
        },
        { fetch: async () => jsonResponse({ ok: false }, 401) },
      ),
    422,
    "telegram_delivery_failed",
  );

  assertEquals(
    unauthorized.message,
    "Telegram response could not be delivered.",
  );

  const rateLimited = await assertRejectsHttpError(
    () =>
      deliverTelegramReadOnlyResponse(
        {
          botToken: testBotToken,
          telegramChatId: "123",
          response: testResponse,
        },
        { fetch: async () => jsonResponse({ ok: false }, 429) },
      ),
    429,
    "rate_limited",
  );

  assertEquals(
    rateLimited.message,
    "Telegram response delivery is rate limited.",
  );

  const unavailable = await assertRejectsHttpError(
    () =>
      deliverTelegramReadOnlyResponse(
        {
          botToken: testBotToken,
          telegramChatId: "123",
          response: testResponse,
        },
        { fetch: async () => jsonResponse({ ok: false }, 502) },
      ),
    503,
    "telegram_unavailable",
  );

  assertEquals(unavailable.message, "Telegram is unavailable.");
});

Deno.test("telegram response delivery maps malformed envelopes safely", async () => {
  await assertRejectsHttpError(
    () =>
      deliverTelegramReadOnlyResponse(
        {
          botToken: testBotToken,
          telegramChatId: "123",
          response: testResponse,
        },
        { fetch: async () => new Response("{bad json", { status: 200 }) },
      ),
    503,
    "telegram_unavailable",
  );

  await assertRejectsHttpError(
    () =>
      deliverTelegramReadOnlyResponse(
        {
          botToken: testBotToken,
          telegramChatId: "123",
          response: testResponse,
        },
        {
          fetch: async () =>
            jsonResponse({
              ok: false,
              error_code: 429,
              description: "raw chat 123 token leaked",
            }),
        },
      ),
    429,
    "rate_limited",
  );
});

Deno.test("telegram response delivery maps network errors and timeouts safely", async () => {
  const networkError = await assertRejectsHttpError(
    () =>
      deliverTelegramReadOnlyResponse(
        {
          botToken: testBotToken,
          telegramChatId: "123",
          response: testResponse,
        },
        {
          fetch: async () => {
            throw new Error("raw network token and chat 123");
          },
        },
      ),
    503,
    "telegram_unavailable",
  );

  assertEquals(networkError.message, "Telegram is unavailable.");

  const timeoutError = await assertRejectsHttpError(
    () =>
      deliverTelegramReadOnlyResponse(
        {
          botToken: testBotToken,
          telegramChatId: "123",
          response: testResponse,
        },
        {
          timeoutMs: 1,
          fetch: (_url, init) =>
            new Promise<Response>((_resolve, reject) => {
              init?.signal?.addEventListener("abort", () => {
                reject(new DOMException("Request aborted", "AbortError"));
              });
            }),
        },
      ),
    503,
    "telegram_unavailable",
  );

  assertEquals(timeoutError.message, "Telegram is unavailable.");
});

Deno.test("telegram response delivery validators return bounded values", () => {
  assertEquals(assertTelegramDeliveryBotToken(testBotToken), testBotToken);
  assertEquals(assertTelegramDeliveryChatId(-123), "-123");
  assertEquals(assertTelegramDeliveryChatId(" 123 "), "123");

  const response = assertTelegramDeliveryResponse({
    command: "help",
    text: "Kyra Telegram commands",
  });
  const agentResponse = assertTelegramDeliveryResponse({
    command: "agent",
    text: "Kyra agent: active",
  });
  const actionsResponse = assertTelegramDeliveryResponse({
    command: "actions",
    text: "Available read-only commands",
  });
  const modulesResponse = assertTelegramDeliveryResponse({
    command: "modules",
    text: "Kyra modules",
  });

  assertEquals(response.command, "help");
  assertEquals(response.text, "Kyra Telegram commands");
  assertEquals(agentResponse.command, "agent");
  assertEquals(actionsResponse.command, "actions");
  assertEquals(modulesResponse.command, "modules");
});
