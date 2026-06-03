import {
  assertBodySizeFromHeaders,
  handleTelegramConnectRequest,
  HttpError,
  isTelegramConnectGetMeEnabled,
  lookupAgentOwnershipRecord,
  maxTelegramConnectBodyBytes,
  readJsonObjectBody,
  sanitizeErrorMessage,
  type TelegramConnectDependencies,
  telegramConnectGetMeEnabledEnvKey,
} from "./core.ts";

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

const testAgentId = "11111111-1111-4111-8111-111111111111";
const testWorkspaceId = "22222222-2222-4222-8222-222222222222";
const testUserId = "33333333-3333-4333-8333-333333333333";
const otherUserId = "44444444-4444-4444-8444-444444444444";
const testBotToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";

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
          telegramBotId: "987654321",
          username: "kyra_test_bot",
          firstName: "Kyra Test",
        };
      },
    },
  );

  const body = await readJson(response);

  assertEquals(response.status, 403);
  assertEquals(body.status, "forbidden");
  assert(!validatorCalled, "Non-owner requests must not validate botToken.");
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
