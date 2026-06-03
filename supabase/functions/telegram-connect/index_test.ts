import {
  assertBodySizeFromHeaders,
  handleTelegramConnectRequest,
  HttpError,
  maxTelegramConnectBodyBytes,
  readJsonObjectBody,
  sanitizeErrorMessage,
} from "./core.ts";

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

function makeConnectRequest(init: {
  body?: string;
  contentType?: string;
  authorization?: string;
} = {}) {
  const headers = new Headers();

  if (init.contentType !== undefined) {
    headers.set("content-type", init.contentType);
  }

  if (init.authorization !== undefined) {
    headers.set("authorization", init.authorization);
  }

  return new Request("https://kyra.test/functions/v1/telegram-connect", {
    method: "POST",
    headers,
    body: init.body ?? JSON.stringify({ agentId: "agent_123" }),
  });
}

Deno.test("telegram-connect returns inert not_configured response without echoing botToken", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: "agent_123",
        botToken: "123456:future-secret-token",
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: "user_123" }),
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 501);
  assertEquals(body.ok, false);
  assertEquals(body.status, "not_configured");
  assertEquals(body.message, "Telegram connect is planned but not enabled yet.");
  assert(!serializedBody.includes("123456:future-secret-token"), "Response must not echo botToken.");
});

Deno.test("telegram-connect rejects invalid JSON with sanitized 400 behavior", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: "{invalid-json",
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: "user_123" }),
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 400);
  assertEquals(body.ok, false);
  assertEquals(body.status, "invalid_request");
  assertEquals(body.message, "Request body must be valid JSON.");
  assert(!serializedBody.includes("{invalid-json"), "Invalid raw JSON must not be echoed.");
});

Deno.test("telegram-connect rejects missing bearer authorization", async () => {
  let envRead = false;
  let sessionChecked = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      contentType: "application/json",
      body: JSON.stringify({ agentId: "agent_123" }),
    }),
    {
      getEnv: () => {
        envRead = true;
        return "test-value";
      },
      getUser: async () => {
        sessionChecked = true;
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 401);
  assertEquals(body.ok, false);
  assertEquals(body.status, "unauthorized");
  assertEquals(body.message, "A valid Supabase session is required.");
  assert(!envRead, "Missing bearer must not read Edge Function env.");
  assert(!sessionChecked, "Missing bearer must not validate a session.");
});

Deno.test("telegram-connect returns unauthorized when session validation rejects", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer invalid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({ agentId: "agent_123" }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => {
        throw new HttpError(401, "unauthorized", "A valid Supabase session is required.");
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 401);
  assertEquals(body.ok, false);
  assertEquals(body.status, "unauthorized");
  assertEquals(body.message, "A valid Supabase session is required.");
});

Deno.test("telegram-connect rejects unsupported content type before env/session work", async () => {
  let envRead = false;
  let sessionChecked = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "text/plain",
      body: "agentId=agent_123",
    }),
    {
      getEnv: () => {
        envRead = true;
        return "test-value";
      },
      getUser: async () => {
        sessionChecked = true;
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 415);
  assertEquals(body.status, "unsupported_media_type");
  assert(!envRead, "Unsupported content type must not read Edge Function env.");
  assert(!sessionChecked, "Unsupported content type must not validate a session.");
});

Deno.test("telegram-connect rejects oversized content-length before env/session work", async () => {
  let envRead = false;
  const headers = new Headers({
    authorization: "Bearer valid-test-jwt",
    "content-type": "application/json",
    "content-length": String(maxTelegramConnectBodyBytes + 1),
  });

  const response = await handleTelegramConnectRequest(
    new Request("https://kyra.test/functions/v1/telegram-connect", {
      method: "POST",
      headers,
      body: JSON.stringify({ agentId: "agent_123" }),
    }),
    {
      getEnv: () => {
        envRead = true;
        return "test-value";
      },
      getUser: async () => ({ id: "user_123" }),
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 413);
  assertEquals(body.status, "payload_too_large");
  assert(!envRead, "Oversized body must not read Edge Function env.");
});

Deno.test("telegram-connect enforces streaming body size limit", async () => {
  let error: unknown;

  try {
    await readJsonObjectBody(
      new Request("https://kyra.test/functions/v1/telegram-connect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ agentId: "x".repeat(32) }),
      }),
      8,
    );
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof HttpError, "Oversized body must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 413);
  assertEquals((error as HttpError).code, "payload_too_large");
});

Deno.test("telegram-connect returns sanitized server errors", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => {
        throw new Error("raw sb_secret_testvalue and jwt eyJabc.def.ghi leaked");
      },
    },
  );

  const body = await readJson(response);
  const message = String(body.message);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assert(message.includes("sb_secret_[hidden]"), "Secret-like value must be redacted.");
  assert(message.includes("jwt_[hidden]"), "JWT-like value must be redacted.");
  assert(!message.includes("sb_secret_testvalue"), "Raw secret marker must not be returned.");
  assert(!message.includes("eyJabc.def.ghi"), "Raw JWT marker must not be returned.");
});

Deno.test("telegram-connect body size header validator rejects invalid sizes", () => {
  let error: unknown;

  try {
    assertBodySizeFromHeaders(new Headers({ "content-length": "-1" }), maxTelegramConnectBodyBytes);
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof HttpError, "Invalid Content-Length must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
});

Deno.test("telegram-connect sanitizer caps long messages", () => {
  const sanitized = sanitizeErrorMessage("x".repeat(400));

  assertEquals(sanitized.length, 240);
});
