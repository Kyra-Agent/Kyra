import { HttpError } from "./core.ts";
import { lookupTelegramTemplateContext } from "./template-context-lookup.ts";

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
    "workspace_id",
    "owner_user_id",
    "token_secret_ref",
    "webhook_secret",
    "telegramChatId",
    "telegramUserId",
    "sb_secret_private",
    "1234567890:abcdefghijklmnopqrstuvwxyz",
  ];

  for (const fragment of forbidden) {
    assert(
      !serialized.includes(fragment),
      `Serialized value leaked ${fragment}.`,
    );
  }
}

interface LookupCall {
  table: string;
  columns?: string;
  filters: Array<{ column: string; value: string }>;
  limit?: number;
}

function createLookupClient(options?: {
  agentRows?: unknown[];
  templateRows?: unknown[];
  agentError?: unknown;
  templateError?: unknown;
}) {
  const calls: LookupCall[] = [];

  return {
    calls,
    client: {
      from(table: "agent_instances" | "agent_templates") {
        const call: LookupCall = { table, filters: [] };
        calls.push(call);

        return {
          select(columns: string) {
            call.columns = columns;
            return this;
          },
          eq(column: string, value: string) {
            call.filters.push({ column, value });
            return this;
          },
          async limit<T>(count: number) {
            call.limit = count;

            if (table === "agent_instances") {
              return {
                data: (options?.agentRows ?? [agentRow]) as T[],
                error: options?.agentError ?? null,
              };
            }

            return {
              data: (options?.templateRows ?? [templateRow]) as T[],
              error: options?.templateError ?? null,
            };
          },
        };
      },
    },
  };
}

const agentId = "9220060d-2760-496c-9774-18384211496c";
const agentRow = {
  id: agentId,
  template_id: "strategist",
  display_name: "KEE-RAHH Strategist",
};
const templateRow = {
  id: "strategist",
  name: "Strategist",
  role: "Market and campaign intelligence agent",
  summary:
    "A planning agent that turns token, market, and community context into launch narratives.",
  actions: [
    "market brief",
    "campaign plan",
    "narrative map",
    "launch copy",
    "community pulse",
  ],
  modules: ["ASTRA-03", "NOVA-04", "VEXA-02"],
};

Deno.test("telegram template context lookup calls exact tables with bounded args", async () => {
  const { calls, client } = createLookupClient();
  const result = await lookupTelegramTemplateContext({
    agentId,
    serviceClient: client,
  });

  assertEquals(calls.length, 2);
  assertEquals(calls[0].table, "agent_instances");
  assertEquals(calls[0].columns, "id,template_id,display_name");
  assertEquals(calls[0].filters.length, 1);
  assertEquals(calls[0].filters[0].column, "id");
  assertEquals(calls[0].filters[0].value, agentId);
  assertEquals(calls[0].limit, 2);
  assertEquals(calls[1].table, "agent_templates");
  assertEquals(calls[1].columns, "id,name,role,summary,actions,modules");
  assertEquals(calls[1].filters.length, 1);
  assertEquals(calls[1].filters[0].column, "id");
  assertEquals(calls[1].filters[0].value, "strategist");
  assertEquals(calls[1].limit, 2);
  assertEquals(result.context.name, "KEE-RAHH Strategist");
  assertEquals(result.context.readOnlyActions.length, 5);
  assert(
    result.text.includes("KEE-RAHH Strategist"),
    "Reply must use agent display name.",
  );
  assertNoSensitiveMaterial(result);
});

Deno.test("telegram template context lookup falls back to template name", async () => {
  const { client } = createLookupClient({
    agentRows: [{ ...agentRow, display_name: null }],
  });
  const result = await lookupTelegramTemplateContext({
    agentId,
    serviceClient: client,
  });

  assertEquals(result.context.name, "Strategist");
});

Deno.test("telegram template context lookup rejects invalid agent id before query", async () => {
  const { calls, client } = createLookupClient();
  const rawAgentId = "bad workspace_id";
  const error = await assertRejectsHttpError(
    () =>
      lookupTelegramTemplateContext({
        agentId: rawAgentId,
        serviceClient: client,
      }),
    400,
    "invalid_request",
  );
  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
  });

  assertEquals(calls.length, 0);
  assertEquals(error.message, "agentId is invalid.");
  assert(!serialized.includes(rawAgentId), "Error must not echo raw agent id.");
});

Deno.test("telegram template context lookup maps missing agent to 404", async () => {
  const { client } = createLookupClient({ agentRows: [] });
  const error = await assertRejectsHttpError(
    () => lookupTelegramTemplateContext({ agentId, serviceClient: client }),
    404,
    "agent_not_found",
  );

  assertEquals(error.message, "Telegram agent was not found.");
});

Deno.test("telegram template context lookup sanitizes DB and malformed rows", async () => {
  const unsafeError = "db failed with token_secret_ref";
  const cases = [
    createLookupClient({ agentError: new Error(unsafeError) }).client,
    createLookupClient({ agentRows: [{ ...agentRow, workspace_id: "leak" }] })
      .client,
    createLookupClient({ agentRows: [agentRow, agentRow] }).client,
    createLookupClient({ templateRows: [] }).client,
    createLookupClient({ templateRows: [{ ...templateRow, actions: null }] })
      .client,
    createLookupClient({ templateError: new Error(unsafeError) }).client,
  ];

  for (const client of cases) {
    const error = await assertRejectsHttpError(
      () => lookupTelegramTemplateContext({ agentId, serviceClient: client }),
      500,
      "server_error",
    );
    const serialized = JSON.stringify({
      code: error.code,
      message: error.message,
    });

    assertEquals(
      error.message,
      "Telegram template context lookup failed.",
    );
    assert(!serialized.includes(unsafeError), "Raw DB error must be hidden.");
  }
});

Deno.test("telegram template context lookup keeps executor gated", async () => {
  const { client } = createLookupClient({
    agentRows: [{
      ...agentRow,
      template_id: "executor",
      display_name: "Executor",
    }],
    templateRows: [{
      id: "executor",
      name: "Executor",
      role: "Rule-based action readiness agent",
      summary: "Controlled automation with hard approval limits.",
      actions: [
        "conditional review",
        "dca plan",
        "stop loss check",
        "lp review",
        "lend review",
      ],
      modules: ["NIRA-01", "NOVA-04", "NYX-05"],
    }],
  });
  const result = await lookupTelegramTemplateContext({
    agentId,
    serviceClient: client,
  });

  assertEquals(result.context.readOnlyActions.length, 0);
  assertEquals(result.context.gatedActions.length, 5);

  for (const action of result.context.actions) {
    assertEquals(action.availability, "phase6_wallet_gated");
  }
});
