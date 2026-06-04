import { HttpError } from "./core.ts";
import {
  registerTelegramWebhookWithSetWebhook,
  type TelegramFetch,
  validateTelegramBotTokenWithGetMe,
} from "./telegram-api.ts";

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

async function captureError(action: () => Promise<unknown>) {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw.");
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

const testBotToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
const testWebhookUrl =
  "https://kyraagent.xyz/functions/v1/telegram-webhook/session-123";
const testWebhookSecretToken = "telegram_secret_token_123456789012";

Deno.test("telegram getMe helper normalizes safe bot metadata", async () => {
  let capturedUrl = "";
  let capturedMethod = "";
  let signalWasProvided = false;
  const fetchTelegram: TelegramFetch = async (url, init) => {
    capturedUrl = url;
    capturedMethod = init?.method ?? "";
    signalWasProvided = init?.signal instanceof AbortSignal;

    return jsonResponse({
      ok: true,
      result: {
        id: 987654321,
        is_bot: true,
        first_name: "Kyra Test",
        username: "kyra_test_bot",
        can_join_groups: true,
        can_read_all_group_messages: false,
      },
    });
  };

  const bot = await validateTelegramBotTokenWithGetMe(testBotToken, {
    fetch: fetchTelegram,
    timeoutMs: 1000,
  });

  assertEquals(
    capturedUrl,
    `https://api.telegram.org/bot${testBotToken}/getMe`,
  );
  assertEquals(capturedMethod, "GET");
  assert(signalWasProvided, "getMe request must include an AbortSignal.");
  assertEquals(bot.telegramBotId, "987654321");
  assertEquals(bot.username, "kyra_test_bot");
  assertEquals(bot.firstName, "Kyra Test");
  assertEquals(bot.canJoinGroups, true);
  assertEquals(bot.canReadAllGroupMessages, false);
});

Deno.test("telegram getMe helper maps unauthorized tokens to validation failure", async () => {
  const error = await captureError(() =>
    validateTelegramBotTokenWithGetMe(testBotToken, {
      fetch: async () =>
        jsonResponse({
          ok: false,
          error_code: 401,
          description: `Unauthorized ${testBotToken}`,
        }, 401),
    })
  );
  const serialized = JSON.stringify(error);

  assert(
    error instanceof HttpError,
    "Unauthorized token must throw HttpError.",
  );
  assertEquals((error as HttpError).statusCode, 422);
  assertEquals((error as HttpError).code, "telegram_validation_failed");
  assertEquals(
    (error as HttpError).message,
    "Telegram bot token could not be validated.",
  );
  assert(!serialized.includes(testBotToken), "Error must not expose botToken.");
  assert(
    !serialized.includes("Unauthorized"),
    "Error must not expose Telegram raw body.",
  );
});

Deno.test("telegram getMe helper maps not found tokens to validation failure", async () => {
  const error = await captureError(() =>
    validateTelegramBotTokenWithGetMe(testBotToken, {
      fetch: async () => jsonResponse({ ok: false, error_code: 404 }, 404),
    })
  );

  assert(error instanceof HttpError, "Not found token must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 422);
  assertEquals((error as HttpError).code, "telegram_validation_failed");
});

Deno.test("telegram getMe helper maps Telegram ok false envelope to validation failure", async () => {
  const error = await captureError(() =>
    validateTelegramBotTokenWithGetMe(testBotToken, {
      fetch: async () =>
        jsonResponse({
          ok: false,
          error_code: 400,
          description: `Bad token ${testBotToken}`,
        }),
    })
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "ok false envelope must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 422);
  assertEquals((error as HttpError).code, "telegram_validation_failed");
  assert(!serialized.includes(testBotToken), "Error must not expose botToken.");
  assert(
    !serialized.includes("Bad token"),
    "Error must not expose raw Telegram description.",
  );
});

Deno.test("telegram getMe helper rejects incomplete bot metadata", async () => {
  const error = await captureError(() =>
    validateTelegramBotTokenWithGetMe(testBotToken, {
      fetch: async () =>
        jsonResponse({
          ok: true,
          result: {
            id: 987654321,
            is_bot: true,
            first_name: "Kyra Test",
          },
        }),
    })
  );

  assert(
    error instanceof HttpError,
    "Incomplete metadata must throw HttpError.",
  );
  assertEquals((error as HttpError).statusCode, 422);
  assertEquals((error as HttpError).code, "telegram_validation_failed");
});

Deno.test("telegram getMe helper rejects non-bot metadata", async () => {
  const error = await captureError(() =>
    validateTelegramBotTokenWithGetMe(testBotToken, {
      fetch: async () =>
        jsonResponse({
          ok: true,
          result: {
            id: 987654321,
            is_bot: false,
            first_name: "Kyra Test",
            username: "kyra_test_bot",
          },
        }),
    })
  );

  assert(error instanceof HttpError, "Non-bot metadata must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 422);
  assertEquals((error as HttpError).code, "telegram_validation_failed");
});

Deno.test("telegram getMe helper maps rate limits to 429", async () => {
  const error = await captureError(() =>
    validateTelegramBotTokenWithGetMe(testBotToken, {
      fetch: async () => jsonResponse({ ok: false, error_code: 429 }, 429),
    })
  );

  assert(error instanceof HttpError, "Rate limit must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 429);
  assertEquals((error as HttpError).code, "rate_limited");
});

Deno.test("telegram getMe helper maps Telegram 5xx to unavailable", async () => {
  const error = await captureError(() =>
    validateTelegramBotTokenWithGetMe(testBotToken, {
      fetch: async () => jsonResponse({ ok: false }, 502),
    })
  );

  assert(error instanceof HttpError, "Telegram 5xx must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 503);
  assertEquals((error as HttpError).code, "telegram_unavailable");
});

Deno.test("telegram getMe helper maps malformed JSON to unavailable without leaking body", async () => {
  const error = await captureError(() =>
    validateTelegramBotTokenWithGetMe(testBotToken, {
      fetch: async () =>
        new Response(`not-json ${testBotToken}`, {
          status: 200,
          headers: {
            "content-type": "application/json",
          },
        }),
    })
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "Malformed JSON must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 503);
  assertEquals((error as HttpError).code, "telegram_unavailable");
  assert(!serialized.includes(testBotToken), "Error must not expose botToken.");
  assert(
    !serialized.includes("not-json"),
    "Error must not expose raw Telegram body.",
  );
});

Deno.test("telegram getMe helper maps network errors to unavailable", async () => {
  const error = await captureError(() =>
    validateTelegramBotTokenWithGetMe(testBotToken, {
      fetch: async () => {
        throw new Error(
          `network failed for https://api.telegram.org/bot${testBotToken}/getMe`,
        );
      },
    })
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "Network failure must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 503);
  assertEquals((error as HttpError).code, "telegram_unavailable");
  assert(!serialized.includes(testBotToken), "Error must not expose botToken.");
  assert(
    !serialized.includes("api.telegram.org"),
    "Error must not expose Telegram URL.",
  );
});

Deno.test("telegram getMe helper aborts timed out requests", async () => {
  const error = await captureError(() =>
    validateTelegramBotTokenWithGetMe(testBotToken, {
      timeoutMs: 1,
      fetch: (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Request aborted", "AbortError"));
          });
        }),
    })
  );

  assert(error instanceof HttpError, "Timeout must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 503);
  assertEquals((error as HttpError).code, "telegram_unavailable");
});

Deno.test("telegram setWebhook helper builds sanitized registration request", async () => {
  let capturedUrl = "";
  let capturedMethod = "";
  let capturedBody = "";
  let capturedContentType = "";
  let signalWasProvided = false;
  const fetchTelegram: TelegramFetch = async (url, init) => {
    capturedUrl = url;
    capturedMethod = init?.method ?? "";
    capturedBody = String(init?.body ?? "");
    capturedContentType = String(
      new Headers(init?.headers).get("content-type") ?? "",
    );
    signalWasProvided = init?.signal instanceof AbortSignal;

    return jsonResponse({ ok: true, result: true });
  };

  const result = await registerTelegramWebhookWithSetWebhook(
    {
      botToken: testBotToken,
      webhookUrl: testWebhookUrl,
      webhookSecretToken: testWebhookSecretToken,
    },
    {
      fetch: fetchTelegram,
      timeoutMs: 1000,
    },
  );
  const requestBody = JSON.parse(capturedBody) as Record<string, unknown>;
  const serializedResult = JSON.stringify(result);

  assertEquals(
    capturedUrl,
    `https://api.telegram.org/bot${testBotToken}/setWebhook`,
  );
  assertEquals(capturedMethod, "POST");
  assertEquals(capturedContentType, "application/json");
  assert(signalWasProvided, "setWebhook request must include an AbortSignal.");
  assertEquals(requestBody.url, testWebhookUrl);
  assertEquals(requestBody.secret_token, testWebhookSecretToken);
  assertEquals(
    JSON.stringify(requestBody.allowed_updates),
    JSON.stringify(["message", "callback_query"]),
  );
  assertEquals(requestBody.drop_pending_updates, false);
  assertEquals(result.registered, true);
  assert(
    !serializedResult.includes(testBotToken),
    "Result must not expose botToken.",
  );
  assert(
    !serializedResult.includes(testWebhookUrl),
    "Result must not expose webhook URL.",
  );
  assert(
    !serializedResult.includes(testWebhookSecretToken),
    "Result must not expose webhook secret.",
  );
});

Deno.test("telegram setWebhook helper rejects invalid bot token before fetch", async () => {
  let fetchCalled = false;
  const error = await captureError(() =>
    registerTelegramWebhookWithSetWebhook(
      {
        botToken: "not-a-token",
        webhookUrl: testWebhookUrl,
        webhookSecretToken: testWebhookSecretToken,
      },
      {
        fetch: async () => {
          fetchCalled = true;
          return jsonResponse({ ok: true, result: true });
        },
      },
    )
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "Invalid token must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
  assertEquals((error as HttpError).message, "botToken is invalid.");
  assert(!fetchCalled, "Invalid botToken must reject before fetch.");
  assert(
    !serialized.includes("not-a-token"),
    "Error must not expose invalid botToken.",
  );
});

Deno.test("telegram setWebhook helper rejects non-HTTPS webhook URL before fetch", async () => {
  let fetchCalled = false;
  const error = await captureError(() =>
    registerTelegramWebhookWithSetWebhook(
      {
        botToken: testBotToken,
        webhookUrl: "http://kyraagent.xyz/functions/v1/telegram-webhook",
        webhookSecretToken: testWebhookSecretToken,
      },
      {
        fetch: async () => {
          fetchCalled = true;
          return jsonResponse({ ok: true, result: true });
        },
      },
    )
  );

  assert(error instanceof HttpError, "Invalid URL must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
  assertEquals((error as HttpError).message, "webhookUrl is invalid.");
  assert(!fetchCalled, "Invalid webhookUrl must reject before fetch.");
});

Deno.test("telegram setWebhook helper rejects malformed webhook secret before fetch", async () => {
  let fetchCalled = false;
  const error = await captureError(() =>
    registerTelegramWebhookWithSetWebhook(
      {
        botToken: testBotToken,
        webhookUrl: testWebhookUrl,
        webhookSecretToken: "too-short",
      },
      {
        fetch: async () => {
          fetchCalled = true;
          return jsonResponse({ ok: true, result: true });
        },
      },
    )
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "Invalid secret must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
  assertEquals((error as HttpError).message, "webhookSecretToken is invalid.");
  assert(!fetchCalled, "Invalid webhook secret must reject before fetch.");
  assert(
    !serialized.includes("too-short"),
    "Error must not expose invalid webhook secret.",
  );
});

Deno.test("telegram setWebhook helper maps unauthorized registration to sanitized validation failure", async () => {
  const error = await captureError(() =>
    registerTelegramWebhookWithSetWebhook(
      {
        botToken: testBotToken,
        webhookUrl: testWebhookUrl,
        webhookSecretToken: testWebhookSecretToken,
      },
      {
        fetch: async () =>
          jsonResponse({
            ok: false,
            error_code: 401,
            description:
              `Unauthorized ${testBotToken} ${testWebhookUrl} ${testWebhookSecretToken}`,
          }, 401),
      },
    )
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "Unauthorized webhook must throw.");
  assertEquals((error as HttpError).statusCode, 422);
  assertEquals((error as HttpError).code, "telegram_validation_failed");
  assertEquals(
    (error as HttpError).message,
    "Telegram webhook could not be registered.",
  );
  assert(!serialized.includes(testBotToken), "Error must not expose botToken.");
  assert(
    !serialized.includes(testWebhookUrl),
    "Error must not expose webhook URL.",
  );
  assert(
    !serialized.includes(testWebhookSecretToken),
    "Error must not expose webhook secret.",
  );
  assert(
    !serialized.includes("Unauthorized"),
    "Error must not expose raw Telegram body.",
  );
});

Deno.test("telegram setWebhook helper maps Telegram ok false envelope to sanitized validation failure", async () => {
  const error = await captureError(() =>
    registerTelegramWebhookWithSetWebhook(
      {
        botToken: testBotToken,
        webhookUrl: testWebhookUrl,
        webhookSecretToken: testWebhookSecretToken,
      },
      {
        fetch: async () =>
          jsonResponse({
            ok: false,
            error_code: 400,
            description: `Bad webhook ${testWebhookUrl}`,
          }),
      },
    )
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "ok false envelope must throw.");
  assertEquals((error as HttpError).statusCode, 422);
  assertEquals((error as HttpError).code, "telegram_validation_failed");
  assert(!serialized.includes(testWebhookUrl), "Error must hide webhook URL.");
  assert(
    !serialized.includes("Bad webhook"),
    "Error must not expose raw Telegram description.",
  );
});

Deno.test("telegram setWebhook helper maps rate limits to 429", async () => {
  const error = await captureError(() =>
    registerTelegramWebhookWithSetWebhook(
      {
        botToken: testBotToken,
        webhookUrl: testWebhookUrl,
        webhookSecretToken: testWebhookSecretToken,
      },
      {
        fetch: async () => jsonResponse({ ok: false, error_code: 429 }, 429),
      },
    )
  );

  assert(error instanceof HttpError, "Rate limit must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 429);
  assertEquals((error as HttpError).code, "rate_limited");
  assertEquals(
    (error as HttpError).message,
    "Telegram webhook registration is rate limited.",
  );
});

Deno.test("telegram setWebhook helper maps Telegram 5xx to unavailable", async () => {
  const error = await captureError(() =>
    registerTelegramWebhookWithSetWebhook(
      {
        botToken: testBotToken,
        webhookUrl: testWebhookUrl,
        webhookSecretToken: testWebhookSecretToken,
      },
      {
        fetch: async () => jsonResponse({ ok: false }, 502),
      },
    )
  );

  assert(error instanceof HttpError, "Telegram 5xx must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 503);
  assertEquals((error as HttpError).code, "telegram_unavailable");
});

Deno.test("telegram setWebhook helper maps malformed JSON to unavailable without leaking body", async () => {
  const error = await captureError(() =>
    registerTelegramWebhookWithSetWebhook(
      {
        botToken: testBotToken,
        webhookUrl: testWebhookUrl,
        webhookSecretToken: testWebhookSecretToken,
      },
      {
        fetch: async () =>
          new Response(
            `not-json ${testBotToken} ${testWebhookUrl} ${testWebhookSecretToken}`,
            {
              status: 200,
              headers: {
                "content-type": "application/json",
              },
            },
          ),
      },
    )
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "Malformed JSON must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 503);
  assertEquals((error as HttpError).code, "telegram_unavailable");
  assert(!serialized.includes(testBotToken), "Error must not expose botToken.");
  assert(
    !serialized.includes(testWebhookUrl),
    "Error must not expose webhook URL.",
  );
  assert(
    !serialized.includes(testWebhookSecretToken),
    "Error must not expose webhook secret.",
  );
  assert(
    !serialized.includes("not-json"),
    "Error must not expose raw Telegram body.",
  );
});

Deno.test("telegram setWebhook helper maps network errors to unavailable", async () => {
  const error = await captureError(() =>
    registerTelegramWebhookWithSetWebhook(
      {
        botToken: testBotToken,
        webhookUrl: testWebhookUrl,
        webhookSecretToken: testWebhookSecretToken,
      },
      {
        fetch: async () => {
          throw new Error(
            `network failed for ${testBotToken} ${testWebhookUrl} ${testWebhookSecretToken}`,
          );
        },
      },
    )
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "Network failure must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 503);
  assertEquals((error as HttpError).code, "telegram_unavailable");
  assert(!serialized.includes(testBotToken), "Error must not expose botToken.");
  assert(
    !serialized.includes(testWebhookUrl),
    "Error must not expose webhook URL.",
  );
  assert(
    !serialized.includes(testWebhookSecretToken),
    "Error must not expose webhook secret.",
  );
});

Deno.test("telegram setWebhook helper aborts timed out requests", async () => {
  const error = await captureError(() =>
    registerTelegramWebhookWithSetWebhook(
      {
        botToken: testBotToken,
        webhookUrl: testWebhookUrl,
        webhookSecretToken: testWebhookSecretToken,
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
    )
  );

  assert(error instanceof HttpError, "Timeout must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 503);
  assertEquals((error as HttpError).code, "telegram_unavailable");
});
