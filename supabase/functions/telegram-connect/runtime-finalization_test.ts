import {
  finalizeTelegramWebhookRegistrationRuntime,
} from "./webhook-finalization-runtime.ts";
import type {
  TelegramWebhookPersistenceBuilder,
  TelegramWebhookPersistenceClient,
} from "./webhook-persistence.ts";

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

const testAgentId = "11111111-1111-4111-8111-111111111111";
const testUserId = "33333333-3333-4333-8333-333333333333";
const testTelegramBotId = "987654321";
const testSessionId = "66666666-6666-4666-8666-666666666666";
const testBotToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
const testTokenSecretRef =
  "vault:telegram:55555555-5555-4555-8555-555555555555";
const testWebhookUrl =
  "https://lvgqtxbygrazkolhdwnh.supabase.co/functions/v1/telegram-webhook";
const testWebhookSecretToken = "a".repeat(64);
const testWebhookSecretHash = "b".repeat(64);
const testWebhookSecretRef =
  "webhook:telegram:77777777-7777-4777-8777-777777777777";

interface RuntimePersistenceCall {
  table: string;
  operation: "insert" | "update" | "";
  payload?: Record<string, unknown>;
  filters: Array<{ kind: string; column: string; value: unknown }>;
}

function makeRuntimePersistenceClient(
  order: string[],
  options: { activationError?: Error } = {},
) {
  const calls: RuntimePersistenceCall[] = [];
  const client: TelegramWebhookPersistenceClient = {
    from(table: string) {
      const call: RuntimePersistenceCall = {
        table,
        operation: "",
        filters: [],
      };
      calls.push(call);

      const builder: TelegramWebhookPersistenceBuilder = {
        insert(payload) {
          call.operation = "insert";
          call.payload = payload;
          order.push("store");
          return builder;
        },
        update(payload) {
          call.operation = "update";
          call.payload = payload;
          order.push(
            table === "telegram_sessions" ? "activate" : "revoke",
          );
          return builder;
        },
        eq(column, value) {
          call.filters.push({ kind: "eq", column, value });
          return builder;
        },
        is(column, value) {
          call.filters.push({ kind: "is", column, value });
          return builder;
        },
        not(column, _operator, value) {
          call.filters.push({ kind: "not", column, value });
          return builder;
        },
        select() {
          return builder;
        },
        async maybeSingle<T>() {
          if (table === "telegram_sessions") {
            if (options.activationError) {
              return {
                data: null,
                error: options.activationError,
              };
            }

            return {
              data: { id: testSessionId } as T,
              error: null,
            };
          }

          return {
            data: { webhook_secret_ref: testWebhookSecretRef } as T,
            error: null,
          };
        },
      };

      return builder;
    },
  };

  return { client, calls };
}

function makeRuntimeInput() {
  return {
    telegramSessionId: testSessionId,
    agentId: testAgentId,
    ownerUserId: testUserId,
    telegramBotId: testTelegramBotId,
    botHandle: "@kyra_test_bot",
    botToken: testBotToken,
    tokenSecretRef: testTokenSecretRef,
    webhookUrl: testWebhookUrl,
    webhookSecretToken: testWebhookSecretToken,
  };
}

function makeSecretMaterial() {
  return {
    webhookSecretToken: testWebhookSecretToken,
    webhookSecretHash: testWebhookSecretHash,
    webhookSecretRef: testWebhookSecretRef,
  };
}

Deno.test("telegram connect runtime finalization stores registers then activates", async () => {
  const order: string[] = [];
  const { client, calls } = makeRuntimePersistenceClient(order);

  await finalizeTelegramWebhookRegistrationRuntime(
    client,
    makeRuntimeInput(),
    {
      createWebhookSecretMaterial: async (options) => {
        assertEquals(options?.webhookSecretToken, testWebhookSecretToken);
        return makeSecretMaterial();
      },
      registerWebhook: async (input) => {
        order.push("register");
        assertEquals(input.botToken, testBotToken);
        assertEquals(input.webhookUrl, testWebhookUrl);
        assertEquals(input.webhookSecretToken, testWebhookSecretToken);
      },
    },
  );

  assertEquals(order.join(","), "store,register,activate");
  assertEquals(calls.length, 2);
  assertEquals(calls[0].table, "telegram_webhook_secrets");
  assertEquals(calls[1].table, "telegram_sessions");
  const persisted = JSON.stringify(calls);
  assert(
    !persisted.includes(testWebhookSecretToken),
    "Raw webhook secret token must not be persisted.",
  );
  assert(
    !persisted.includes(testBotToken),
    "BotFather token must not be persisted by webhook finalization.",
  );
});

Deno.test("telegram connect runtime finalization revokes stored secret after registration failure", async () => {
  const order: string[] = [];
  const { client } = makeRuntimePersistenceClient(order);
  const error = await captureError(() =>
    finalizeTelegramWebhookRegistrationRuntime(
      client,
      makeRuntimeInput(),
      {
        createWebhookSecretMaterial: async () => makeSecretMaterial(),
        registerWebhook: async () => {
          order.push("register");
          throw new Error(
            `raw ${testBotToken} ${testWebhookSecretToken}`,
          );
        },
      },
    )
  );
  const serialized = JSON.stringify({
    name: (error as Error).name,
    message: (error as Error).message,
  });

  assertEquals(order.join(","), "store,register,revoke");
  assert(
    !serialized.includes(testBotToken),
    "Registration failure must not expose BotFather token.",
  );
  assert(
    !serialized.includes(testWebhookSecretToken),
    "Registration failure must not expose webhook secret token.",
  );
});

Deno.test("telegram connect runtime finalization unregisters and revokes after activation failure", async () => {
  const order: string[] = [];
  const { client } = makeRuntimePersistenceClient(order, {
    activationError: new Error(`raw activation ${testSessionId}`),
  });
  const error = await captureError(() =>
    finalizeTelegramWebhookRegistrationRuntime(
      client,
      makeRuntimeInput(),
      {
        createWebhookSecretMaterial: async () => makeSecretMaterial(),
        registerWebhook: async () => {
          order.push("register");
        },
        unregisterWebhook: async (input) => {
          order.push("unregister");
          assertEquals(input.botToken, testBotToken);
        },
      },
    )
  );
  const serialized = JSON.stringify({
    name: (error as Error).name,
    message: (error as Error).message,
  });

  assertEquals(
    order.join(","),
    "store,register,activate,unregister,revoke",
  );
  assert(
    !serialized.includes(testBotToken),
    "Activation failure must not expose BotFather token.",
  );
  assert(
    !serialized.includes(testWebhookSecretToken),
    "Activation failure must not expose webhook secret token.",
  );
  assert(
    !serialized.includes(testSessionId),
    "Activation failure must not expose telegram session ID.",
  );
});
