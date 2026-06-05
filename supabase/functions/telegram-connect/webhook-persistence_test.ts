import {
  activateTelegramSessionRecord,
  revokeTelegramWebhookSecretRecord,
  storeTelegramWebhookSecretRecord,
  type TelegramWebhookPersistenceBuilder,
  type TelegramWebhookPersistenceClient,
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

const testSessionId = "66666666-6666-4666-8666-666666666666";
const testWebhookSecretRef =
  "webhook:telegram:77777777-7777-4777-8777-777777777777";
const testWebhookSecretHash = "a".repeat(64);
const testRevokedAt = new Date("2026-06-05T06:00:00.000Z");

interface PersistenceCall {
  table: string;
  operation: "insert" | "update" | "";
  payload?: Record<string, unknown>;
  filters: Array<{
    kind: "eq" | "is" | "not";
    column: string;
    operator?: string;
    value: unknown;
  }>;
  columns: string;
}

function makePersistenceClient(options: {
  data?: Record<string, unknown> | null;
  error?: unknown;
} = {}) {
  const calls: PersistenceCall[] = [];
  const client: TelegramWebhookPersistenceClient = {
    from(table: string) {
      const call: PersistenceCall = {
        table,
        operation: "",
        filters: [],
        columns: "",
      };
      calls.push(call);

      const builder: TelegramWebhookPersistenceBuilder = {
        insert(payload) {
          call.operation = "insert";
          call.payload = payload;
          return builder;
        },
        update(payload) {
          call.operation = "update";
          call.payload = payload;
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
        not(column, operator, value) {
          call.filters.push({ kind: "not", column, operator, value });
          return builder;
        },
        select(columns) {
          call.columns = columns;
          return builder;
        },
        async maybeSingle<T>() {
          return {
            data: (options.data ?? null) as T | null,
            error: options.error ?? null,
          };
        },
      };

      return builder;
    },
  };

  return { client, calls };
}

Deno.test("telegram webhook persistence stores only hashed secret metadata", async () => {
  const { client, calls } = makePersistenceClient({
    data: { webhook_secret_ref: testWebhookSecretRef },
  });

  const result = await storeTelegramWebhookSecretRecord(client, {
    telegramSessionId: testSessionId,
    webhookSecretHash: testWebhookSecretHash,
    webhookSecretRef: testWebhookSecretRef,
  });

  assertEquals(result.webhookSecretRef, testWebhookSecretRef);
  assertEquals(calls.length, 1);
  assertEquals(calls[0].table, "telegram_webhook_secrets");
  assertEquals(calls[0].operation, "insert");
  assertEquals(calls[0].columns, "webhook_secret_ref");
  assertEquals(
    JSON.stringify(calls[0].payload),
    JSON.stringify({
      webhook_secret_ref: testWebhookSecretRef,
      webhook_secret_hash: testWebhookSecretHash,
      telegram_session_id: testSessionId,
    }),
  );
  assert(
    !JSON.stringify(calls[0]).includes("webhookSecretToken"),
    "Persistence must not receive the raw webhook secret token.",
  );
});

Deno.test("telegram webhook persistence revokes one active secret ref", async () => {
  const { client, calls } = makePersistenceClient({
    data: { webhook_secret_ref: testWebhookSecretRef },
  });

  const result = await revokeTelegramWebhookSecretRecord(
    client,
    { webhookSecretRef: testWebhookSecretRef },
    { now: () => testRevokedAt },
  );

  assertEquals(result.revoked, true);
  assertEquals(calls[0].operation, "update");
  assertEquals(
    JSON.stringify(calls[0].payload),
    JSON.stringify({ revoked_at: testRevokedAt.toISOString() }),
  );
  assertEquals(
    JSON.stringify(calls[0].filters),
    JSON.stringify([
      { kind: "eq", column: "webhook_secret_ref", value: testWebhookSecretRef },
      { kind: "is", column: "revoked_at", value: null },
    ]),
  );
});

Deno.test("telegram webhook persistence activates only one queued token-backed session", async () => {
  const { client, calls } = makePersistenceClient({
    data: { id: testSessionId },
  });

  const result = await activateTelegramSessionRecord(client, {
    telegramSessionId: testSessionId,
  });

  assertEquals(result.activated, true);
  assertEquals(result.telegramSessionId, testSessionId);
  assertEquals(calls[0].table, "telegram_sessions");
  assertEquals(
    JSON.stringify(calls[0].payload),
    JSON.stringify({ webhook_status: "active" }),
  );
  assertEquals(
    JSON.stringify(calls[0].filters),
    JSON.stringify([
      { kind: "eq", column: "id", value: testSessionId },
      { kind: "eq", column: "webhook_status", value: "queued" },
      {
        kind: "not",
        column: "token_secret_ref",
        operator: "is",
        value: null,
      },
    ]),
  );
});

Deno.test("telegram webhook persistence rejects missing mutation rows", async () => {
  const storeError = await captureError(() =>
    storeTelegramWebhookSecretRecord(makePersistenceClient().client, {
      telegramSessionId: testSessionId,
      webhookSecretHash: testWebhookSecretHash,
      webhookSecretRef: testWebhookSecretRef,
    })
  );
  const revokeError = await captureError(() =>
    revokeTelegramWebhookSecretRecord(
      makePersistenceClient().client,
      { webhookSecretRef: testWebhookSecretRef },
    )
  );
  const activateError = await captureError(() =>
    activateTelegramSessionRecord(makePersistenceClient().client, {
      telegramSessionId: testSessionId,
    })
  );

  assert(storeError instanceof Error, "Missing store row must reject.");
  assert(revokeError instanceof Error, "Missing revoke row must reject.");
  assert(activateError instanceof Error, "Missing activation row must reject.");
});

Deno.test("telegram webhook persistence propagates database errors for sanitization", async () => {
  const rawError = new Error(
    `raw ${testWebhookSecretRef} ${testWebhookSecretHash} ${testSessionId}`,
  );
  const storeError = await captureError(() =>
    storeTelegramWebhookSecretRecord(
      makePersistenceClient({ error: rawError }).client,
      {
        telegramSessionId: testSessionId,
        webhookSecretHash: testWebhookSecretHash,
        webhookSecretRef: testWebhookSecretRef,
      },
    )
  );
  const revokeError = await captureError(() =>
    revokeTelegramWebhookSecretRecord(
      makePersistenceClient({ error: rawError }).client,
      { webhookSecretRef: testWebhookSecretRef },
    )
  );
  const activateError = await captureError(() =>
    activateTelegramSessionRecord(
      makePersistenceClient({ error: rawError }).client,
      { telegramSessionId: testSessionId },
    )
  );

  assertEquals(storeError, rawError);
  assertEquals(revokeError, rawError);
  assertEquals(activateError, rawError);
});

Deno.test("telegram webhook persistence rejects mismatched returned identifiers", async () => {
  const otherSessionId = "88888888-8888-4888-8888-888888888888";
  const otherWebhookSecretRef =
    "webhook:telegram:99999999-9999-4999-8999-999999999999";
  const storeError = await captureError(() =>
    storeTelegramWebhookSecretRecord(
      makePersistenceClient({
        data: { webhook_secret_ref: otherWebhookSecretRef },
      }).client,
      {
        telegramSessionId: testSessionId,
        webhookSecretHash: testWebhookSecretHash,
        webhookSecretRef: testWebhookSecretRef,
      },
    )
  );
  const revokeError = await captureError(() =>
    revokeTelegramWebhookSecretRecord(
      makePersistenceClient({
        data: { webhook_secret_ref: otherWebhookSecretRef },
      }).client,
      { webhookSecretRef: testWebhookSecretRef },
    )
  );
  const activateError = await captureError(() =>
    activateTelegramSessionRecord(
      makePersistenceClient({ data: { id: otherSessionId } }).client,
      { telegramSessionId: testSessionId },
    )
  );

  assert(storeError instanceof Error, "Mismatched store ref must reject.");
  assert(revokeError instanceof Error, "Mismatched revoke ref must reject.");
  assert(activateError instanceof Error, "Mismatched activation id must reject.");
});
