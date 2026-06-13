import { HttpError } from "./core.ts";
import {
  assertTokenSecretRef,
  createMockTelegramBotTokenSecretStore,
  createRpcTelegramBotTokenSecretStore,
  sanitizeSecretStoreError,
  type TelegramSecretStoreRpcClient,
} from "./secret-store.ts";

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

const testAgentId = "11111111-1111-4111-8111-111111111111";
const testOwnerUserId = "33333333-3333-4333-8333-333333333333";
const testTelegramBotId = "987654321";
const testBotToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
const testTokenSecretRef = "vault:telegram_token_ref_000001";

interface RpcCall {
  functionName: string;
  args: Record<string, unknown>;
}

function createMockRpcClient(
  results: Array<{ data: unknown; error: unknown }>,
) {
  const calls: RpcCall[] = [];
  const client: TelegramSecretStoreRpcClient = {
    async rpc(functionName, args) {
      calls.push({ functionName, args });

      return results.shift() ?? { data: null, error: null };
    },
  };

  return { client, calls };
}

Deno.test("mock telegram secret store returns opaque token ref", async () => {
  const store = createMockTelegramBotTokenSecretStore();

  const result = await store.storeTelegramBotToken({
    agentId: testAgentId,
    ownerUserId: testOwnerUserId,
    telegramBotId: testTelegramBotId,
    botToken: testBotToken,
  });
  const serialized = JSON.stringify(result);

  assertEquals(result.provider, "mock");
  assert(
    result.tokenSecretRef.startsWith("mock_telegram_token_ref_"),
    "Token ref must be mock namespaced.",
  );
  assert(
    !serialized.includes(testBotToken),
    "Store result must not expose botToken.",
  );
  assert(
    !serialized.includes(testAgentId),
    "Mock token ref must not encode agentId.",
  );
  assert(
    !serialized.includes(testOwnerUserId),
    "Mock token ref must not encode ownerUserId.",
  );
  assert(
    !serialized.includes(testTelegramBotId),
    "Mock token ref must not encode telegramBotId.",
  );
});

Deno.test("mock telegram secret store resolves token only by opaque ref", async () => {
  const store = createMockTelegramBotTokenSecretStore();
  const stored = await store.storeTelegramBotToken({
    agentId: testAgentId,
    ownerUserId: testOwnerUserId,
    telegramBotId: testTelegramBotId,
    botToken: testBotToken,
  });

  const resolved = await store.resolveTelegramBotToken({
    tokenSecretRef: stored.tokenSecretRef,
  });

  assertEquals(resolved.botToken, testBotToken);
});

Deno.test("mock telegram secret store revokes token ref", async () => {
  const store = createMockTelegramBotTokenSecretStore();
  const stored = await store.storeTelegramBotToken({
    agentId: testAgentId,
    ownerUserId: testOwnerUserId,
    telegramBotId: testTelegramBotId,
    botToken: testBotToken,
  });

  const revoked = await store.revokeTelegramBotToken({
    tokenSecretRef: stored.tokenSecretRef,
  });
  const error = await captureError(() =>
    store.resolveTelegramBotToken({
      tokenSecretRef: stored.tokenSecretRef,
    })
  );

  assertEquals(revoked.revoked, true);
  assert(
    error instanceof HttpError,
    "Missing revoked secret must throw HttpError.",
  );
  assertEquals((error as HttpError).statusCode, 404);
  assertEquals((error as HttpError).code, "secret_not_found");
});

Deno.test("mock telegram secret store rejects invalid tokenSecretRef", async () => {
  const store = createMockTelegramBotTokenSecretStore();
  const error = await captureError(() =>
    store.resolveTelegramBotToken({
      tokenSecretRef: "../secret",
    })
  );

  assert(error instanceof HttpError, "Invalid ref must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
  assertEquals((error as HttpError).message, "tokenSecretRef is invalid.");
});

Deno.test("mock telegram secret store validates required input without leaking token", async () => {
  const store = createMockTelegramBotTokenSecretStore();
  const error = await captureError(() =>
    store.storeTelegramBotToken({
      agentId: testAgentId,
      ownerUserId: testOwnerUserId,
      telegramBotId: testTelegramBotId,
      botToken: "",
    })
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "Missing botToken must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
  assertEquals((error as HttpError).message, "botToken is required.");
  assert(!serialized.includes(testBotToken), "Error must not expose botToken.");
});

Deno.test("telegram token secret ref validator accepts opaque refs", () => {
  const tokenSecretRef = assertTokenSecretRef("mock_telegram_token_ref_000001");

  assertEquals(tokenSecretRef, "mock_telegram_token_ref_000001");
});

Deno.test("telegram token secret ref validator rejects missing refs", async () => {
  const error = await captureError(() => assertTokenSecretRef(""));

  assert(error instanceof HttpError, "Missing token ref must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
  assertEquals((error as HttpError).message, "tokenSecretRef is required.");
});

Deno.test("secret store sanitizer keeps HttpError but hides unexpected failures", () => {
  const known = new HttpError(
    503,
    "secret_store_unavailable",
    "Secret store unavailable.",
  );
  const unknown = new Error(`raw failure for ${testBotToken}`);

  const knownResult = sanitizeSecretStoreError(known);
  const unknownResult = sanitizeSecretStoreError(unknown);
  const serializedUnknown = JSON.stringify(unknownResult);

  assertEquals(knownResult, known);
  assertEquals(unknownResult.statusCode, 500);
  assertEquals(unknownResult.code, "server_error");
  assertEquals(unknownResult.message, "Telegram token secret store failed.");
  assert(
    !serializedUnknown.includes(testBotToken),
    "Sanitized error must not expose botToken.",
  );
});

Deno.test("rpc telegram secret store stores through injected rpc and returns only token ref", async () => {
  const { client, calls } = createMockRpcClient([
    { data: testTokenSecretRef, error: null },
  ]);
  const store = createRpcTelegramBotTokenSecretStore(client);

  const result = await store.storeTelegramBotToken({
    agentId: testAgentId,
    ownerUserId: testOwnerUserId,
    telegramBotId: testTelegramBotId,
    botToken: testBotToken,
  });
  const serializedResult = JSON.stringify(result);

  assertEquals(calls.length, 1);
  assertEquals(calls[0].functionName, "store_telegram_bot_token");
  assertEquals(calls[0].args.p_agent_id, testAgentId);
  assertEquals(calls[0].args.p_owner_user_id, testOwnerUserId);
  assertEquals(calls[0].args.p_telegram_bot_id, testTelegramBotId);
  assertEquals(calls[0].args.p_bot_token, testBotToken);
  assertEquals(result.provider, "supabase_vault");
  assertEquals(result.tokenSecretRef, testTokenSecretRef);
  assert(
    !serializedResult.includes(testBotToken),
    "Store result must not expose botToken.",
  );
  assert(
    !serializedResult.includes(testAgentId),
    "Store result must not expose agentId.",
  );
  assert(
    !serializedResult.includes(testOwnerUserId),
    "Store result must not expose ownerUserId.",
  );
  assert(
    !serializedResult.includes(testTelegramBotId),
    "Store result must not expose telegramBotId.",
  );
});

Deno.test("rpc telegram secret store resolves only after token ref validation", async () => {
  const { client, calls } = createMockRpcClient([
    { data: testBotToken, error: null },
  ]);
  const store = createRpcTelegramBotTokenSecretStore(client);

  const resolved = await store.resolveTelegramBotToken({
    tokenSecretRef: testTokenSecretRef,
  });

  assertEquals(calls.length, 1);
  assertEquals(calls[0].functionName, "resolve_telegram_bot_token");
  assertEquals(calls[0].args.p_token_secret_ref, testTokenSecretRef);
  assertEquals(resolved.botToken, testBotToken);
});

Deno.test("rpc telegram secret store rejects invalid resolve refs before rpc", async () => {
  const { client, calls } = createMockRpcClient([
    { data: testBotToken, error: null },
  ]);
  const store = createRpcTelegramBotTokenSecretStore(client);

  const error = await captureError(() =>
    store.resolveTelegramBotToken({
      tokenSecretRef: "../secret",
    })
  );

  assertEquals(calls.length, 0);
  assert(error instanceof HttpError, "Invalid ref must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
});

Deno.test("rpc telegram secret store revokes through injected rpc", async () => {
  const { client, calls } = createMockRpcClient([
    { data: true, error: null },
  ]);
  const store = createRpcTelegramBotTokenSecretStore(client);

  const revoked = await store.revokeTelegramBotToken({
    tokenSecretRef: testTokenSecretRef,
  });

  assertEquals(calls.length, 1);
  assertEquals(calls[0].functionName, "revoke_telegram_bot_token");
  assertEquals(calls[0].args.p_token_secret_ref, testTokenSecretRef);
  assertEquals(revoked.revoked, true);
});

Deno.test("rpc telegram secret store maps missing secret to sanitized 404", async () => {
  const { client } = createMockRpcClient([
    {
      data: null,
      error: {
        code: "secret_not_found",
        message: `raw ${testTokenSecretRef} ${testBotToken}`,
      },
    },
  ]);
  const store = createRpcTelegramBotTokenSecretStore(client);

  const error = await captureError(() =>
    store.resolveTelegramBotToken({
      tokenSecretRef: testTokenSecretRef,
    })
  );
  const serializedError = JSON.stringify(error);

  assert(error instanceof HttpError, "Missing secret must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 404);
  assertEquals((error as HttpError).code, "secret_not_found");
  assertEquals(
    (error as HttpError).message,
    "Telegram token secret was not found.",
  );
  assert(
    !serializedError.includes(testTokenSecretRef),
    "Sanitized error must not expose tokenSecretRef.",
  );
  assert(
    !serializedError.includes(testBotToken),
    "Sanitized error must not expose botToken.",
  );
});

Deno.test("rpc telegram secret store maps duplicate bot conflicts to sanitized duplicate status", async () => {
  const { client } = createMockRpcClient([
    {
      data: null,
      error: {
        code: "23505",
        message:
          `telegram_bot_already_connected ${testBotToken} ${testOwnerUserId} ${testTokenSecretRef}`,
      },
    },
  ]);
  const store = createRpcTelegramBotTokenSecretStore(client);

  const error = await captureError(() =>
    store.storeTelegramBotToken({
      agentId: testAgentId,
      ownerUserId: testOwnerUserId,
      telegramBotId: testTelegramBotId,
      botToken: testBotToken,
    })
  );
  const serializedError = JSON.stringify(error);

  assert(error instanceof HttpError, "Duplicate bot error must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 409);
  assertEquals((error as HttpError).code, "duplicate_bot_active");
  assertEquals((error as HttpError).message, "Telegram bot is already connected.");
  assert(
    !serializedError.includes(testBotToken),
    "Sanitized error must not expose botToken.",
  );
  assert(
    !serializedError.includes(testOwnerUserId),
    "Sanitized error must not expose ownerUserId.",
  );
  assert(
    !serializedError.includes(testTokenSecretRef),
    "Sanitized error must not expose tokenSecretRef.",
  );
});

Deno.test("rpc telegram secret store sanitizes rpc availability errors", async () => {
  const { client } = createMockRpcClient([
    {
      data: null,
      error: {
        code: "PGRST999",
        message:
          `raw db error ${testBotToken} ${testOwnerUserId} ${testTokenSecretRef}`,
      },
    },
  ]);
  const store = createRpcTelegramBotTokenSecretStore(client);

  const error = await captureError(() =>
    store.storeTelegramBotToken({
      agentId: testAgentId,
      ownerUserId: testOwnerUserId,
      telegramBotId: testTelegramBotId,
      botToken: testBotToken,
    })
  );
  const serializedError = JSON.stringify(error);

  assert(error instanceof HttpError, "RPC error must throw HttpError.");
  assertEquals((error as HttpError).statusCode, 503);
  assertEquals((error as HttpError).code, "secret_store_unavailable");
  assertEquals(
    (error as HttpError).message,
    "Telegram token secret store is unavailable.",
  );
  assert(
    !serializedError.includes(testBotToken),
    "Sanitized error must not expose botToken.",
  );
  assert(
    !serializedError.includes(testOwnerUserId),
    "Sanitized error must not expose ownerUserId.",
  );
  assert(
    !serializedError.includes(testTokenSecretRef),
    "Sanitized error must not expose tokenSecretRef.",
  );
});

Deno.test("rpc telegram secret store sanitizes invalid rpc responses", async () => {
  const { client } = createMockRpcClient([
    { data: { token_secret_ref: testTokenSecretRef }, error: null },
  ]);
  const store = createRpcTelegramBotTokenSecretStore(client);

  const error = await captureError(() =>
    store.storeTelegramBotToken({
      agentId: testAgentId,
      ownerUserId: testOwnerUserId,
      telegramBotId: testTelegramBotId,
      botToken: testBotToken,
    })
  );
  const serializedError = JSON.stringify(error);

  assert(error instanceof HttpError, "Invalid RPC response must throw.");
  assertEquals((error as HttpError).statusCode, 503);
  assertEquals((error as HttpError).code, "secret_store_unavailable");
  assert(
    !serializedError.includes(testTokenSecretRef),
    "Sanitized error must not expose tokenSecretRef.",
  );
  assert(
    !serializedError.includes(testBotToken),
    "Sanitized error must not expose botToken.",
  );
});
