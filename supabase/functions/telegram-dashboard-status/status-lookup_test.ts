import { HttpError } from "../telegram-connect/core.ts";
import {
  lookupTelegramDashboardStatuses,
  type TelegramDashboardStatusLookupClient,
} from "./status-lookup.ts";

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

const agentId = "11111111-1111-4111-8111-111111111111";
const secondAgentId = "22222222-2222-4222-8222-222222222222";
const workspaceId = "33333333-3333-4333-8333-333333333333";
const ownerUserId = "44444444-4444-4444-8444-444444444444";
const nonOwnerUserId = "55555555-5555-4555-8555-555555555555";

type TableName =
  | "agent_instances"
  | "workspaces"
  | "telegram_sessions"
  | "telegram_chat_authorizations";

interface QueryCall {
  table: TableName;
  columns: string;
  filters: string[];
  order: string | null;
  limit: number;
}

interface FakeLookupData {
  agent_instances: Array<Record<string, unknown>>;
  workspaces: Array<Record<string, unknown>>;
  telegram_sessions: Array<Record<string, unknown>>;
  telegram_chat_authorizations: Array<Record<string, unknown>>;
}

function makeLookupClient(options: {
  data?: Partial<FakeLookupData>;
  errors?: Partial<Record<TableName, unknown>>;
} = {}) {
  const data: FakeLookupData = {
    agent_instances: [
      { id: agentId, workspace_id: workspaceId },
      { id: secondAgentId, workspace_id: workspaceId },
    ],
    workspaces: [{ id: workspaceId, owner_user_id: ownerUserId }],
    telegram_sessions: [
      {
        agent_id: agentId,
        bot_handle: "@kyra_active_bot",
        webhook_status: "active",
        created_at: "2026-06-07T05:00:00.000Z",
        last_event_at: "2026-06-07T05:10:00.000Z",
      },
      {
        agent_id: agentId,
        bot_handle: "@kyra_mock_bot",
        webhook_status: "mocked",
        created_at: "2026-06-07T06:00:00.000Z",
        last_event_at: null,
      },
      {
        agent_id: secondAgentId,
        bot_handle: "@kyra_queued_bot",
        webhook_status: "queued",
        created_at: "2026-06-07T04:00:00.000Z",
        last_event_at: null,
      },
    ],
    telegram_chat_authorizations: [
      {
        agent_id: agentId,
        role: "owner",
        command_scope: "read_only",
        revoked_at: null,
      },
    ],
    ...options.data,
  };
  const calls: QueryCall[] = [];
  const client: TelegramDashboardStatusLookupClient = {
    from(table) {
      let selectedColumns = "";
      const filters: string[] = [];
      let orderColumn: string | null = null;

      const builder = {
        select(columns: string) {
          selectedColumns = columns;
          return builder;
        },
        eq(column: string, value: string) {
          filters.push(`${column}=eq.${value}`);
          return builder;
        },
        is(column: string, value: null) {
          filters.push(`${column}=is.${String(value)}`);
          return builder;
        },
        in(column: string, values: string[]) {
          filters.push(`${column}=in.${values.join("|")}`);
          return builder;
        },
        order(column: string, options: { ascending: boolean }) {
          orderColumn = `${column}:${options.ascending ? "asc" : "desc"}`;
          return builder;
        },
        async limit<T>(count: number) {
          calls.push({
            table,
            columns: selectedColumns,
            filters,
            order: orderColumn,
            limit: count,
          });

          if (options.errors?.[table]) {
            return { data: null, error: options.errors[table] };
          }

          return { data: filterRows(data[table], filters, orderColumn).slice(0, count) as T[], error: null };
        },
      };

      return builder;
    },
  };

  return { client, calls };
}

function filterRows(rows: Array<Record<string, unknown>>, filters: string[], order: string | null) {
  let filteredRows = rows.filter((row) => {
    return filters.every((filter) => {
      const [column, operatorValue] = filter.split("=");
      const [operator, rawValue] = operatorValue.split(".");

      if (operator === "eq") {
        return row[column] === rawValue;
      }

      if (operator === "is") {
        return row[column] === null;
      }

      if (operator === "in") {
        return rawValue.split("|").includes(String(row[column]));
      }

      return false;
    });
  });

  if (order === "created_at:desc") {
    filteredRows = filteredRows.sort((left, right) => {
      return Date.parse(String(right.created_at)) - Date.parse(String(left.created_at));
    });
  }

  return filteredRows;
}

Deno.test("telegram dashboard status lookup returns bounded owner-linked status", async () => {
  const { client, calls } = makeLookupClient();
  const result = await lookupTelegramDashboardStatuses({
    agentIds: [agentId, secondAgentId],
    ownerUserId,
    serviceClient: client,
  });
  const serialized = JSON.stringify(result);

  assertEquals(result.length, 2);
  assertEquals(result[0].agentId, agentId);
  assertEquals(result[0].botHandle, "@kyra_active_bot");
  assertEquals(result[0].webhookStatus, "active");
  assertEquals(result[0].ownerChatLinked, true);
  assertEquals(result[0].ownerLinkAvailable, false);
  assertEquals(result[1].agentId, secondAgentId);
  assertEquals(result[1].webhookStatus, "queued");
  assertEquals(result[1].ownerChatLinked, false);
  assertEquals(result[1].ownerLinkAvailable, false);
  assertEquals(calls[0].table, "agent_instances");
  assertEquals(calls[0].columns, "id,workspace_id");
  assertEquals(calls[1].table, "workspaces");
  assertEquals(calls[1].columns, "id,owner_user_id");
  assertEquals(calls[2].table, "telegram_chat_authorizations");
  assertEquals(calls[2].columns, "agent_id,role,command_scope,revoked_at");
  assertEquals(calls[3].table, "telegram_sessions");
  assertEquals(calls[3].columns, "agent_id,bot_handle,webhook_status,created_at,last_event_at");
  assert(!serialized.includes(ownerUserId), "Result must hide owner id.");
  assert(!serialized.includes(workspaceId), "Result must hide workspace id.");
  assert(!serialized.includes("telegram_user_id"), "Result must hide Telegram user id.");
  assert(!serialized.includes("telegram_chat_id"), "Result must hide Telegram chat id.");
  assert(!serialized.includes("token_secret_ref"), "Result must hide token refs.");
  assert(!serialized.includes("webhook_secret"), "Result must hide webhook secrets.");
});

Deno.test("telegram dashboard status lookup maps missing and non-owner agents safely", async () => {
  const missing = makeLookupClient({
    data: { agent_instances: [] },
  });

  try {
    await lookupTelegramDashboardStatuses({
      agentIds: [agentId],
      ownerUserId,
      serviceClient: missing.client,
    });
    throw new Error("Missing agent lookup should reject.");
  } catch (error) {
    if (!(error instanceof HttpError)) {
      throw new Error("Missing agent must throw HttpError.");
    }

    assertEquals(error.statusCode, 404);
    assertEquals(error.code, "agent_not_found");
  }

  const nonOwner = makeLookupClient({
    data: { workspaces: [{ id: workspaceId, owner_user_id: nonOwnerUserId }] },
  });

  try {
    await lookupTelegramDashboardStatuses({
      agentIds: [agentId],
      ownerUserId,
      serviceClient: nonOwner.client,
    });
    throw new Error("Non-owner lookup should reject.");
  } catch (error) {
    if (!(error instanceof HttpError)) {
      throw new Error("Non-owner must throw HttpError.");
    }

    assertEquals(error.statusCode, 403);
    assertEquals(error.code, "forbidden");
  }
});

Deno.test("telegram dashboard status lookup sanitizes raw database failures", async () => {
  const { client } = makeLookupClient({
    errors: {
      telegram_chat_authorizations: new Error(
        `raw owner_user_id ${ownerUserId} telegram_chat_id token_secret_ref`,
      ),
    },
  });

  try {
    await lookupTelegramDashboardStatuses({
      agentIds: [agentId],
      ownerUserId,
      serviceClient: client,
    });
    throw new Error("Raw database failure should reject.");
  } catch (error) {
    if (!(error instanceof HttpError)) {
      throw new Error("Raw DB failure must throw HttpError.");
    }

    const serialized = JSON.stringify(error);

    assertEquals(error.statusCode, 500);
    assertEquals(error.code, "server_error");
    assert(!serialized.includes(ownerUserId), "Error must hide owner id.");
    assert(!serialized.includes("telegram_chat_id"), "Error must hide chat id.");
    assert(!serialized.includes("token_secret_ref"), "Error must hide token ref.");
  }
});

Deno.test("telegram dashboard status lookup rejects malformed and duplicate private rows", async () => {
  for (
    const data of [
      {
        telegram_chat_authorizations: [
          {
            agent_id: agentId,
            role: "owner",
            command_scope: "read_only",
            revoked_at: null,
          },
          {
            agent_id: agentId,
            role: "owner",
            command_scope: "read_only",
            revoked_at: null,
          },
        ],
      },
      {
        telegram_sessions: [
          {
            agent_id: agentId,
            bot_handle: "@kyra_active_bot",
            webhook_status: "active",
            created_at: "2026-06-07T05:00:00.000Z",
            last_event_at: null,
            token_secret_ref: "must-not-appear",
          },
        ],
      },
    ]
  ) {
    const { client } = makeLookupClient({ data });

    try {
      await lookupTelegramDashboardStatuses({
        agentIds: [agentId],
        ownerUserId,
        serviceClient: client,
      });
      throw new Error("Malformed private rows should reject.");
    } catch (error) {
      if (!(error instanceof HttpError)) {
        throw new Error("Malformed row must throw HttpError.");
      }

      assertEquals(error.statusCode, 500);
      assertEquals(error.code, "server_error");
    }
  }
});
