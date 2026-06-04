import {
  assertBodySizeFromHeaders,
  handleTelegramConnectRequest,
  HttpError,
  isTelegramConnectGetMeEnabled,
  isTelegramConnectSessionWriteEnabled,
  isTelegramConnectStoreEnabled,
  isTelegramConnectWebhookRegisterEnabled,
  lookupAgentOwnershipRecord,
  maxTelegramConnectBodyBytes,
  persistTelegramSessionRecord,
  readJsonObjectBody,
  sanitizeErrorMessage,
  type TelegramConnectDependencies,
  telegramConnectGetMeEnabledEnvKey,
  telegramConnectSessionWriteEnabledEnvKey,
  telegramConnectStoreEnabledEnvKey,
  telegramConnectWebhookRegisterEnabledEnvKey,
} from "./core.ts";
import {
  createTelegramWebhookRegistrationRuntimeConfig,
  generateTelegramWebhookSecret,
  getTelegramWebhookUrl,
  telegramWebhookUrlEnvKey,
} from "./runtime-config.ts";

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

async function readJson(response: Response) {
  return await response.json() as Record<string, unknown>;
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
const testWorkspaceId = "22222222-2222-4222-8222-222222222222";
const testUserId = "33333333-3333-4333-8333-333333333333";
const otherUserId = "44444444-4444-4444-8444-444444444444";
const testTelegramBotId = "987654321";
const testTokenSecretRef =
  "vault:telegram:55555555-5555-4555-8555-555555555555";
const testSessionId = "66666666-6666-4666-8666-666666666666";
const testBotToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
const testWebhookUrl =
  "https://kyraagent.xyz/functions/v1/telegram-webhook/session-123";
const testWebhookSecretToken = "telegram_secret_token_123456789012";

interface LookupCall {
  table: string;
  columns: string;
  filters: Array<{ column: string; value: string }>;
}

function makeOwnershipLookupClient(options: {
  agent?: { id: string; workspace_id: string } | null;
  workspace?: { id: string; owner_user_id: string } | null;
  agentError?: Error | null;
  workspaceError?: Error | null;
}) {
  const calls: LookupCall[] = [];
  const client = {
    from(table: string) {
      const call: LookupCall = {
        table,
        columns: "",
        filters: [],
      };
      calls.push(call);

      const builder = {
        select(columns: string) {
          call.columns = columns;
          return builder;
        },
        eq(column: string, value: string) {
          call.filters.push({ column, value });
          return builder;
        },
        async maybeSingle() {
          if (table === "agent_instances") {
            return {
              data: options.agent ?? null,
              error: options.agentError ?? null,
            };
          }

          if (table === "workspaces") {
            return {
              data: options.workspace ?? null,
              error: options.workspaceError ?? null,
            };
          }

          return {
            data: null,
            error: new Error("Unexpected lookup table."),
          };
        },
      };

      return builder;
    },
  } as unknown as Parameters<typeof lookupAgentOwnershipRecord>[0];

  return { client, calls };
}

interface SessionPersistenceCall {
  table: string;
  operation: "lookup" | "update";
  columns: string;
  filters: Array<{ column: string; value: unknown }>;
  limit?: number;
  payload?: Record<string, unknown>;
}

function makeSessionPersistenceClient(options: {
  sessions?: Array<{ id: string }> | null;
  lookupError?: unknown;
  updated?: { id: string } | null;
  updateError?: unknown;
} = {}) {
  const calls: SessionPersistenceCall[] = [];
  const sessions = "sessions" in options
    ? options.sessions
    : [{ id: testSessionId }];
  const updated = "updated" in options
    ? options.updated
    : { id: testSessionId };

  const client = {
    from(table: string) {
      const call: SessionPersistenceCall = {
        table,
        operation: "lookup",
        columns: "",
        filters: [],
      };
      calls.push(call);

      const builder = {
        select(columns: string) {
          call.columns = columns;
          return builder;
        },
        update(payload: Record<string, unknown>) {
          call.operation = "update";
          call.payload = payload;
          return builder;
        },
        eq(column: string, value: unknown) {
          call.filters.push({ column, value });
          return builder;
        },
        is(column: string, value: unknown) {
          call.filters.push({ column, value });
          return builder;
        },
        async limit(value: number) {
          call.limit = value;
          return {
            data: sessions,
            error: options.lookupError ?? null,
          };
        },
        async maybeSingle() {
          return {
            data: updated,
            error: options.updateError ?? null,
          };
        },
      };

      return builder;
    },
  } as unknown as Parameters<typeof persistTelegramSessionRecord>[0];

  return { client, calls };
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
    body: init.body ?? JSON.stringify({ agentId: testAgentId }),
  });
}

function makeGatedDependencies(
  flagValue: string | null | undefined,
  options: {
    getUser?: TelegramConnectDependencies["getUser"];
    lookupAgentOwnership?: NonNullable<
      TelegramConnectDependencies["lookupAgentOwnership"]
    >;
    validateTelegramBotToken?: NonNullable<
      TelegramConnectDependencies["validateTelegramBotToken"]
    >;
  } = {},
) {
  const dependencies: TelegramConnectDependencies = {
    getEnv: () => "test-value",
    getUser: options.getUser ?? (async () => ({ id: testUserId })),
    lookupAgentOwnership: options.lookupAgentOwnership ??
      (async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      })),
  };

  if (isTelegramConnectGetMeEnabled(flagValue)) {
    dependencies.validateTelegramBotToken = options.validateTelegramBotToken ??
      (async () => ({
        telegramBotId: "987654321",
        username: "kyra_test_bot",
        firstName: "Kyra Test",
      }));
  }

  return dependencies;
}

function makeOptionalEnv(values: Record<string, string | undefined>) {
  return (key: string) => values[key] ?? "";
}

Deno.test("telegram-connect ownership lookup reads agent then workspace", async () => {
  const { client, calls } = makeOwnershipLookupClient({
    agent: {
      id: testAgentId,
      workspace_id: testWorkspaceId,
    },
    workspace: {
      id: testWorkspaceId,
      owner_user_id: testUserId,
    },
  });

  const ownership = await lookupAgentOwnershipRecord(client, testAgentId);
  const filterColumns = calls.flatMap((call) =>
    call.filters.map((filter) => filter.column)
  );

  assertEquals(ownership?.agentId, testAgentId);
  assertEquals(ownership?.workspaceId, testWorkspaceId);
  assertEquals(ownership?.ownerUserId, testUserId);
  assertEquals(calls.length, 2);
  assertEquals(calls[0].table, "agent_instances");
  assertEquals(calls[0].columns, "id,workspace_id");
  assertEquals(calls[0].filters[0].column, "id");
  assertEquals(calls[0].filters[0].value, testAgentId);
  assertEquals(calls[1].table, "workspaces");
  assertEquals(calls[1].columns, "id,owner_user_id");
  assertEquals(calls[1].filters[0].column, "id");
  assertEquals(calls[1].filters[0].value, testWorkspaceId);
  assert(
    !filterColumns.includes("owner_user_id"),
    "Ownership lookup must not filter by owner before distinguishing 404 and 403.",
  );
});

Deno.test("telegram-connect ownership lookup returns null when agent is missing", async () => {
  const { client, calls } = makeOwnershipLookupClient({
    agent: null,
    workspace: {
      id: testWorkspaceId,
      owner_user_id: testUserId,
    },
  });

  const ownership = await lookupAgentOwnershipRecord(client, testAgentId);

  assertEquals(ownership, null);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "agent_instances");
});

Deno.test("telegram-connect returns inert not_configured response without echoing botToken", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: "123456:future-secret-token",
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 501);
  assertEquals(body.ok, false);
  assertEquals(body.status, "not_configured");
  assertEquals(
    body.message,
    "Telegram connect is planned but not enabled yet.",
  );
  assert(
    !serializedBody.includes("123456:future-secret-token"),
    "Response must not echo botToken.",
  );
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
      getUser: async () => ({ id: testUserId }),
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 400);
  assertEquals(body.ok, false);
  assertEquals(body.status, "invalid_request");
  assertEquals(body.message, "Request body must be valid JSON.");
  assert(
    !serializedBody.includes("{invalid-json"),
    "Invalid raw JSON must not be echoed.",
  );
});

Deno.test("telegram-connect rejects missing bearer authorization", async () => {
  let envRead = false;
  let sessionChecked = false;
  let webhookUrlRead = false;
  let webhookSecretGenerated = false;
  let webhookRegistered = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      contentType: "application/json",
      body: JSON.stringify({ agentId: testAgentId }),
    }),
    {
      getEnv: () => {
        envRead = true;
        return "test-value";
      },
      getUser: async () => {
        sessionChecked = true;
      },
      getTelegramWebhookUrl: () => {
        webhookUrlRead = true;
        return testWebhookUrl;
      },
      generateTelegramWebhookSecret: () => {
        webhookSecretGenerated = true;
        return testWebhookSecretToken;
      },
      registerTelegramWebhook: async () => {
        webhookRegistered = true;
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
  assert(!webhookUrlRead, "Missing bearer must not read webhook URL.");
  assert(
    !webhookSecretGenerated,
    "Missing bearer must not generate webhook secrets.",
  );
  assert(!webhookRegistered, "Missing bearer must not register webhooks.");
});

Deno.test("telegram-connect returns unauthorized when session validation rejects", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer invalid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({ agentId: testAgentId }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => {
        throw new HttpError(
          401,
          "unauthorized",
          "A valid Supabase session is required.",
        );
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 401);
  assertEquals(body.ok, false);
  assertEquals(body.status, "unauthorized");
  assertEquals(body.message, "A valid Supabase session is required.");
});

Deno.test("telegram-connect rejects missing agentId", async () => {
  let ownershipLookupCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({}),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async () => {
        ownershipLookupCalled = true;
        return null;
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 400);
  assertEquals(body.ok, false);
  assertEquals(body.status, "invalid_request");
  assertEquals(body.message, "agentId is required.");
  assert(
    !ownershipLookupCalled,
    "Missing agentId must not run ownership lookup.",
  );
});

Deno.test("telegram-connect rejects non-UUID agentId", async () => {
  let ownershipLookupCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({ agentId: "agent_123" }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async () => {
        ownershipLookupCalled = true;
        return null;
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 400);
  assertEquals(body.ok, false);
  assertEquals(body.status, "invalid_request");
  assertEquals(body.message, "agentId is invalid.");
  assert(
    !ownershipLookupCalled,
    "Malformed agentId must not run ownership lookup.",
  );
});

Deno.test("telegram-connect returns 404 when ownership lookup misses agent", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({ agentId: testAgentId }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async () => null,
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 404);
  assertEquals(body.ok, false);
  assertEquals(body.status, "agent_not_found");
  assertEquals(body.message, "Agent was not found.");
  assert(
    !serializedBody.includes("owner_user_id"),
    "Response must not expose owner_user_id.",
  );
  assert(
    !serializedBody.includes("workspace_id"),
    "Response must not expose workspace_id.",
  );
});

Deno.test("telegram-connect returns 403 when ownership owner mismatches", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({ agentId: testAgentId }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async () => ({
        agentId: testAgentId,
        ownerUserId: otherUserId,
        workspaceId: testWorkspaceId,
      }),
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 403);
  assertEquals(body.ok, false);
  assertEquals(body.status, "forbidden");
  assertEquals(body.message, "Agent does not belong to the signed-in user.");
  assert(
    !serializedBody.includes(otherUserId),
    "Response must not expose owner id.",
  );
  assert(
    !serializedBody.includes(testWorkspaceId),
    "Response must not expose workspace id.",
  );
});

Deno.test("telegram-connect continues inert not_configured when ownership matches", async () => {
  let lookupAgentId = "";
  let lookupOwnerUserId = "";

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({ agentId: testAgentId }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => {
        lookupAgentId = agentId;
        lookupOwnerUserId = ownerUserId;

        return {
          agentId,
          ownerUserId,
          workspaceId: testWorkspaceId,
        };
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(lookupAgentId, testAgentId);
  assertEquals(lookupOwnerUserId, testUserId);
  assertEquals(response.status, 501);
  assertEquals(body.ok, false);
  assertEquals(body.status, "not_configured");
  assertEquals(
    body.message,
    "Telegram connect is planned but not enabled yet.",
  );
  assert(
    !serializedBody.includes(testUserId),
    "Response must not expose owner id.",
  );
  assert(
    !serializedBody.includes(testWorkspaceId),
    "Response must not expose workspace id.",
  );
});

Deno.test("telegram-connect getMe runtime gate defaults off and requires exact true", () => {
  assertEquals(
    telegramConnectGetMeEnabledEnvKey,
    "KYRA_TELEGRAM_CONNECT_GETME_ENABLED",
  );
  assertEquals(isTelegramConnectGetMeEnabled(undefined), false);
  assertEquals(isTelegramConnectGetMeEnabled(null), false);
  assertEquals(isTelegramConnectGetMeEnabled(""), false);
  assertEquals(isTelegramConnectGetMeEnabled("false"), false);
  assertEquals(isTelegramConnectGetMeEnabled("TRUE"), false);
  assertEquals(isTelegramConnectGetMeEnabled("1"), false);
  assertEquals(isTelegramConnectGetMeEnabled("true"), true);
});

Deno.test("telegram-connect store runtime gate defaults off and requires exact true", () => {
  assertEquals(
    telegramConnectStoreEnabledEnvKey,
    "KYRA_TELEGRAM_CONNECT_STORE_ENABLED",
  );
  assertEquals(isTelegramConnectStoreEnabled(undefined), false);
  assertEquals(isTelegramConnectStoreEnabled(null), false);
  assertEquals(isTelegramConnectStoreEnabled(""), false);
  assertEquals(isTelegramConnectStoreEnabled("false"), false);
  assertEquals(isTelegramConnectStoreEnabled("TRUE"), false);
  assertEquals(isTelegramConnectStoreEnabled("1"), false);
  assertEquals(isTelegramConnectStoreEnabled("true"), true);
});

Deno.test("telegram-connect session write runtime gate defaults off and requires exact true", () => {
  assertEquals(
    telegramConnectSessionWriteEnabledEnvKey,
    "KYRA_TELEGRAM_CONNECT_SESSION_WRITE_ENABLED",
  );
  assertEquals(isTelegramConnectSessionWriteEnabled(undefined), false);
  assertEquals(isTelegramConnectSessionWriteEnabled(null), false);
  assertEquals(isTelegramConnectSessionWriteEnabled(""), false);
  assertEquals(isTelegramConnectSessionWriteEnabled("false"), false);
  assertEquals(isTelegramConnectSessionWriteEnabled("TRUE"), false);
  assertEquals(isTelegramConnectSessionWriteEnabled("1"), false);
  assertEquals(isTelegramConnectSessionWriteEnabled("true"), true);
});

Deno.test("telegram-connect webhook register runtime gate defaults off and requires exact true", () => {
  assertEquals(
    telegramConnectWebhookRegisterEnabledEnvKey,
    "KYRA_TELEGRAM_CONNECT_WEBHOOK_REGISTER_ENABLED",
  );
  assertEquals(isTelegramConnectWebhookRegisterEnabled(undefined), false);
  assertEquals(isTelegramConnectWebhookRegisterEnabled(null), false);
  assertEquals(isTelegramConnectWebhookRegisterEnabled(""), false);
  assertEquals(isTelegramConnectWebhookRegisterEnabled("false"), false);
  assertEquals(isTelegramConnectWebhookRegisterEnabled("TRUE"), false);
  assertEquals(isTelegramConnectWebhookRegisterEnabled("1"), false);
  assertEquals(isTelegramConnectWebhookRegisterEnabled("true"), true);
});

Deno.test("telegram-connect runtime keeps webhook registration config off by default", () => {
  const config = createTelegramWebhookRegistrationRuntimeConfig(
    (key) => {
      if (key === telegramWebhookUrlEnvKey) {
        throw new Error("webhook URL must not be read while gate is off");
      }

      return "";
    },
  );

  assertEquals(config.enabled, false);
});

Deno.test("telegram-connect runtime exposes webhook registration config only behind explicit gate", () => {
  const config = createTelegramWebhookRegistrationRuntimeConfig(
    makeOptionalEnv({
      [telegramConnectGetMeEnabledEnvKey]: "true",
      [telegramConnectStoreEnabledEnvKey]: "true",
      [telegramConnectSessionWriteEnabledEnvKey]: "true",
      [telegramConnectWebhookRegisterEnabledEnvKey]: "true",
      [telegramWebhookUrlEnvKey]: testWebhookUrl,
    }),
  );

  assertEquals(config.enabled, true);

  if (!config.enabled) {
    throw new Error("Expected webhook registration config to be enabled.");
  }

  assertEquals(typeof config.getTelegramWebhookUrl, "function");
  assertEquals(typeof config.generateTelegramWebhookSecret, "function");
  assertEquals(config.getTelegramWebhookUrl(), testWebhookUrl);

  const firstSecret = config.generateTelegramWebhookSecret();
  const secondSecret = generateTelegramWebhookSecret();

  assert(/^[a-f0-9]{64}$/.test(firstSecret), "Webhook secret must be hex.");
  assert(/^[a-f0-9]{64}$/.test(secondSecret), "Webhook secret must be hex.");
  assert(
    firstSecret !== secondSecret,
    "Webhook secrets should be generated per call.",
  );
});

Deno.test("telegram-connect webhook URL provider rejects missing runtime URL safely", () => {
  let error: unknown;

  try {
    getTelegramWebhookUrl(() => "");
  } catch (caughtError) {
    error = caughtError;
  }

  assert(
    error instanceof HttpError,
    "Missing webhook URL must throw HttpError.",
  );
  assertEquals((error as HttpError).statusCode, 500);
  assertEquals((error as HttpError).code, "missing_env");
  assertEquals(
    (error as HttpError).message,
    "Telegram webhook URL is not configured.",
  );
});

Deno.test("telegram-connect getMe runtime gate off does not call validator", async () => {
  let validatorCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({ agentId: testAgentId }),
    }),
    makeGatedDependencies(undefined, {
      validateTelegramBotToken: async () => {
        validatorCalled = true;
        return {
          telegramBotId: "987654321",
          username: "kyra_test_bot",
          firstName: "Kyra Test",
        };
      },
    }),
  );

  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(
    !validatorCalled,
    "Default-off runtime gate must not call Telegram token validator.",
  );
});

Deno.test("telegram-connect getMe runtime gate ignores non-true flag values", async () => {
  let validatorCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    makeGatedDependencies("TRUE", {
      validateTelegramBotToken: async () => {
        validatorCalled = true;
        return {
          telegramBotId: "987654321",
          username: "kyra_test_bot",
          firstName: "Kyra Test",
        };
      },
    }),
  );

  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(
    !validatorCalled,
    "Only exact string true may enable Telegram token validation.",
  );
});

Deno.test("telegram-connect getMe runtime gate true validates after ownership", async () => {
  const order: string[] = [];

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    makeGatedDependencies("true", {
      getUser: async () => {
        order.push("session");
        return { id: testUserId };
      },
      lookupAgentOwnership: async (agentId, ownerUserId) => {
        order.push("ownership");
        return {
          agentId,
          ownerUserId,
          workspaceId: testWorkspaceId,
        };
      },
      validateTelegramBotToken: async (botToken) => {
        order.push("validator");
        assertEquals(botToken, testBotToken);
        return {
          telegramBotId: "987654321",
          username: "kyra_test_bot",
          firstName: "Kyra Test",
        };
      },
    }),
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(order.join(","), "session,ownership,validator");
  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken after gated validation.",
  );
});

Deno.test("telegram-connect getMe runtime gate true does not validate non-owner", async () => {
  let validatorCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    makeGatedDependencies("true", {
      lookupAgentOwnership: async () => ({
        agentId: testAgentId,
        ownerUserId: otherUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => {
        validatorCalled = true;
        return {
          telegramBotId: "987654321",
          username: "kyra_test_bot",
          firstName: "Kyra Test",
        };
      },
    }),
  );

  const body = await readJson(response);

  assertEquals(response.status, 403);
  assertEquals(body.status, "forbidden");
  assert(!validatorCalled, "Non-owner requests must not call getMe.");
});

Deno.test("telegram-connect requires botToken when mocked validator is enabled", async () => {
  let ownershipLookupCalled = false;
  let validatorCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({ agentId: testAgentId }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => {
        ownershipLookupCalled = true;
        return {
          agentId,
          ownerUserId,
          workspaceId: testWorkspaceId,
        };
      },
      validateTelegramBotToken: async () => {
        validatorCalled = true;
        return {
          telegramBotId: "987654321",
          username: "kyra_test_bot",
          firstName: "Kyra Test",
        };
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 400);
  assertEquals(body.ok, false);
  assertEquals(body.status, "invalid_request");
  assertEquals(body.message, "botToken is required.");
  assert(
    ownershipLookupCalled,
    "Ownership must be checked before token validation.",
  );
  assert(!validatorCalled, "Missing botToken must not call token validator.");
});

Deno.test("telegram-connect rejects malformed botToken before mocked validator call", async () => {
  let validatorCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: "not-a-token",
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => {
        validatorCalled = true;
        return {
          telegramBotId: "987654321",
          username: "kyra_test_bot",
          firstName: "Kyra Test",
        };
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 400);
  assertEquals(body.ok, false);
  assertEquals(body.status, "invalid_request");
  assertEquals(body.message, "botToken is invalid.");
  assert(!validatorCalled, "Malformed botToken must not call token validator.");
  assert(
    !serializedBody.includes("not-a-token"),
    "Response must not echo invalid botToken.",
  );
});

Deno.test("telegram-connect mocked token validator success remains inert", async () => {
  const order: string[] = [];

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => {
        order.push("session");
        return { id: testUserId };
      },
      lookupAgentOwnership: async (agentId, ownerUserId) => {
        order.push("ownership");
        return {
          agentId,
          ownerUserId,
          workspaceId: testWorkspaceId,
        };
      },
      validateTelegramBotToken: async (botToken) => {
        order.push("validator");
        assertEquals(botToken, testBotToken);
        return {
          telegramBotId: "987654321",
          username: "kyra_test_bot",
          firstName: "Kyra Test",
          canJoinGroups: true,
          canReadAllGroupMessages: false,
        };
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(order.join(","), "session,ownership,validator");
  assertEquals(response.status, 501);
  assertEquals(body.ok, false);
  assertEquals(body.status, "not_configured");
  assertEquals(
    body.message,
    "Telegram connect is planned but not enabled yet.",
  );
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
  assert(
    !serializedBody.includes("987654321"),
    "Inert response must not return mocked Telegram bot id.",
  );
});

Deno.test("telegram-connect store dependency runs after ownership and token validation", async () => {
  const order: string[] = [];

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => {
        order.push("session");
        return { id: testUserId };
      },
      lookupAgentOwnership: async (agentId, ownerUserId) => {
        order.push("ownership");
        return {
          agentId,
          ownerUserId,
          workspaceId: testWorkspaceId,
        };
      },
      validateTelegramBotToken: async (botToken) => {
        order.push("validator");
        assertEquals(botToken, testBotToken);
        return {
          telegramBotId: testTelegramBotId,
          username: "kyra_test_bot",
          firstName: "Kyra Test",
        };
      },
      storeTelegramBotToken: async (input) => {
        order.push("store");
        assertEquals(input.agentId, testAgentId);
        assertEquals(input.ownerUserId, testUserId);
        assertEquals(input.telegramBotId, testTelegramBotId);
        assertEquals(input.botToken, testBotToken);
        return {
          tokenSecretRef: testTokenSecretRef,
          provider: "supabase_vault",
        };
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(order.join(","), "session,ownership,validator,store");
  assertEquals(response.status, 501);
  assertEquals(body.ok, false);
  assertEquals(body.status, "not_configured");
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
  assert(
    !serializedBody.includes(testTokenSecretRef),
    "Response must not echo tokenSecretRef.",
  );
  assert(
    !serializedBody.includes(testTelegramBotId),
    "Response must not echo telegramBotId.",
  );
  assert(
    !serializedBody.includes(testUserId),
    "Response must not echo ownerUserId.",
  );
});

Deno.test("telegram-connect session persistence runs after token storage and remains inert", async () => {
  const order: string[] = [];
  let revokeCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => {
        order.push("session");
        return { id: testUserId };
      },
      lookupAgentOwnership: async (agentId, ownerUserId) => {
        order.push("ownership");
        return {
          agentId,
          ownerUserId,
          workspaceId: testWorkspaceId,
        };
      },
      validateTelegramBotToken: async () => {
        order.push("validator");
        return {
          telegramBotId: testTelegramBotId,
          username: "@kyra_test_bot",
          firstName: "Kyra Test",
        };
      },
      storeTelegramBotToken: async () => {
        order.push("store");
        return {
          tokenSecretRef: testTokenSecretRef,
          provider: "supabase_vault",
        };
      },
      persistTelegramSession: async (input) => {
        order.push("persist");
        assertEquals(input.agentId, testAgentId);
        assertEquals(input.botHandle, "@kyra_test_bot");
        assertEquals(input.tokenSecretRef, testTokenSecretRef);
      },
      revokeTelegramBotToken: async () => {
        revokeCalled = true;
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(
    order.join(","),
    "session,ownership,validator,store,persist",
  );
  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(!revokeCalled, "Successful persistence must not revoke the token.");
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
  assert(
    !serializedBody.includes(testTokenSecretRef),
    "Response must not echo tokenSecretRef.",
  );
  assert(
    !serializedBody.includes(testTelegramBotId),
    "Response must not echo telegramBotId.",
  );
  assert(
    !serializedBody.includes(testUserId),
    "Response must not echo ownerUserId.",
  );
});

Deno.test("telegram-connect webhook registration contract runs after session persistence and remains inert", async () => {
  const order: string[] = [];

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => {
        order.push("session");
        return { id: testUserId };
      },
      lookupAgentOwnership: async (agentId, ownerUserId) => {
        order.push("ownership");
        return {
          agentId,
          ownerUserId,
          workspaceId: testWorkspaceId,
        };
      },
      validateTelegramBotToken: async () => {
        order.push("validator");
        return {
          telegramBotId: testTelegramBotId,
          username: "kyra_test_bot",
          firstName: "Kyra Test",
        };
      },
      storeTelegramBotToken: async () => {
        order.push("store");
        return {
          tokenSecretRef: testTokenSecretRef,
          provider: "supabase_vault",
        };
      },
      persistTelegramSession: async () => {
        order.push("persist");
      },
      getTelegramWebhookUrl: () => {
        order.push("url");
        return testWebhookUrl;
      },
      generateTelegramWebhookSecret: () => {
        order.push("secret");
        return testWebhookSecretToken;
      },
      registerTelegramWebhook: async (input) => {
        order.push("register");
        assertEquals(input.agentId, testAgentId);
        assertEquals(input.ownerUserId, testUserId);
        assertEquals(input.telegramBotId, testTelegramBotId);
        assertEquals(input.botHandle, "@kyra_test_bot");
        assertEquals(input.botToken, testBotToken);
        assertEquals(input.tokenSecretRef, testTokenSecretRef);
        assertEquals(input.webhookUrl, testWebhookUrl);
        assertEquals(input.webhookSecretToken, testWebhookSecretToken);
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(
    order.join(","),
    "session,ownership,validator,store,persist,url,secret,register",
  );
  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
  assert(
    !serializedBody.includes(testTokenSecretRef),
    "Response must not echo tokenSecretRef.",
  );
  assert(
    !serializedBody.includes(testWebhookUrl),
    "Response must not echo webhook URL.",
  );
  assert(
    !serializedBody.includes(testWebhookSecretToken),
    "Response must not echo webhook secret.",
  );
  assert(
    !serializedBody.includes(testTelegramBotId),
    "Response must not echo telegramBotId.",
  );
  assert(
    !serializedBody.includes(testUserId),
    "Response must not echo ownerUserId.",
  );
});

Deno.test("telegram-connect webhook registration contract requires prior session persistence", async () => {
  let registerCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => ({
        telegramBotId: testTelegramBotId,
        username: "kyra_test_bot",
        firstName: "Kyra Test",
      }),
      storeTelegramBotToken: async () => ({
        tokenSecretRef: testTokenSecretRef,
        provider: "supabase_vault",
      }),
      getTelegramWebhookUrl: () => testWebhookUrl,
      generateTelegramWebhookSecret: () => testWebhookSecretToken,
      registerTelegramWebhook: async () => {
        registerCalled = true;
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(
    body.message,
    "Telegram webhook registration is not configured safely.",
  );
  assert(
    !registerCalled,
    "Webhook registration must not run before session persistence is configured.",
  );
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
});

Deno.test("telegram-connect webhook registration contract is not called when persistence fails", async () => {
  let registerCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => ({
        telegramBotId: testTelegramBotId,
        username: "kyra_test_bot",
        firstName: "Kyra Test",
      }),
      storeTelegramBotToken: async () => ({
        tokenSecretRef: testTokenSecretRef,
        provider: "supabase_vault",
      }),
      persistTelegramSession: async () => {
        throw new Error(`raw persist ${testTokenSecretRef}`);
      },
      getTelegramWebhookUrl: () => testWebhookUrl,
      generateTelegramWebhookSecret: () => testWebhookSecretToken,
      registerTelegramWebhook: async () => {
        registerCalled = true;
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(body.message, "Telegram session persistence failed.");
  assert(
    !registerCalled,
    "Webhook registration must not run when session persistence fails.",
  );
});

Deno.test("telegram-connect webhook registration dependency failure is sanitized", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => ({
        telegramBotId: testTelegramBotId,
        username: "kyra_test_bot",
        firstName: "Kyra Test",
      }),
      storeTelegramBotToken: async () => ({
        tokenSecretRef: testTokenSecretRef,
        provider: "supabase_vault",
      }),
      persistTelegramSession: async () => {},
      getTelegramWebhookUrl: () => testWebhookUrl,
      generateTelegramWebhookSecret: () => testWebhookSecretToken,
      registerTelegramWebhook: async () => {
        throw new Error(
          `raw setWebhook ${testBotToken} ${testTokenSecretRef} ${testWebhookUrl} ${testWebhookSecretToken}`,
        );
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 424);
  assertEquals(body.status, "webhook_registration_failed");
  assertEquals(body.message, "Telegram webhook registration failed.");
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
  assert(
    !serializedBody.includes(testTokenSecretRef),
    "Response must not echo tokenSecretRef.",
  );
  assert(
    !serializedBody.includes(testWebhookUrl),
    "Response must not echo webhook URL.",
  );
  assert(
    !serializedBody.includes(testWebhookSecretToken),
    "Response must not echo webhook secret.",
  );
  assert(
    !serializedBody.includes("raw setWebhook"),
    "Response must not expose raw webhook registration errors.",
  );
});

Deno.test("telegram-connect session persistence requires prior token storage", async () => {
  let persistCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => ({
        telegramBotId: testTelegramBotId,
        username: "kyra_test_bot",
        firstName: "Kyra Test",
      }),
      persistTelegramSession: async () => {
        persistCalled = true;
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(
    body.message,
    "Telegram session persistence is not configured safely.",
  );
  assert(
    !persistCalled,
    "Persistence must not run without a stored token ref.",
  );
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
});

Deno.test("telegram-connect session persistence failure revokes stored token ref", async () => {
  const order: string[] = [];
  let revokedTokenSecretRef = "";

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => ({
        telegramBotId: testTelegramBotId,
        username: "kyra_test_bot",
        firstName: "Kyra Test",
      }),
      storeTelegramBotToken: async () => {
        order.push("store");
        return {
          tokenSecretRef: testTokenSecretRef,
          provider: "supabase_vault",
        };
      },
      persistTelegramSession: async () => {
        order.push("persist");
        throw new Error(
          `raw session write ${testTokenSecretRef} ${testBotToken}`,
        );
      },
      revokeTelegramBotToken: async (input) => {
        order.push("revoke");
        revokedTokenSecretRef = input.tokenSecretRef;
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(order.join(","), "store,persist,revoke");
  assertEquals(revokedTokenSecretRef, testTokenSecretRef);
  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(body.message, "Telegram session persistence failed.");
  assert(
    !serializedBody.includes(testTokenSecretRef),
    "Response must not echo tokenSecretRef.",
  );
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
  assert(
    !serializedBody.includes("raw session write"),
    "Response must not expose raw persistence errors.",
  );
});

Deno.test("telegram-connect hides rollback failure after session persistence failure", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => ({
        telegramBotId: testTelegramBotId,
        username: "kyra_test_bot",
        firstName: "Kyra Test",
      }),
      storeTelegramBotToken: async () => ({
        tokenSecretRef: testTokenSecretRef,
        provider: "supabase_vault",
      }),
      persistTelegramSession: async () => {
        throw new Error("raw persistence failure");
      },
      revokeTelegramBotToken: async () => {
        throw new Error(`raw revoke failure ${testTokenSecretRef}`);
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assertEquals(body.message, "Telegram session persistence failed.");
  assert(
    !serializedBody.includes("raw revoke failure"),
    "Response must not expose rollback errors.",
  );
  assert(
    !serializedBody.includes(testTokenSecretRef),
    "Response must not echo tokenSecretRef.",
  );
});

Deno.test("telegram-connect invalid stored token ref prevents session persistence", async () => {
  let persistCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => ({
        telegramBotId: testTelegramBotId,
        username: "kyra_test_bot",
        firstName: "Kyra Test",
      }),
      storeTelegramBotToken: async () => ({
        tokenSecretRef: "bad",
        provider: "supabase_vault",
      }),
      persistTelegramSession: async () => {
        persistCalled = true;
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 503);
  assertEquals(body.status, "secret_store_unavailable");
  assertEquals(body.message, "Telegram token secret store is unavailable.");
  assert(!persistCalled, "Invalid token ref must prevent session persistence.");
});

Deno.test("telegram-connect store dependency requires prior token validation", async () => {
  let storeCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      storeTelegramBotToken: async () => {
        storeCalled = true;
        return {
          tokenSecretRef: testTokenSecretRef,
          provider: "supabase_vault",
        };
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 500);
  assertEquals(body.ok, false);
  assertEquals(body.status, "server_error");
  assertEquals(
    body.message,
    "Telegram token storage is not configured safely.",
  );
  assert(!storeCalled, "Store must not run without validated bot metadata.");
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
  assert(
    !serializedBody.includes(testTokenSecretRef),
    "Response must not echo tokenSecretRef.",
  );
});

Deno.test("telegram-connect maps mocked token validation failure to 422", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => {
        throw new HttpError(
          422,
          "telegram_validation_failed",
          "Telegram bot token could not be validated.",
        );
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 422);
  assertEquals(body.ok, false);
  assertEquals(body.status, "telegram_validation_failed");
  assertEquals(body.message, "Telegram bot token could not be validated.");
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
});

Deno.test("telegram-connect sanitizes unexpected mocked token validator errors", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => {
        throw new Error(
          `raw api.telegram.org/bot${testBotToken}/getMe failure`,
        );
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 500);
  assertEquals(body.ok, false);
  assertEquals(body.status, "server_error");
  assertEquals(body.message, "Telegram bot token validation failed.");
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
  assert(
    !serializedBody.includes("api.telegram.org"),
    "Response must not expose Telegram API URL.",
  );
});

Deno.test("telegram-connect does not validate botToken before ownership succeeds", async () => {
  let validatorCalled = false;
  let storeCalled = false;
  let persistCalled = false;
  let revokeCalled = false;
  let getWebhookUrlCalled = false;
  let generateWebhookSecretCalled = false;
  let registerWebhookCalled = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async () => ({
        agentId: testAgentId,
        ownerUserId: otherUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => {
        validatorCalled = true;
        return {
          telegramBotId: testTelegramBotId,
          username: "kyra_test_bot",
          firstName: "Kyra Test",
        };
      },
      storeTelegramBotToken: async () => {
        storeCalled = true;
        return {
          tokenSecretRef: testTokenSecretRef,
          provider: "supabase_vault",
        };
      },
      persistTelegramSession: async () => {
        persistCalled = true;
      },
      revokeTelegramBotToken: async () => {
        revokeCalled = true;
      },
      getTelegramWebhookUrl: () => {
        getWebhookUrlCalled = true;
        return testWebhookUrl;
      },
      generateTelegramWebhookSecret: () => {
        generateWebhookSecretCalled = true;
        return testWebhookSecretToken;
      },
      registerTelegramWebhook: async () => {
        registerWebhookCalled = true;
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 403);
  assertEquals(body.status, "forbidden");
  assert(!validatorCalled, "Non-owner requests must not validate botToken.");
  assert(!storeCalled, "Non-owner requests must not store botToken.");
  assert(!persistCalled, "Non-owner requests must not persist a session.");
  assert(!revokeCalled, "Non-owner requests must not revoke a token ref.");
  assert(
    !getWebhookUrlCalled,
    "Non-owner requests must not read webhook URL.",
  );
  assert(
    !generateWebhookSecretCalled,
    "Non-owner requests must not generate webhook secrets.",
  );
  assert(
    !registerWebhookCalled,
    "Non-owner requests must not register webhooks.",
  );
});

Deno.test("telegram-connect sanitizes unexpected token storage errors", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => ({
        telegramBotId: testTelegramBotId,
        username: "kyra_test_bot",
        firstName: "Kyra Test",
      }),
      storeTelegramBotToken: async () => {
        throw new Error(
          `raw store failure ${testBotToken} ${testTokenSecretRef} ${testTelegramBotId}`,
        );
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 500);
  assertEquals(body.ok, false);
  assertEquals(body.status, "server_error");
  assertEquals(body.message, "Telegram token storage failed.");
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
  assert(
    !serializedBody.includes(testTokenSecretRef),
    "Response must not echo tokenSecretRef.",
  );
  assert(
    !serializedBody.includes(testTelegramBotId),
    "Response must not echo telegramBotId.",
  );
});

Deno.test("telegram-connect preserves sanitized secret store unavailable errors", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => ({
        telegramBotId: testTelegramBotId,
        username: "kyra_test_bot",
        firstName: "Kyra Test",
      }),
      storeTelegramBotToken: async () => {
        throw new HttpError(
          503,
          "secret_store_unavailable",
          `raw ${testBotToken} ${testTokenSecretRef}`,
        );
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 503);
  assertEquals(body.ok, false);
  assertEquals(body.status, "secret_store_unavailable");
  assertEquals(
    body.message,
    "Telegram token secret store is unavailable.",
  );
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
  assert(
    !serializedBody.includes(testTokenSecretRef),
    "Response must not echo tokenSecretRef.",
  );
});

Deno.test("telegram-connect maps duplicate bot storage conflicts to 409", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({
        agentId: testAgentId,
        botToken: testBotToken,
      }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async (agentId, ownerUserId) => ({
        agentId,
        ownerUserId,
        workspaceId: testWorkspaceId,
      }),
      validateTelegramBotToken: async () => ({
        telegramBotId: testTelegramBotId,
        username: "kyra_test_bot",
        firstName: "Kyra Test",
      }),
      storeTelegramBotToken: async () => {
        throw new HttpError(
          409,
          "duplicate_bot_active",
          `duplicate ${testTelegramBotId} ${testBotToken}`,
        );
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 409);
  assertEquals(body.ok, false);
  assertEquals(body.status, "duplicate_bot_active");
  assertEquals(body.message, "Telegram bot is already connected.");
  assert(
    !serializedBody.includes(testBotToken),
    "Response must not echo botToken.",
  );
  assert(
    !serializedBody.includes(testTelegramBotId),
    "Response must not echo telegramBotId.",
  );
});

Deno.test("telegram-connect sanitizes unexpected ownership lookup errors", async () => {
  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "application/json",
      body: JSON.stringify({ agentId: testAgentId }),
    }),
    {
      getEnv: () => "test-value",
      getUser: async () => ({ id: testUserId }),
      lookupAgentOwnership: async () => {
        throw new Error(
          `raw DB error owner_user_id ${testWorkspaceId} token_secret_ref`,
        );
      },
    },
  );

  const body = await readJson(response);
  const serializedBody = JSON.stringify(body);

  assertEquals(response.status, 500);
  assertEquals(body.ok, false);
  assertEquals(body.status, "server_error");
  assertEquals(body.message, "Telegram connect ownership lookup failed.");
  assert(
    !serializedBody.includes("raw DB error"),
    "Response must not expose raw DB error.",
  );
  assert(
    !serializedBody.includes("owner_user_id"),
    "Response must not expose owner_user_id.",
  );
  assert(
    !serializedBody.includes(testWorkspaceId),
    "Response must not expose workspace id.",
  );
  assert(
    !serializedBody.includes("token_secret_ref"),
    "Response must not expose token refs.",
  );
});

Deno.test("telegram-connect session persistence adapter updates one eligible mock row", async () => {
  const { client, calls } = makeSessionPersistenceClient();

  await persistTelegramSessionRecord(client, {
    agentId: testAgentId,
    botHandle: "@kyra_test_bot",
    tokenSecretRef: testTokenSecretRef,
  });

  assertEquals(calls.length, 2);
  assertEquals(calls[0].table, "telegram_sessions");
  assertEquals(calls[0].operation, "lookup");
  assertEquals(calls[0].columns, "id");
  assertEquals(calls[0].limit, 2);
  assertEquals(
    JSON.stringify(calls[0].filters),
    JSON.stringify([
      { column: "agent_id", value: testAgentId },
      { column: "webhook_status", value: "mocked" },
      { column: "token_secret_ref", value: null },
    ]),
  );
  assertEquals(calls[1].table, "telegram_sessions");
  assertEquals(calls[1].operation, "update");
  assertEquals(calls[1].columns, "id");
  assertEquals(
    JSON.stringify(calls[1].payload),
    JSON.stringify({
      bot_handle: "@kyra_test_bot",
      webhook_status: "queued",
      token_secret_ref: testTokenSecretRef,
    }),
  );
  assertEquals(
    JSON.stringify(calls[1].filters),
    JSON.stringify([
      { column: "id", value: testSessionId },
      { column: "agent_id", value: testAgentId },
      { column: "webhook_status", value: "mocked" },
      { column: "token_secret_ref", value: null },
    ]),
  );
});

Deno.test("telegram-connect session persistence adapter rejects missing eligible row", async () => {
  const { client, calls } = makeSessionPersistenceClient({ sessions: [] });
  const error = await captureError(() =>
    persistTelegramSessionRecord(client, {
      agentId: testAgentId,
      botHandle: "@kyra_test_bot",
      tokenSecretRef: testTokenSecretRef,
    })
  );

  assert(error instanceof Error, "Missing session must reject.");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].operation, "lookup");
});

Deno.test("telegram-connect session persistence adapter rejects ambiguous eligible rows", async () => {
  const { client, calls } = makeSessionPersistenceClient({
    sessions: [{ id: testSessionId }, { id: otherUserId }],
  });
  const error = await captureError(() =>
    persistTelegramSessionRecord(client, {
      agentId: testAgentId,
      botHandle: "@kyra_test_bot",
      tokenSecretRef: testTokenSecretRef,
    })
  );

  assert(error instanceof Error, "Ambiguous sessions must reject.");
  assertEquals(calls.length, 1);
  assertEquals(calls[0].operation, "lookup");
});

Deno.test("telegram-connect session persistence adapter rejects lost update", async () => {
  const { client, calls } = makeSessionPersistenceClient({ updated: null });
  const error = await captureError(() =>
    persistTelegramSessionRecord(client, {
      agentId: testAgentId,
      botHandle: "@kyra_test_bot",
      tokenSecretRef: testTokenSecretRef,
    })
  );

  assert(error instanceof Error, "Lost update must reject.");
  assertEquals(calls.length, 2);
  assertEquals(calls[1].operation, "update");
});

Deno.test("telegram-connect rejects unsupported content type before env/session work", async () => {
  let envRead = false;
  let sessionChecked = false;

  const response = await handleTelegramConnectRequest(
    makeConnectRequest({
      authorization: "Bearer valid-test-jwt",
      contentType: "text/plain",
      body: `agentId=${testAgentId}`,
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
  assert(
    !sessionChecked,
    "Unsupported content type must not validate a session.",
  );
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
      body: JSON.stringify({ agentId: testAgentId }),
    }),
    {
      getEnv: () => {
        envRead = true;
        return "test-value";
      },
      getUser: async () => ({ id: testUserId }),
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
        throw new Error(
          "raw sb_secret_testvalue and jwt eyJabc.def.ghi leaked",
        );
      },
    },
  );

  const body = await readJson(response);
  const message = String(body.message);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assert(
    message.includes("sb_secret_[hidden]"),
    "Secret-like value must be redacted.",
  );
  assert(message.includes("jwt_[hidden]"), "JWT-like value must be redacted.");
  assert(
    !message.includes("sb_secret_testvalue"),
    "Raw secret marker must not be returned.",
  );
  assert(
    !message.includes("eyJabc.def.ghi"),
    "Raw JWT marker must not be returned.",
  );
});

Deno.test("telegram-connect body size header validator rejects invalid sizes", () => {
  let error: unknown;

  try {
    assertBodySizeFromHeaders(
      new Headers({ "content-length": "-1" }),
      maxTelegramConnectBodyBytes,
    );
  } catch (caughtError) {
    error = caughtError;
  }

  assert(
    error instanceof HttpError,
    "Invalid Content-Length must throw HttpError.",
  );
  assertEquals((error as HttpError).statusCode, 400);
  assertEquals((error as HttpError).code, "invalid_request");
});

Deno.test("telegram-connect sanitizer caps long messages", () => {
  const sanitized = sanitizeErrorMessage("x".repeat(400));

  assertEquals(sanitized.length, 240);
});
