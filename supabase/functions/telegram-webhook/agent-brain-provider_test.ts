import { HttpError } from "./core.ts";
import { generateTelegramAgentBrainReply } from "./agent-brain.ts";
import {
  buildOpenAiCompatibleAgentBrainPayload,
  createOpenAiCompatibleTelegramAgentBrainProvider,
  type TelegramAgentBrainProviderFetch,
} from "./agent-brain-provider.ts";

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

const testApiKey = "test-provider-key";
const testModel = "gpt-test-safe";
const testRequest = {
  mode: "read_only" as const,
  maxOutputCharacters: 700,
  messages: [
    {
      role: "system" as const,
      content: "Answer only in read-only mode.",
    },
    {
      role: "user" as const,
      content: "Command: /agent\nAgent: Kyra\nAllowed capabilities: status",
    },
  ],
};

Deno.test("telegram agent brain provider builds bounded OpenAI-compatible payload", () => {
  const payload = buildOpenAiCompatibleAgentBrainPayload(
    testRequest,
    testModel,
  );
  const serialized = JSON.stringify(payload);
  const input = "input" in payload ? payload.input : null;

  assertEquals(payload.model, testModel);
  if (!Array.isArray(input)) {
    throw new Error("Responses payload must include input.");
  }
  assertEquals(input.length, 2);
  assertEquals(payload.max_output_tokens, 220);
  assertEquals(payload.temperature, 0.2);
  assertEquals(payload.metadata.kyra_surface, "telegram");
  assertEquals(payload.metadata.kyra_mode, "read_only");
  assert(
    !serialized.includes(testApiKey),
    "Provider payload must not include API keys.",
  );
});

Deno.test("telegram agent brain provider builds chat completions payload for OpenRouter", () => {
  const payload = buildOpenAiCompatibleAgentBrainPayload(
    testRequest,
    "openai/gpt-test-safe",
    "https://openrouter.ai/api/v1/chat/completions",
  );
  const serialized = JSON.stringify(payload);
  const messages = "messages" in payload ? payload.messages : null;

  assertEquals(payload.model, "openai/gpt-test-safe");
  if (!Array.isArray(messages)) {
    throw new Error("Chat completions payload must include messages.");
  }
  assertEquals(messages.length, 2);
  assertEquals(payload.max_completion_tokens, 220);
  assertEquals(payload.temperature, 0.2);
  assertEquals(payload.metadata.kyra_surface, "telegram");
  assertEquals(payload.metadata.kyra_mode, "read_only");
  assert(
    !("input" in payload),
    "Chat completions payload must not use Responses API input.",
  );
  assert(
    !serialized.includes(testApiKey),
    "Provider payload must not include API keys.",
  );
});

Deno.test("telegram agent brain provider sends sanitized request with fake fetch", async () => {
  let capturedUrl = "";
  let capturedAuthorization = "";
  let capturedContentType = "";
  let capturedBody = "";
  let signalWasProvided = false;
  const fetchProvider: TelegramAgentBrainProviderFetch = async (url, init) => {
    capturedUrl = url;
    capturedAuthorization = String(
      new Headers(init?.headers).get("authorization") ?? "",
    );
    capturedContentType = String(
      new Headers(init?.headers).get("content-type") ?? "",
    );
    capturedBody = String(init?.body ?? "");
    signalWasProvided = init?.signal instanceof AbortSignal;

    return jsonResponse({
      output_text:
        "Kyra can answer read-only agent questions. Wallet actions stay gated.",
    });
  };
  const provider = createOpenAiCompatibleTelegramAgentBrainProvider({
    apiKey: testApiKey,
    model: testModel,
    endpoint: "https://llm.test/v1/responses",
    fetch: fetchProvider,
    timeoutMs: 1000,
  });

  const reply = await generateTelegramAgentBrainReply(
    {
      command: "agent",
      agentName: "Kyra",
      agentRole: "Telegram read-only agent",
      capabilities: ["status", "agent", "actions"],
    },
    provider,
  );
  const payload = JSON.parse(capturedBody);

  assertEquals(capturedUrl, "https://llm.test/v1/responses");
  assertEquals(capturedAuthorization, `Bearer ${testApiKey}`);
  assertEquals(capturedContentType, "application/json");
  assertEquals(signalWasProvided, true);
  assertEquals(payload.model, testModel);
  assert(
    !capturedBody.includes(testApiKey),
    "Request body must not include API key.",
  );
  assertEquals(
    reply.text,
    "Kyra can answer read-only agent questions. Wallet actions stay gated.",
  );
});

Deno.test("telegram agent brain provider validates config before fetch", async () => {
  let fetchCalled = false;
  const fetchProvider: TelegramAgentBrainProviderFetch = async () => {
    fetchCalled = true;
    return jsonResponse({ output_text: "ok" });
  };

  await assertRejectsHttpError(
    () =>
      createOpenAiCompatibleTelegramAgentBrainProvider({
        apiKey: "",
        model: testModel,
        fetch: fetchProvider,
      }),
    503,
    "agent_brain_unavailable",
  );

  await assertRejectsHttpError(
    () =>
      createOpenAiCompatibleTelegramAgentBrainProvider({
        apiKey: testApiKey,
        model: "bad model with spaces",
        fetch: fetchProvider,
      }),
    503,
    "agent_brain_unavailable",
  );

  await assertRejectsHttpError(
    () =>
      createOpenAiCompatibleTelegramAgentBrainProvider({
        apiKey: testApiKey,
        model: testModel,
        endpoint: "http://llm.test/v1/responses",
        fetch: fetchProvider,
      }),
    503,
    "agent_brain_unavailable",
  );

  assert(!fetchCalled, "Invalid provider config must not call fetch.");
});

Deno.test("telegram agent brain provider supports common response envelopes", async () => {
  const outputArrayProvider = createOpenAiCompatibleTelegramAgentBrainProvider({
    apiKey: testApiKey,
    model: testModel,
    fetch: async () =>
      jsonResponse({
        output: [
          {
            content: [
              {
                text: "Template modules are available in read-only mode.",
              },
            ],
          },
        ],
      }),
  });
  const chatProvider = createOpenAiCompatibleTelegramAgentBrainProvider({
    apiKey: testApiKey,
    model: testModel,
    fetch: async () =>
      jsonResponse({
        choices: [
          {
            message: {
              content: "Approval policy remains dashboard-gated.",
            },
          },
        ],
      }),
  });

  const outputArrayReply = await outputArrayProvider.complete(testRequest);
  const chatReply = await chatProvider.complete(testRequest);

  assertEquals(
    (outputArrayReply as { text: string }).text,
    "Template modules are available in read-only mode.",
  );
  assertEquals(
    (chatReply as { text: string }).text,
    "Approval policy remains dashboard-gated.",
  );
});

Deno.test("telegram agent brain provider supports OpenRouter chat completions", async () => {
  const openRouterModel = "openai/gpt-test-safe";
  let capturedUrl = "";
  let capturedAuthorization = "";
  let capturedBody = "";
  const provider = createOpenAiCompatibleTelegramAgentBrainProvider({
    apiKey: testApiKey,
    model: openRouterModel,
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    fetch: async (url, init) => {
      capturedUrl = url;
      capturedAuthorization = String(
        new Headers(init?.headers).get("authorization") ?? "",
      );
      capturedBody = String(init?.body ?? "");

      return jsonResponse({
        choices: [
          {
            message: {
              content: "OpenRouter read-only response.",
            },
          },
        ],
      });
    },
  });

  const reply = await generateTelegramAgentBrainReply(
    {
      command: "agent",
      agentName: "Kyra",
      agentRole: "Telegram read-only agent",
      capabilities: ["agent"],
    },
    provider,
  );
  const payload = JSON.parse(capturedBody);

  assertEquals(capturedUrl, "https://openrouter.ai/api/v1/chat/completions");
  assertEquals(capturedAuthorization, `Bearer ${testApiKey}`);
  assertEquals(payload.model, openRouterModel);
  assertEquals(payload.messages.length, 2);
  assertEquals(payload.max_completion_tokens, 220);
  assert(
    !("input" in payload),
    "OpenRouter request must use chat completions messages.",
  );
  assert(
    !capturedBody.includes(testApiKey),
    "Request body must not include API key.",
  );
  assertEquals(reply.text, "OpenRouter read-only response.");
});

Deno.test("telegram agent brain provider maps provider failures safely", async () => {
  const rawSecret = "1234567890:abcdefghijklmnopqrstuvwxyz";
  const rateLimitedProvider = createOpenAiCompatibleTelegramAgentBrainProvider({
    apiKey: testApiKey,
    model: testModel,
    fetch: async () =>
      jsonResponse({ error: { message: `rate limit ${rawSecret}` } }, 429),
  });
  const malformedProvider = createOpenAiCompatibleTelegramAgentBrainProvider({
    apiKey: testApiKey,
    model: testModel,
    fetch: async () => new Response("{bad json", { status: 200 }),
  });
  const networkProvider = createOpenAiCompatibleTelegramAgentBrainProvider({
    apiKey: testApiKey,
    model: testModel,
    fetch: async () => {
      throw new Error(`raw provider failure ${rawSecret}`);
    },
  });

  const rateLimitedError = await assertRejectsHttpError(
    () => rateLimitedProvider.complete(testRequest),
    503,
    "agent_brain_unavailable",
  );
  const malformedError = await assertRejectsHttpError(
    () => malformedProvider.complete(testRequest),
    502,
    "agent_brain_invalid_response",
  );
  const networkError = await assertRejectsHttpError(
    () => networkProvider.complete(testRequest),
    503,
    "agent_brain_unavailable",
  );
  const serialized = JSON.stringify({
    rateLimited: rateLimitedError.message,
    malformed: malformedError.message,
    network: networkError.message,
  });

  assert(
    !serialized.includes(rawSecret),
    "Provider errors must not leak raw provider details.",
  );
});

Deno.test("telegram agent brain provider timeout is sanitized", async () => {
  const provider = createOpenAiCompatibleTelegramAgentBrainProvider({
    apiKey: testApiKey,
    model: testModel,
    timeoutMs: 1,
    fetch: (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("Request aborted", "AbortError"));
        });
      }),
  });

  const error = await assertRejectsHttpError(
    () => provider.complete(testRequest),
    503,
    "agent_brain_unavailable",
  );

  assertEquals(error.message, "Kyra agent brain is unavailable.");
});
