import { HttpError } from "./core.ts";
import {
  assertTelegramAgentBrainCommand,
  assertTelegramAgentBrainReply,
  buildTelegramAgentBrainRequest,
  generateTelegramAgentBrainReply,
} from "./agent-brain.ts";

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

function assertNoSensitiveMaterial(value: unknown) {
  const serialized = JSON.stringify(value);
  const forbidden = [
    "1234567890:abcdefghijklmnopqrstuvwxyz",
    "sb_secret_private",
    "token_secret_ref",
    "webhook_secret",
    "owner_user_id",
    "workspace_id",
    "telegramUserId",
    "telegramChatId",
    "api.telegram.org",
    "<script>",
    "`",
  ];

  for (const fragment of forbidden) {
    assert(
      !serialized.includes(fragment),
      `Serialized value leaked ${fragment}.`,
    );
  }
}

Deno.test("telegram agent brain request is read-only and sanitized", () => {
  const request = buildTelegramAgentBrainRequest({
    command: "agent",
    agentName:
      "Kyra <script> 1234567890:abcdefghijklmnopqrstuvwxyz owner_user_id",
    agentRole: "workspace_id strategist\nwebhook_secret",
    capabilities: [
      "status",
      "token_secret_ref",
      "api.telegram.org",
      "actions",
      "wallet approval",
      "Base context",
      "extra ignored",
    ],
  });

  assertEquals(request.mode, "read_only");
  assertEquals(request.maxOutputCharacters, 700);
  assertEquals(request.messages.length, 2);
  assertEquals(request.messages[0].role, "system");
  assertEquals(request.messages[1].role, "user");
  assert(
    request.messages[0].content.includes("Answer only in read-only mode."),
    "System prompt must enforce read-only mode.",
  );
  assert(
    request.messages[0].content.includes("Do not claim"),
    "System prompt must forbid execution claims.",
  );
  assert(
    request.messages[1].content.includes("Command: /agent"),
    "User prompt must include only the normalized command.",
  );
  assertNoSensitiveMaterial(request);
});

Deno.test("telegram agent brain accepts only read-only commands", () => {
  assertEquals(assertTelegramAgentBrainCommand("help"), "help");
  assertEquals(assertTelegramAgentBrainCommand("status"), "status");
  assertEquals(assertTelegramAgentBrainCommand("agent"), "agent");
  assertEquals(assertTelegramAgentBrainCommand("actions"), "actions");
  assertEquals(assertTelegramAgentBrainCommand("modules"), "modules");
});

Deno.test("telegram agent brain rejects unsupported commands safely", async () => {
  const rawCommand = "swap 10 USDC private";
  const error = await assertRejectsHttpError(
    () => assertTelegramAgentBrainCommand(rawCommand),
    422,
    "unsupported_update",
  );
  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
  });

  assertEquals(error.message, "Telegram update is not supported.");
  assert(!serialized.includes(rawCommand), "Error must not echo raw command.");
});

Deno.test("telegram agent brain provider receives bounded request and returns reply", async () => {
  let capturedRequest: unknown = null;
  const reply = await generateTelegramAgentBrainReply(
    {
      command: "actions",
      agentName: "Kyra Strategist",
      agentRole: "market planning",
      capabilities: ["help", "status", "agent", "actions", "modules"],
    },
    {
      async complete(request) {
        capturedRequest = request;
        return {
          text: "Read-only commands are available. Wallet actions remain disabled.",
        };
      },
    },
  );

  assertEquals(
    reply.text,
    "Read-only commands are available. Wallet actions remain disabled.",
  );
  assertNoSensitiveMaterial(capturedRequest);
});

Deno.test("telegram agent brain validates provider response shape", async () => {
  await assertRejectsHttpError(
    () => assertTelegramAgentBrainReply({ text: "ok", raw: "private" }),
    502,
    "agent_brain_invalid_response",
  );
  await assertRejectsHttpError(
    () => assertTelegramAgentBrainReply({ text: "" }),
    502,
    "agent_brain_invalid_response",
  );
  await assertRejectsHttpError(
    () => assertTelegramAgentBrainReply({ text: "x".repeat(701) }),
    502,
    "agent_brain_invalid_response",
  );
});

Deno.test("telegram agent brain rejects sensitive or unsafe provider text", async () => {
  const unsafeTexts = [
    "Bot token 1234567890:abcdefghijklmnopqrstuvwxyz",
    "Internal token_secret_ref should never appear.",
    "The transaction executed successfully.",
    "Wallet approved the swap.",
    "Here is a seed phrase.",
  ];

  for (const text of unsafeTexts) {
    const error = await assertRejectsHttpError(
      () => assertTelegramAgentBrainReply({ text }),
      502,
      "agent_brain_invalid_response",
    );

    assertEquals(
      error.message,
      "Kyra agent brain returned an invalid response.",
    );
  }
});

Deno.test("telegram agent brain sanitizes provider failures", async () => {
  const rawError = "provider failed with 1234567890:abcdefghijklmnopqrstuvwxyz";
  const error = await assertRejectsHttpError(
    () =>
      generateTelegramAgentBrainReply(
        { command: "status" },
        {
          async complete() {
            throw new Error(rawError);
          },
        },
      ),
    503,
    "agent_brain_unavailable",
  );
  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
  });

  assertEquals(error.message, "Kyra agent brain is unavailable.");
  assert(!serialized.includes(rawError), "Provider error must be hidden.");
});
