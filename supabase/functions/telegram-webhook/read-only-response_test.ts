import { HttpError } from "./core.ts";
import { buildTelegramReadOnlyCommandResponse } from "./read-only-response.ts";

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

function assertThrowsHttpError(
  action: () => unknown,
  expectedStatusCode: number,
  expectedCode: string,
) {
  let error: unknown;

  try {
    action();
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof HttpError, "Expected action to throw HttpError.");
  assertEquals((error as HttpError).statusCode, expectedStatusCode);
  assertEquals((error as HttpError).code, expectedCode);

  return error as HttpError;
}

function assertSafeStaticResponse(text: string) {
  const forbiddenPatterns = [
    /https?:\/\//i,
    /@[A-Za-z0-9_]+/,
    /token/i,
    /secret/i,
    /owner_user_id/i,
    /workspace_id/i,
    /telegramUserId/i,
    /telegramChatId/i,
    /<[^>]+>/,
    /[*_[\]`]/,
  ];

  assert(text.length > 0, "Response text must not be empty.");
  assert(text.length <= 240, "Response text must remain bounded.");

  for (const pattern of forbiddenPatterns) {
    assert(!pattern.test(text), `Response text matched forbidden ${pattern}.`);
  }
}

Deno.test("telegram read-only help response is static and limited", () => {
  const response = buildTelegramReadOnlyCommandResponse("help");
  const serialized = JSON.stringify(response);

  assertEquals(response.command, "help");
  assert(response.text.includes("/help"), "Help response must list /help.");
  assert(response.text.includes("/status"), "Help response must list /status.");
  assert(
    response.text.includes("actions are disabled"),
    "Help response must state disabled actions.",
  );
  assertEquals(Object.keys(response).sort().join(","), "command,text");
  assert(!serialized.includes("private"), "Help response must remain static.");
  assertSafeStaticResponse(response.text);
});

Deno.test("telegram read-only status response is static and safety-scoped", () => {
  const response = buildTelegramReadOnlyCommandResponse("status");

  assertEquals(response.command, "status");
  assert(
    response.text.includes("session: active"),
    "Status response must require active-session caller precondition.",
  );
  assert(
    response.text.includes("Command access: read-only"),
    "Status response must state read-only access.",
  );
  assert(
    response.text.includes("actions: disabled"),
    "Status response must state disabled actions.",
  );
  assertEquals(Object.keys(response).sort().join(","), "command,text");
  assertSafeStaticResponse(response.text);
});

Deno.test("telegram read-only response builder rejects unsupported commands safely", () => {
  const rawCommand = "approve-private-wallet";
  const error = assertThrowsHttpError(
    () => buildTelegramReadOnlyCommandResponse(rawCommand),
    422,
    "unsupported_update",
  );
  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
  });

  assertEquals(error.message, "Telegram update is not supported.");
  assert(
    !serialized.includes(rawCommand),
    "Unsupported command error must not echo command text.",
  );
});
