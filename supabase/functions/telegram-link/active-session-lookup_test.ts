import { HttpError } from "../telegram-connect/core.ts";
import {
  lookupTelegramLinkActiveSession,
  sanitizeTelegramLinkActiveSessionLookupError,
  type TelegramLinkActiveSessionLookupClient,
} from "./active-session-lookup.ts";

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

const agentId = "11111111-1111-4111-8111-111111111111";
const telegramSessionId = "22222222-2222-4222-8222-222222222222";
const botHandle = "@kyra_test_bot";

function createLookupClient(options: {
  data: unknown;
  error?: unknown;
}) {
  const calls: Array<{
    table: string;
    columns: string;
    filters: Array<{ column: string; value: string }>;
    limit?: number;
  }> = [];
  const client: TelegramLinkActiveSessionLookupClient = {
    from(table) {
      const call = { table, columns: "", filters: [] } as {
        table: string;
        columns: string;
        filters: Array<{ column: string; value: string }>;
        limit?: number;
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
        async limit<T>(count: number) {
          call.limit = count;
          return {
            data: options.data as T[] | null,
            error: options.error ?? null,
          };
        },
      };

      return builder;
    },
  };

  return { client, calls };
}

Deno.test("telegram-link active session lookup selects only bounded safe fields", async () => {
  const { client, calls } = createLookupClient({
    data: [{
      id: telegramSessionId,
      agent_id: agentId,
      bot_handle: botHandle,
      webhook_status: "active",
    }],
  });
  const result = await lookupTelegramLinkActiveSession({
    agentId,
    serviceClient: client,
  });
  const serialized = JSON.stringify(result);

  assertEquals(calls.length, 1);
  assertEquals(calls[0]?.table, "telegram_sessions");
  assertEquals(calls[0]?.columns, "id,agent_id,bot_handle,webhook_status");
  assertEquals(calls[0]?.filters[0]?.column, "agent_id");
  assertEquals(calls[0]?.filters[0]?.value, agentId);
  assertEquals(calls[0]?.filters[1]?.column, "webhook_status");
  assertEquals(calls[0]?.filters[1]?.value, "active");
  assertEquals(calls[0]?.limit, 2);
  assertEquals(result.telegramSessionId, telegramSessionId);
  assertEquals(result.agentId, agentId);
  assertEquals(result.botHandle, botHandle);
  assert(
    !serialized.includes("token_secret_ref"),
    "Result must hide token ref.",
  );
});

Deno.test("telegram-link active session lookup maps missing session to bounded unavailable", async () => {
  const { client } = createLookupClient({ data: [] });
  const error = await captureError(() =>
    lookupTelegramLinkActiveSession({ agentId, serviceClient: client })
  );

  assert(error instanceof HttpError, "Expected HttpError.");
  assertEquals((error as HttpError).statusCode, 409);
  assertEquals((error as HttpError).code, "owner_link_unavailable");
});

Deno.test("telegram-link active session lookup rejects duplicate and unsafe rows", async () => {
  const validRow = {
    id: telegramSessionId,
    agent_id: agentId,
    bot_handle: botHandle,
    webhook_status: "active",
  };

  for (
    const data of [
      [validRow, validRow],
      [{ ...validRow, token_secret_ref: "private" }],
      [{ ...validRow, agent_id: "33333333-3333-4333-8333-333333333333" }],
      [{ ...validRow, webhook_status: "queued" }],
      [{ ...validRow, bot_handle: "invalid" }],
      null,
    ]
  ) {
    const { client } = createLookupClient({ data });
    const error = await captureError(() =>
      lookupTelegramLinkActiveSession({ agentId, serviceClient: client })
    );
    const serialized = JSON.stringify(error);

    assert(error instanceof HttpError, "Expected HttpError.");
    assertEquals((error as HttpError).statusCode, 500);
    assertEquals((error as HttpError).code, "server_error");
    assert(
      !serialized.includes("token_secret_ref"),
      "Error must hide token ref.",
    );
  }
});

Deno.test("telegram-link active session lookup sanitizes query errors", async () => {
  const raw =
    `owner_user_id workspace_id token_secret_ref ${telegramSessionId}`;
  const { client } = createLookupClient({
    data: null,
    error: new Error(raw),
  });
  const error = await captureError(() =>
    lookupTelegramLinkActiveSession({ agentId, serviceClient: client })
  );
  const sanitized = sanitizeTelegramLinkActiveSessionLookupError(
    new Error(raw),
  );

  for (const value of [error, sanitized]) {
    const serialized = JSON.stringify(value);
    assert(value instanceof HttpError, "Expected HttpError.");
    assertEquals((value as HttpError).statusCode, 500);
    assertEquals((value as HttpError).code, "server_error");
    assert(!serialized.includes(telegramSessionId), "Error must hide session.");
    assert(
      !serialized.includes("token_secret_ref"),
      "Error must hide token ref.",
    );
  }
});
