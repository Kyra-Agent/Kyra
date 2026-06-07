import { HttpError } from "../telegram-connect/core.ts";
import {
  handleTelegramDashboardStatusRequest,
  maxTelegramDashboardStatusBodyBytes,
  type TelegramDashboardStatusDependencies,
  type TelegramDashboardStatusRecord,
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

const agentId = "11111111-1111-4111-8111-111111111111";
const secondAgentId = "22222222-2222-4222-8222-222222222222";
const ownerUserId = "33333333-3333-4333-8333-333333333333";

function makeRequest(options: {
  body?: string;
  authorization?: string;
  contentType?: string;
  contentLength?: string;
} = {}) {
  const headers = new Headers();

  if (options.authorization !== undefined) {
    headers.set("authorization", options.authorization);
  }

  if (options.contentType !== undefined) {
    headers.set("content-type", options.contentType);
  }

  if (options.contentLength !== undefined) {
    headers.set("content-length", options.contentLength);
  }

  return new Request(
    "https://kyra.test/functions/v1/telegram-dashboard-status",
    {
      method: "POST",
      headers,
      body: options.body ?? JSON.stringify({ agentIds: [agentId] }),
    },
  );
}

function createEnabledDependencies(
  overrides: Partial<TelegramDashboardStatusDependencies> = {},
): TelegramDashboardStatusDependencies {
  return {
    dashboardStatusRuntimeConfig: { enabled: true },
    getEnv: (key) => `test-${key}`,
    getUser: async () => ({ id: ownerUserId }),
    lookupDashboardTelegramStatuses: async () => [
      {
        agentId,
        botHandle: "@kyra_test_bot",
        webhookStatus: "active",
        ownerChatLinked: false,
        ownerLinkAvailable: true,
        lastEventAt: null,
      },
    ],
    ...overrides,
  };
}

Deno.test("telegram-dashboard-status default-off reads no body env session or lookup dependency", async () => {
  const request = makeRequest({
    contentType: "application/json",
  });
  const response = await handleTelegramDashboardStatusRequest(request, {
    dashboardStatusRuntimeConfig: { enabled: false },
    getEnv: () => {
      throw new Error("Disabled handler must not read env.");
    },
    getUser: async () => {
      throw new Error("Disabled handler must not validate session.");
    },
    lookupDashboardTelegramStatuses: async () => {
      throw new Error("Disabled handler must not query status.");
    },
  });
  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.status, "not_configured");
  assert(!request.bodyUsed, "Disabled handler must not read body.");
});

Deno.test("telegram-dashboard-status content-type and content-length guards run before body read", async () => {
  const wrongContentTypeRequest = makeRequest({
    contentType: "text/plain",
  });
  const wrongContentTypeResponse = await handleTelegramDashboardStatusRequest(
    wrongContentTypeRequest,
    { dashboardStatusRuntimeConfig: { enabled: false } },
  );
  const wrongContentTypeBody = await readJson(wrongContentTypeResponse);

  assertEquals(wrongContentTypeResponse.status, 415);
  assertEquals(wrongContentTypeBody.status, "unsupported_media_type");
  assert(!wrongContentTypeRequest.bodyUsed, "Content-type guard must not read body.");

  const oversizedRequest = makeRequest({
    contentType: "application/json",
    contentLength: String(maxTelegramDashboardStatusBodyBytes + 1),
  });
  const oversizedResponse = await handleTelegramDashboardStatusRequest(
    oversizedRequest,
    { dashboardStatusRuntimeConfig: { enabled: false } },
  );
  const oversizedBody = await readJson(oversizedResponse);

  assertEquals(oversizedResponse.status, 413);
  assertEquals(oversizedBody.status, "payload_too_large");
  assert(!oversizedRequest.bodyUsed, "Size guard must not read body.");
});

Deno.test("telegram-dashboard-status enabled path requires bearer before env body or lookup access", async () => {
  let envRead = false;
  let lookupCalled = false;
  const request = makeRequest({
    contentType: "application/json",
  });
  const response = await handleTelegramDashboardStatusRequest(
    request,
    createEnabledDependencies({
      getEnv: () => {
        envRead = true;
        return "unexpected";
      },
      lookupDashboardTelegramStatuses: async () => {
        lookupCalled = true;
        throw new Error("Missing bearer must reject before lookup.");
      },
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 401);
  assertEquals(body.status, "unauthorized");
  assert(!envRead, "Missing bearer must reject before env read.");
  assert(!lookupCalled, "Missing bearer must reject before lookup.");
  assert(!request.bodyUsed, "Missing bearer must reject before body read.");
});

Deno.test("telegram-dashboard-status maps invalid session to sanitized 401", async () => {
  let bodyRead = false;
  const request = makeRequest({
    authorization: "Bearer expired",
    contentType: "application/json",
  });
  const response = await handleTelegramDashboardStatusRequest(
    request,
    createEnabledDependencies({
      getUser: async () => {
        throw new HttpError(
          401,
          "unauthorized",
          "A valid Supabase session is required.",
        );
      },
      lookupDashboardTelegramStatuses: async () => {
        bodyRead = true;
        throw new Error("Invalid session must reject before lookup.");
      },
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 401);
  assertEquals(body.status, "unauthorized");
  assert(!bodyRead, "Invalid session must reject before lookup.");
  assert(!request.bodyUsed, "Invalid session must reject before body read.");
});

Deno.test("telegram-dashboard-status rejects invalid JSON with sanitized 400", async () => {
  let lookupCalled = false;
  const response = await handleTelegramDashboardStatusRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
      body: "{",
    }),
    createEnabledDependencies({
      lookupDashboardTelegramStatuses: async () => {
        lookupCalled = true;
        throw new Error("Invalid JSON must reject before lookup.");
      },
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 400);
  assertEquals(body.status, "invalid_request");
  assertEquals(body.message, "Request body must be valid JSON.");
  assert(!lookupCalled, "Invalid JSON must reject before lookup.");
});

Deno.test("telegram-dashboard-status rejects malformed agentIds and extra fields including botToken", async () => {
  for (
    const payload of [
      {},
      { agentIds: [] },
      { agentIds: [agentId, agentId] },
      { agentIds: ["not-a-uuid"] },
      { agentIds: [agentId], botToken: "must-not-be-accepted" },
    ]
  ) {
    let lookupCalled = false;
    const response = await handleTelegramDashboardStatusRequest(
      makeRequest({
        authorization: "Bearer session",
        contentType: "application/json",
        body: JSON.stringify(payload),
      }),
      createEnabledDependencies({
        lookupDashboardTelegramStatuses: async () => {
          lookupCalled = true;
          throw new Error("Invalid body must reject before lookup.");
        },
      }),
    );
    const body = await readJson(response);
    const serialized = JSON.stringify(body);

    assertEquals(response.status, 400);
    assertEquals(body.status, "invalid_request");
    assert(!lookupCalled, "Invalid body must reject before lookup.");
    assert(!serialized.includes("botToken"), "Response must hide token field.");
  }
});

Deno.test("telegram-dashboard-status enabled path returns only bounded dashboard fields", async () => {
  const records: TelegramDashboardStatusRecord[] = [
    {
      agentId,
      botHandle: "@kyra_test_bot",
      webhookStatus: "active",
      ownerChatLinked: true,
      ownerLinkAvailable: false,
      lastEventAt: "2026-06-07T01:02:03.000Z",
    },
    {
      agentId: secondAgentId,
      botHandle: null,
      webhookStatus: "queued",
      ownerChatLinked: false,
      ownerLinkAvailable: false,
      lastEventAt: null,
    },
  ];
  const lookupInputs: Array<Record<string, unknown>> = [];
  const response = await handleTelegramDashboardStatusRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
      body: JSON.stringify({ agentIds: [agentId, secondAgentId] }),
    }),
    createEnabledDependencies({
      lookupDashboardTelegramStatuses: async (input) => {
        lookupInputs.push(input);
        return records;
      },
    }),
  );
  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 200);
  assertEquals(body.status, "ready");
  assertEquals(Array.isArray(body.telegramStatuses), true);
  assertEquals(lookupInputs.length, 1);
  assertEquals(JSON.stringify(lookupInputs[0]?.agentIds), JSON.stringify([agentId, secondAgentId]));
  assertEquals(lookupInputs[0]?.ownerUserId, ownerUserId);
  assert(serialized.includes(agentId), "Response may include requested agentId.");
  assert(serialized.includes("ownerChatLinked"), "Response must include bounded linked flag.");
  assert(!serialized.includes(ownerUserId), "Response must hide owner id.");
  assert(!serialized.includes("workspace_id"), "Response must hide workspace fields.");
  assert(!serialized.includes("telegram_user_id"), "Response must hide Telegram user id.");
  assert(!serialized.includes("telegram_chat_id"), "Response must hide Telegram chat id.");
  assert(!serialized.includes("telegramSessionId"), "Response must hide session id.");
  assert(!serialized.includes("token_secret_ref"), "Response must hide token ref.");
  assert(!serialized.includes("webhook_secret"), "Response must hide webhook secret.");
});

Deno.test("telegram-dashboard-status sanitizes lookup errors and malformed rows", async () => {
  const lookupCases: Array<
    NonNullable<
      TelegramDashboardStatusDependencies["lookupDashboardTelegramStatuses"]
    >
  > = [
    async () => {
      throw new Error(
        `raw owner_user_id ${ownerUserId} telegram_chat_id token_secret_ref`,
      );
    },
    async () =>
      [
        {
          agentId,
          botHandle: "@kyra_test_bot",
          webhookStatus: "active",
          ownerChatLinked: true,
          ownerLinkAvailable: false,
          lastEventAt: null,
          ownerUserId,
        },
      ] as unknown as TelegramDashboardStatusRecord[],
    async () =>
      [
        {
          agentId: secondAgentId,
          botHandle: "@kyra_test_bot",
          webhookStatus: "active",
          ownerChatLinked: true,
          ownerLinkAvailable: false,
          lastEventAt: null,
        },
      ] as TelegramDashboardStatusRecord[],
  ];

  for (
    const lookupDashboardTelegramStatuses of lookupCases
  ) {
    const response = await handleTelegramDashboardStatusRequest(
      makeRequest({
        authorization: "Bearer session",
        contentType: "application/json",
      }),
      createEnabledDependencies({ lookupDashboardTelegramStatuses }),
    );
    const body = await readJson(response);
    const serialized = JSON.stringify(body);

    assertEquals(response.status, 500);
    assertEquals(body.status, "server_error");
    assert(!serialized.includes(ownerUserId), "Error must hide owner id.");
    assert(!serialized.includes("telegram_chat_id"), "Error must hide chat id.");
    assert(!serialized.includes("token_secret_ref"), "Error must hide token ref.");
  }
});

Deno.test("telegram-dashboard-status OPTIONS returns CORS response", async () => {
  const response = await handleTelegramDashboardStatusRequest(
    new Request("https://kyra.test/functions/v1/telegram-dashboard-status", {
      method: "OPTIONS",
    }),
  );

  assertEquals(response.status, 200);
  assertEquals(await response.text(), "ok");
  assertEquals(
    response.headers.get("Access-Control-Allow-Methods"),
    "POST, OPTIONS",
  );
});
