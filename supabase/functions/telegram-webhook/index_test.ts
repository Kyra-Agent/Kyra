import {
  assertBodySizeFromHeaders,
  handleTelegramWebhookRequest,
  HttpError,
  maxTelegramWebhookBodyBytes,
  sanitizeErrorMessage,
} from "./index.ts";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

async function readJson(response: Response) {
  return await response.json() as Record<string, unknown>;
}

function requestThatFailsIfBodyIsRead(headers: HeadersInit, onRead: () => void) {
  return {
    method: "POST",
    headers: new Headers(headers),
    get body() {
      onRead();
      throw new Error("Request body must not be read.");
    },
    async json() {
      onRead();
      throw new Error("Request body must not be parsed as JSON.");
    },
    async text() {
      onRead();
      throw new Error("Request body must not be read as text.");
    },
    async arrayBuffer() {
      onRead();
      throw new Error("Request body must not be read as bytes.");
    },
  } as unknown as Request;
}

Deno.test("telegram-webhook rejects missing Telegram secret before body read", async () => {
  let bodyRead = false;

  const response = handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      { "content-type": "application/json" },
      () => {
        bodyRead = true;
      },
    ),
  );

  const body = await readJson(response);

  assertEquals(response.status, 401);
  assertEquals(body.ok, false);
  assertEquals(body.status, "webhook_verification_failed");
  assertEquals(body.message, "Telegram webhook verification failed.");
  assert(!bodyRead, "Webhook body must not be read before secret verification.");
});

Deno.test("telegram-webhook returns inert not_configured response without reading body", async () => {
  let bodyRead = false;

  const response = handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "application/json",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
  );

  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.ok, false);
  assertEquals(body.status, "not_configured");
  assertEquals(body.message, "Telegram webhook is planned but not enabled yet.");
  assert(!bodyRead, "Inert webhook skeleton must not parse or read the request body.");
});

Deno.test("telegram-webhook rejects unsupported content type after secret verification", async () => {
  let bodyRead = false;

  const response = handleTelegramWebhookRequest(
    requestThatFailsIfBodyIsRead(
      {
        "content-type": "text/plain",
        "x-telegram-bot-api-secret-token": "test-webhook-secret",
      },
      () => {
        bodyRead = true;
      },
    ),
  );

  const body = await readJson(response);

  assertEquals(response.status, 415);
  assertEquals(body.status, "unsupported_media_type");
  assert(!bodyRead, "Unsupported webhook content type must not read request body.");
});

Deno.test("telegram-webhook body size header validator rejects oversized requests", () => {
  let error: unknown;

  try {
    assertBodySizeFromHeaders(
      new Headers({ "content-length": String(maxTelegramWebhookBodyBytes + 1) }),
      maxTelegramWebhookBodyBytes,
    );
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof HttpError, "Oversized Content-Length must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 413);
  assertEquals((error as HttpError).code, "payload_too_large");
});

Deno.test("telegram-webhook sanitizer redacts secret-like server errors", () => {
  const sanitized = sanitizeErrorMessage("raw sb_secret_testvalue and jwt eyJabc.def.ghi leaked");

  assert(sanitized.includes("sb_secret_[hidden]"), "Secret-like value must be redacted.");
  assert(sanitized.includes("jwt_[hidden]"), "JWT-like value must be redacted.");
  assert(!sanitized.includes("sb_secret_testvalue"), "Raw secret marker must not be returned.");
  assert(!sanitized.includes("eyJabc.def.ghi"), "Raw JWT marker must not be returned.");
});
