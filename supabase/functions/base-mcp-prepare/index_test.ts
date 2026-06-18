import {
  type BaseMcpPrepareDependencies,
  handleBaseMcpPrepareRequest,
  maxBaseMcpPrepareBodyBytes,
  maxBaseMcpPrepareFutureSkewMs,
  maxBaseMcpPreparePreviewTtlMs,
  maxBaseMcpPrepareRequestAgeMs,
} from "./core.ts";
import { createBaseMcpPrepareDependenciesFromOptions } from "./dependencies.ts";
import type { OwnershipLookupClient } from "../telegram-connect/core.ts";
import type { BaseMcpRateLimitRpcClient } from "./rate-limit.ts";

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
const workspaceId = "22222222-2222-4222-8222-222222222222";
const ownerUserId = "33333333-3333-4333-8333-333333333333";
const fixedNow = new Date("2026-06-14T01:02:03.000Z");

function validPayload(overrides: Record<string, unknown> = {}) {
  return {
    actionKind: "base_mcp_status_check",
    agentId,
    workspaceId,
    requestId: "base-mcp-request-01",
    chain: "base",
    mode: "read_only",
    requestedAt: fixedNow.toISOString(),
    ...overrides,
  };
}

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

  return new Request("https://kyra.test/functions/v1/base-mcp-prepare", {
    method: "POST",
    headers,
    body: options.body ?? JSON.stringify(validPayload()),
  });
}

function createEnabledDependencies(
  overrides: Partial<BaseMcpPrepareDependencies> = {},
): BaseMcpPrepareDependencies {
  return {
    baseMcpPrepareRuntimeConfig: {
      enabled: true,
      endpoint: "https://base-mcp.test",
      providerProtocol: "kyra_status_v1",
      apiKey: null,
      timeoutMs: 2500,
    },
    getEnv: (key) => `test-${key}`,
    getUser: async () => ({ id: ownerUserId }),
    getNow: () => fixedNow,
    lookupAgentOwnership: async () => ({
      agentId,
      ownerUserId,
      workspaceId,
    }),
    checkBaseMcpRateLimit: async () => ({
      allowed: true,
      status: "allowed",
    }),
    prepareBaseMcpAction: async () => ({
      ok: true,
      status: "preview_ready",
      summary: {
        actionKind: "base_mcp_status_check",
        chain: "Base",
        routeSummary: "Base MCP status check only.",
        valueSummary: "No token spend, no gas request, no calldata.",
        risk: "read-only",
        expiryIso: null,
        opaquePayloadRef: null,
      },
    }),
    ...overrides,
  };
}

function createOwnershipLookupClient():
  & OwnershipLookupClient
  & BaseMcpRateLimitRpcClient {
  const rows = {
    agent_instances: [{ id: agentId, workspace_id: workspaceId }],
    workspaces: [{ id: workspaceId, owner_user_id: ownerUserId }],
  };

  return {
    async rpc() {
      return {
        data: [{ allowed: true, status: "allowed" }],
        error: null,
      };
    },
    from(table) {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        async maybeSingle<T>() {
          const data = rows[table as keyof typeof rows]?.[0] ?? null;
          return { data: data as T, error: null };
        },
      };

      return builder;
    },
  };
}

Deno.test("base-mcp-prepare default-off reads no body env session ownership or adapter", async () => {
  const request = makeRequest({
    contentType: "application/json",
  });
  const response = await handleBaseMcpPrepareRequest(request, {
    baseMcpPrepareRuntimeConfig: { enabled: false },
    getEnv: () => {
      throw new Error("Disabled handler must not read env.");
    },
    getUser: async () => {
      throw new Error("Disabled handler must not validate session.");
    },
    lookupAgentOwnership: async () => {
      throw new Error("Disabled handler must not query ownership.");
    },
    prepareBaseMcpAction: async () => {
      throw new Error("Disabled handler must not call adapter.");
    },
  });
  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.code, "base_mcp_disabled");
  assertEquals(body.message, "Base MCP preparation is disabled.");
  assert(!request.bodyUsed, "Disabled handler must not read body.");
});

Deno.test("base-mcp-prepare content-type and size guards run before body read", async () => {
  const wrongContentTypeRequest = makeRequest({
    contentType: "text/plain",
  });
  const wrongContentTypeResponse = await handleBaseMcpPrepareRequest(
    wrongContentTypeRequest,
    { baseMcpPrepareRuntimeConfig: { enabled: false } },
  );
  const wrongContentTypeBody = await readJson(wrongContentTypeResponse);

  assertEquals(wrongContentTypeResponse.status, 415);
  assertEquals(wrongContentTypeBody.status, "unsupported_media_type");
  assert(
    !wrongContentTypeRequest.bodyUsed,
    "Content-type guard must not read body.",
  );

  const oversizedRequest = makeRequest({
    contentType: "application/json",
    contentLength: String(maxBaseMcpPrepareBodyBytes + 1),
  });
  const oversizedResponse = await handleBaseMcpPrepareRequest(
    oversizedRequest,
    { baseMcpPrepareRuntimeConfig: { enabled: false } },
  );
  const oversizedBody = await readJson(oversizedResponse);

  assertEquals(oversizedResponse.status, 413);
  assertEquals(oversizedBody.status, "payload_too_large");
  assert(!oversizedRequest.bodyUsed, "Size guard must not read body.");
});

Deno.test("base-mcp-prepare enabled path requires bearer before env body ownership or adapter", async () => {
  let envRead = false;
  let ownershipCalled = false;
  let adapterCalled = false;
  const request = makeRequest({
    contentType: "application/json",
  });
  const response = await handleBaseMcpPrepareRequest(
    request,
    createEnabledDependencies({
      getEnv: () => {
        envRead = true;
        return "unexpected";
      },
      lookupAgentOwnership: async () => {
        ownershipCalled = true;
        return null;
      },
      prepareBaseMcpAction: async () => {
        adapterCalled = true;
        throw new Error("Missing bearer must reject before adapter.");
      },
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 401);
  assertEquals(body.status, "unauthorized");
  assert(!envRead, "Missing bearer must reject before env read.");
  assert(!ownershipCalled, "Missing bearer must reject before ownership.");
  assert(!adapterCalled, "Missing bearer must reject before adapter.");
  assert(!request.bodyUsed, "Missing bearer must reject before body read.");
});

Deno.test("base-mcp-prepare invalid session rejects before body ownership or adapter", async () => {
  let ownershipCalled = false;
  let adapterCalled = false;
  const request = makeRequest({
    authorization: "Bearer expired",
    contentType: "application/json",
  });
  const response = await handleBaseMcpPrepareRequest(
    request,
    createEnabledDependencies({
      getUser: async () => {
        throw new Error("raw jwt token_secret_ref should not leak");
      },
      lookupAgentOwnership: async () => {
        ownershipCalled = true;
        return null;
      },
      prepareBaseMcpAction: async () => {
        adapterCalled = true;
        throw new Error("Invalid session must reject before adapter.");
      },
    }),
  );
  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 500);
  assertEquals(body.status, "server_error");
  assert(
    !serialized.includes("token_secret_ref"),
    "Response must hide raw session error.",
  );
  assert(!ownershipCalled, "Invalid session must reject before ownership.");
  assert(!adapterCalled, "Invalid session must reject before adapter.");
  assert(!request.bodyUsed, "Invalid session must reject before body read.");
});

Deno.test("base-mcp-prepare rejects malformed payloads and token fields before ownership or adapter", async () => {
  for (
    const payload of [
      {},
      validPayload({ agentId: "not-a-uuid" }),
      validPayload({ workspaceId: "not-a-uuid" }),
      validPayload({ mode: "write" }),
      validPayload({ chain: "ethereum" }),
      { ...validPayload(), botToken: "12345:must-not-be-accepted" },
    ]
  ) {
    let ownershipCalled = false;
    let adapterCalled = false;
    const response = await handleBaseMcpPrepareRequest(
      makeRequest({
        authorization: "Bearer session",
        contentType: "application/json",
        body: JSON.stringify(payload),
      }),
      createEnabledDependencies({
        lookupAgentOwnership: async () => {
          ownershipCalled = true;
          return null;
        },
        prepareBaseMcpAction: async () => {
          adapterCalled = true;
          throw new Error("Invalid request must reject before adapter.");
        },
      }),
    );
    const body = await readJson(response);
    const serialized = JSON.stringify(body);

    assertEquals(response.status, 400);
    assertEquals(body.status, "invalid_request");
    assert(!ownershipCalled, "Invalid body must reject before ownership.");
    assert(!adapterCalled, "Invalid body must reject before adapter.");
    assert(!serialized.includes("botToken"), "Response must hide token field.");
  }
});

Deno.test("base-mcp-prepare rejects stale and future requests before ownership or adapter", async () => {
  const staleRequestedAt = new Date(
    fixedNow.getTime() - maxBaseMcpPrepareRequestAgeMs - 1,
  ).toISOString();
  const futureRequestedAt = new Date(
    fixedNow.getTime() + maxBaseMcpPrepareFutureSkewMs + 1,
  ).toISOString();

  for (const requestedAt of [staleRequestedAt, futureRequestedAt]) {
    let ownershipCalled = false;
    let adapterCalled = false;
    const response = await handleBaseMcpPrepareRequest(
      makeRequest({
        authorization: "Bearer session",
        contentType: "application/json",
        body: JSON.stringify(validPayload({ requestedAt })),
      }),
      createEnabledDependencies({
        lookupAgentOwnership: async () => {
          ownershipCalled = true;
          return null;
        },
        prepareBaseMcpAction: async () => {
          adapterCalled = true;
          throw new Error("Stale request must reject before adapter.");
        },
      }),
    );
    const body = await readJson(response);

    assertEquals(response.status, 400);
    assertEquals(body.status, "invalid_request");
    assert(
      !ownershipCalled,
      "Stale or future body must reject before ownership.",
    );
    assert(!adapterCalled, "Stale or future body must reject before adapter.");
  }
});

Deno.test("base-mcp-prepare unsupported action fails closed without ownership or adapter", async () => {
  let ownershipCalled = false;
  let adapterCalled = false;
  const response = await handleBaseMcpPrepareRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
      body: JSON.stringify(validPayload({ actionKind: "swap" })),
    }),
    createEnabledDependencies({
      lookupAgentOwnership: async () => {
        ownershipCalled = true;
        return null;
      },
      prepareBaseMcpAction: async () => {
        adapterCalled = true;
        throw new Error("Unsupported action must not call adapter.");
      },
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 400);
  assertEquals(body.code, "base_mcp_unknown_action");
  assertEquals(body.message, "This Base MCP action is not supported.");
  assert(!ownershipCalled, "Unsupported action must not query ownership.");
  assert(!adapterCalled, "Unsupported action must not call adapter.");
});

Deno.test("base-mcp-prepare verifies ownership before configured adapter", async () => {
  let adapterCalled = false;
  const response = await handleBaseMcpPrepareRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
    }),
    createEnabledDependencies({
      lookupAgentOwnership: async () => null,
      prepareBaseMcpAction: async () => {
        adapterCalled = true;
        throw new Error("Missing ownership must reject before adapter.");
      },
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 404);
  assertEquals(body.status, "agent_not_found");
  assert(!adapterCalled, "Missing ownership must reject before adapter.");
});

Deno.test("base-mcp-prepare enabled but unwired adapter returns sanitized not configured", async () => {
  const response = await handleBaseMcpPrepareRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
    }),
    createEnabledDependencies({
      prepareBaseMcpAction: undefined,
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 501);
  assertEquals(body.code, "base_mcp_not_configured");
  assertEquals(body.message, "Base MCP preparation is not configured.");
});

Deno.test("base-mcp-prepare validates provider config before consuming rate limit", async () => {
  let limiterCalled = false;
  const response = await handleBaseMcpPrepareRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
    }),
    createEnabledDependencies({
      baseMcpPrepareRuntimeConfig: {
        enabled: true,
        endpoint: "https://base-mcp.test",
        providerProtocol: null,
        apiKey: null,
        timeoutMs: 2500,
      },
      checkBaseMcpRateLimit: async () => {
        limiterCalled = true;
        return { allowed: true, status: "allowed" };
      },
    }),
  );

  assertEquals(response.status, 501);
  assertEquals((await readJson(response)).code, "base_mcp_not_configured");
  assert(
    !limiterCalled,
    "Invalid provider config must not consume rate limit.",
  );
});

Deno.test("base-mcp-prepare rate limits after ownership and before provider", async () => {
  const order: string[] = [];
  const response = await handleBaseMcpPrepareRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
    }),
    createEnabledDependencies({
      lookupAgentOwnership: async () => {
        order.push("ownership");
        return { agentId, ownerUserId, workspaceId };
      },
      checkBaseMcpRateLimit: async () => {
        order.push("rate-limit");
        return { allowed: false, status: "rate_limited" };
      },
      prepareBaseMcpAction: async () => {
        order.push("provider");
        throw new Error("Rate-limited request must not call provider.");
      },
    }),
  );
  const body = await readJson(response);

  assertEquals(response.status, 429);
  assertEquals(body.code, "base_mcp_rate_limited");
  assertEquals(order.join(","), "ownership,rate-limit");
  assertEquals(
    response.headers.get("x-kyra-request-id"),
    "base-mcp-request-01",
  );
  assertEquals(
    response.headers.get("x-kyra-base-mcp-outcome"),
    "base_mcp_rate_limited",
  );
});

Deno.test("base-mcp-prepare fails closed when rate limit check fails", async () => {
  for (
    const checkBaseMcpRateLimit of [
      async () => ({ allowed: true, status: "unexpected" }) as never,
      async () => {
        throw new Error("raw limiter error");
      },
    ]
  ) {
    let adapterCalled = false;
    const response = await handleBaseMcpPrepareRequest(
      makeRequest({
        authorization: "Bearer session",
        contentType: "application/json",
      }),
      createEnabledDependencies({
        checkBaseMcpRateLimit,
        prepareBaseMcpAction: async () => {
          adapterCalled = true;
          throw new Error("Broken limiter must reject before provider.");
        },
      }),
    );
    const body = await readJson(response);

    assertEquals(response.status, 500);
    assertEquals(body.status, "server_error");
    assertEquals(body.message, "Base MCP rate limit check failed.");
    assert(!adapterCalled, "Broken limiter must reject before provider.");
  }
});

Deno.test("base-mcp-prepare returns bounded status-check preview from injected adapter", async () => {
  const response = await handleBaseMcpPrepareRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
    }),
    createEnabledDependencies(),
  );
  const body = await readJson(response);
  const serialized = JSON.stringify(body);

  assertEquals(response.status, 200);
  assertEquals(body.ok, true);
  assertEquals(body.status, "preview_ready");
  assert(
    serialized.includes("base_mcp_status_check"),
    "Response should include action kind.",
  );
  assert(!serialized.includes(ownerUserId), "Response must hide owner id.");
  assert(!serialized.includes(workspaceId), "Response must hide workspace id.");
  assert(
    !serialized.includes("https://base-mcp.test"),
    "Response must hide endpoint.",
  );
  assert(!serialized.includes("apiKey"), "Response must hide API key fields.");
  assert(
    !serialized.includes("rawCalldata"),
    "Response must not expose raw calldata fields.",
  );
  assert(
    !serialized.includes("0xdeadbeef"),
    "Response must not expose raw calldata values.",
  );
});

Deno.test("base-mcp-prepare stores only sanitized prepared-action summary after preview success", async () => {
  const storedInputs: unknown[] = [];
  const response = await handleBaseMcpPrepareRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
    }),
    createEnabledDependencies({
      storePreparedActionSummary: async (input) => {
        storedInputs.push(input);
        return { ok: true };
      },
    }),
  );
  const body = await readJson(response);
  const serializedResponse = JSON.stringify(body);
  const serializedStorageInput = JSON.stringify(storedInputs[0]);

  assertEquals(response.status, 200);
  assertEquals(storedInputs.length, 1);
  assertEquals(body.ok, true);
  assert(
    serializedStorageInput.includes(ownerUserId),
    "Storage input needs owner scope.",
  );
  assert(
    serializedStorageInput.includes(workspaceId),
    "Storage input needs workspace scope.",
  );
  assert(
    !serializedStorageInput.includes("opaquePayloadRef"),
    "Storage input must not carry opaque provider payload refs.",
  );
  assert(
    !serializedStorageInput.includes("https://base-mcp.test"),
    "Storage input must hide provider endpoint.",
  );
  assert(
    !serializedStorageInput.includes("apiKey"),
    "Storage input must hide API key fields.",
  );
  assert(
    !serializedStorageInput.includes("rawCalldata"),
    "Storage input must not carry raw calldata fields.",
  );
  assert(
    !serializedResponse.includes(ownerUserId),
    "Response must hide owner id.",
  );
  assert(
    !serializedResponse.includes(workspaceId),
    "Response must hide workspace id.",
  );
});

Deno.test("base-mcp-prepare does not store before successful preview and sanitizes storage failure", async () => {
  let storageCalls = 0;
  const adapterFailureResponse = await handleBaseMcpPrepareRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
    }),
    createEnabledDependencies({
      prepareBaseMcpAction: async () => ({
        ok: false,
        status: "blocked",
        code: "base_mcp_timeout",
        message: "Base MCP preparation timed out.",
      }),
      storePreparedActionSummary: async () => {
        storageCalls += 1;
        return { ok: true };
      },
    }),
  );
  const adapterFailureBody = await readJson(adapterFailureResponse);

  assertEquals(adapterFailureResponse.status, 504);
  assertEquals(adapterFailureBody.code, "base_mcp_timeout");
  assertEquals(storageCalls, 0);

  const storageFailureResponse = await handleBaseMcpPrepareRequest(
    makeRequest({
      authorization: "Bearer session",
      contentType: "application/json",
    }),
    createEnabledDependencies({
      storePreparedActionSummary: async () => {
        storageCalls += 1;
        throw new Error("prepared_actions raw provider payload leaked");
      },
    }),
  );
  const storageFailureBody = await readJson(storageFailureResponse);
  const serialized = JSON.stringify(storageFailureBody);

  assertEquals(storageFailureResponse.status, 502);
  assertEquals(storageFailureBody.code, "base_mcp_unavailable");
  assertEquals(
    storageFailureBody.message,
    "No Base MCP action can be prepared right now.",
  );
  assertEquals(storageCalls, 1);
  assert(
    !serialized.includes("raw provider payload"),
    "Response must hide storage errors.",
  );
});

Deno.test("base-mcp-prepare sanitizes adapter errors and invalid adapter payloads", async () => {
  const expiredPreview = new Date(fixedNow.getTime() - 1).toISOString();
  const farFuturePreview = new Date(
    fixedNow.getTime() + maxBaseMcpPreparePreviewTtlMs + 1,
  ).toISOString();
  const adapterCases: BaseMcpPrepareDependencies["prepareBaseMcpAction"][] = [
    async () => {
      throw new Error(
        "provider failed https://base-mcp.test KYRA_BASE_MCP_API_KEY raw calldata token_secret_ref",
      );
    },
    async () =>
      ({
        ok: true,
        status: "preview_ready",
        summary: {
          actionKind: "base_mcp_status_check",
          chain: "Base",
          routeSummary: "Base MCP status check only.",
          valueSummary: "No token spend.",
          risk: "read-only",
          expiryIso: null,
          opaquePayloadRef: "raw-provider-ref",
        },
      }) as never,
    async () =>
      ({
        ok: false,
        status: "failed",
        code: "base_mcp_unavailable",
        message: "raw provider error should not pass",
      }) as never,
    async () =>
      ({
        ok: true,
        status: "preview_ready",
        summary: {
          actionKind: "base_mcp_status_check",
          chain: "Base",
          routeSummary: "Base MCP status check only.",
          valueSummary: "No token spend.",
          risk: "read-only",
          expiryIso: expiredPreview,
          opaquePayloadRef: null,
        },
      }) as never,
    async () =>
      ({
        ok: true,
        status: "preview_ready",
        summary: {
          actionKind: "base_mcp_status_check",
          chain: "Base",
          routeSummary: "Base MCP status check only.",
          valueSummary: "No token spend.",
          risk: "read-only",
          expiryIso: farFuturePreview,
          opaquePayloadRef: null,
        },
      }) as never,
  ];

  for (const prepareBaseMcpAction of adapterCases) {
    const response = await handleBaseMcpPrepareRequest(
      makeRequest({
        authorization: "Bearer session",
        contentType: "application/json",
      }),
      createEnabledDependencies({ prepareBaseMcpAction }),
    );
    const body = await readJson(response);
    const serialized = JSON.stringify(body);

    assertEquals(response.status, 502);
    assertEquals(body.code, "base_mcp_unavailable");
    assertEquals(body.message, "No Base MCP action can be prepared right now.");
    assert(
      !serialized.includes("https://base-mcp.test"),
      "Response must hide endpoint.",
    );
    assert(
      !serialized.includes("KYRA_BASE_MCP_API_KEY"),
      "Response must hide API key name.",
    );
    assert(
      !serialized.includes("raw calldata"),
      "Response must hide calldata.",
    );
    assert(
      !serialized.includes("token_secret_ref"),
      "Response must hide token refs.",
    );
  }
});

Deno.test("base-mcp-prepare runtime dependencies stay inert while disabled", () => {
  const optionalEnvReads: string[] = [];
  const dependencies = createBaseMcpPrepareDependenciesFromOptions({
    getOptionalEnv: (key) => {
      optionalEnvReads.push(key);
      return "";
    },
    getEnv: () => {
      throw new Error("Disabled runtime must not read required env.");
    },
    getUser: async () => {
      throw new Error("Disabled runtime must not validate user.");
    },
    createServiceClient: () => {
      throw new Error("Disabled runtime must not create service client.");
    },
  });

  assertEquals(dependencies.baseMcpPrepareRuntimeConfig?.enabled, false);
  assertEquals(dependencies.lookupAgentOwnership, undefined);
  assertEquals(optionalEnvReads.join(","), "KYRA_BASE_MCP_PREP_ENABLED");
});

Deno.test("base-mcp-prepare runtime ownership lookup reads service role lazily", async () => {
  const envReads: string[] = [];
  const serviceClientInputs: string[] = [];
  const providerRequests: Request[] = [];
  const dependencies = createBaseMcpPrepareDependenciesFromOptions({
    getOptionalEnv: (key) => {
      if (key === "KYRA_BASE_MCP_PREP_ENABLED") {
        return "true";
      }
      if (key === "KYRA_BASE_MCP_ENDPOINT") {
        return "https://base-mcp.test";
      }
      if (key === "KYRA_BASE_MCP_PROVIDER_PROTOCOL") {
        return "kyra_status_v1";
      }
      return "";
    },
    getEnv: (key) => {
      envReads.push(key);
      return `env-${key}`;
    },
    getUser: async () => ({ id: ownerUserId }),
    createServiceClient: (supabaseUrl, serviceRoleKey) => {
      serviceClientInputs.push(`${supabaseUrl}:${serviceRoleKey}`);
      return createOwnershipLookupClient();
    },
    baseMcpProviderTransport: async (request) => {
      providerRequests.push(request);
      return Response.json({
        protocol: "kyra_status_v1",
        status: "ok",
        actionKind: "base_mcp_status_check",
        chain: "base",
        mode: "read_only",
        requestId: "base-mcp-request-01",
      });
    },
  });

  assertEquals(dependencies.baseMcpPrepareRuntimeConfig?.enabled, true);
  assertEquals(typeof dependencies.lookupAgentOwnership, "function");
  assertEquals(typeof dependencies.prepareBaseMcpAction, "function");
  assertEquals(dependencies.storePreparedActionSummary, undefined);
  assertEquals(envReads.length, 0);
  assertEquals(serviceClientInputs.length, 0);

  const ownership = await dependencies.lookupAgentOwnership?.(
    agentId,
    ownerUserId,
  );

  assertEquals(
    envReads.join(","),
    "SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY",
  );
  assertEquals(
    serviceClientInputs.join(","),
    "env-SUPABASE_URL:env-SUPABASE_SERVICE_ROLE_KEY",
  );
  assertEquals(ownership?.workspaceId, workspaceId);

  await dependencies.lookupAgentOwnership?.(agentId, ownerUserId);
  assertEquals(serviceClientInputs.length, 1);

  const providerInput: Parameters<
    NonNullable<BaseMcpPrepareDependencies["prepareBaseMcpAction"]>
  >[0] = {
    actionKind: "base_mcp_status_check",
    agentId,
    workspaceId,
    requestId: "base-mcp-request-01",
    chain: "base",
    mode: "read_only",
    requestedAt: fixedNow.toISOString(),
  };
  const providerResult = await dependencies.prepareBaseMcpAction?.(
    providerInput,
    {
      enabled: true,
      endpoint: "https://base-mcp.test",
      providerProtocol: "kyra_status_v1",
      apiKey: "backend-only-key",
      timeoutMs: 2500,
    },
  );
  const providerRequest = providerRequests[0];
  const providerBody = await providerRequest.json() as Record<string, unknown>;
  const serializedProviderBody = JSON.stringify(providerBody);

  assertEquals(providerResult?.ok, true);
  assertEquals(providerRequests.length, 1);
  assertEquals(providerRequest.url, "https://base-mcp.test/status-check");
  assertEquals(
    providerRequest.headers.get("authorization"),
    "Bearer backend-only-key",
  );
  assertEquals(providerBody.actionKind, "base_mcp_status_check");
  assertEquals(providerBody.chain, "base");
  assertEquals(providerBody.mode, "read_only");
  assert(
    !serializedProviderBody.includes(agentId),
    "Provider payload must not include agent id.",
  );
  assert(
    !serializedProviderBody.includes(workspaceId),
    "Provider payload must not include workspace id.",
  );
  assert(
    !serializedProviderBody.includes(ownerUserId),
    "Provider payload must not include owner id.",
  );
});

Deno.test("base-mcp-prepare OPTIONS returns CORS response", async () => {
  const response = await handleBaseMcpPrepareRequest(
    new Request("https://kyra.test/functions/v1/base-mcp-prepare", {
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
