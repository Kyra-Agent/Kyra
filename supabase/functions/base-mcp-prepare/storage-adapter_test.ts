import {
  baseMcpPreparedActionApprovalRequirement,
  baseMcpPreparedActionSafetyNote,
  createPreparedActionInsertRow,
  createPreparedActionStorageAdapter,
  type PreparedActionInsertRow,
} from "./storage-adapter.ts";
import type { BaseMcpPreparedActionStorageInput } from "./core.ts";

function assert(condition: boolean, message: string): asserts condition {
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

const fixedNow = new Date("2026-06-14T01:02:03.000Z");

function validStorageInput(
  overrides: Partial<BaseMcpPreparedActionStorageInput> = {},
): BaseMcpPreparedActionStorageInput {
  return {
    ownerUserId: "33333333-3333-4333-8333-333333333333",
    workspaceId: "22222222-2222-4222-8222-222222222222",
    agentId: "11111111-1111-4111-8111-111111111111",
    requestId: "base-mcp-request-01",
    requestedAt: fixedNow.toISOString(),
    actionKind: "base_mcp_status_check",
    chain: "Base",
    routeSummary: "Base MCP status check only.",
    valueSummary: "No token spend, no gas request, no calldata.",
    risk: "read-only",
    expiryIso: null,
    ...overrides,
  };
}

Deno.test("prepared action storage row maps only bounded Base MCP preview fields", () => {
  const input = validStorageInput();
  const row = createPreparedActionInsertRow(input, fixedNow);
  const serialized = JSON.stringify(row);

  assertEquals(row.workspace_id, input.workspaceId);
  assertEquals(row.agent_id, input.agentId);
  assertEquals(row.request_id, input.requestId);
  assertEquals(row.action_kind, "base_mcp_status_check");
  assertEquals(row.chain, "base");
  assertEquals(row.status, "preview_ready");
  assertEquals(row.risk, "read-only");
  assertEquals(row.route_summary, input.routeSummary);
  assertEquals(row.value_summary, input.valueSummary);
  assertEquals(
    row.approval_requirement,
    baseMcpPreparedActionApprovalRequirement,
  );
  assertEquals(row.safety_note, baseMcpPreparedActionSafetyNote);
  assertEquals(row.provider, "base_mcp");
  assertEquals(row.provider_payload_ref, null);
  assertEquals(row.expires_at, null);
  assertEquals(row.created_at, fixedNow.toISOString());
  assertEquals(row.updated_at, fixedNow.toISOString());
  assert(
    !serialized.includes(input.ownerUserId),
    "Row must not store owner id.",
  );
  assert(
    !serialized.includes("requestedAt"),
    "Row must not store request timestamp as a browser field.",
  );
  assert(
    !serialized.includes("providerPayloadRef"),
    "Row must not store provider payload refs.",
  );
  assert(
    !serialized.includes("walletAddress"),
    "Row must not store wallet address fields.",
  );
  assert(
    !serialized.includes("privateKey"),
    "Row must not store private key fields.",
  );
  assert(
    !serialized.includes("seedPhrase"),
    "Row must not store seed phrase fields.",
  );
  assert(
    !serialized.includes("telegramToken"),
    "Row must not store Telegram token fields.",
  );
  assert(!serialized.includes("apiKey"), "Row must not store API key data.");
});

Deno.test("prepared action storage adapter upserts with idempotent conflict key", async () => {
  const rows: PreparedActionInsertRow[] = [];
  const conflicts: string[] = [];
  const adapter = createPreparedActionStorageAdapter({
    from(table) {
      assertEquals(table, "prepared_actions");

      return {
        upsert(row, options) {
          rows.push(row);
          conflicts.push(options.onConflict);

          return {
            select(columns) {
              assertEquals(columns, "id");

              return {
                maybeSingle: async () => ({
                  data: { id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" },
                  error: null,
                }),
              };
            },
          };
        },
      };
    },
  }, () => fixedNow);

  const result = await adapter(validStorageInput({
    expiryIso: "2026-06-14T01:07:03.000Z",
  }));

  assertEquals(result.ok, true);
  assertEquals(rows.length, 1);
  assertEquals(conflicts.join(","), "workspace_id,agent_id,request_id");
  assertEquals(rows[0].expires_at, "2026-06-14T01:07:03.000Z");
});

Deno.test("prepared action storage adapter fails closed on write errors", async () => {
  const adapter = createPreparedActionStorageAdapter({
    from() {
      return {
        upsert() {
          return {
            select() {
              return {
                maybeSingle: async () => ({
                  data: null,
                  error: { message: "raw provider payload should not leak" },
                }),
              };
            },
          };
        },
      };
    },
  }, () => fixedNow);

  try {
    await adapter(validStorageInput());
  } catch (error) {
    assert(
      error instanceof Error,
      "Storage adapter should throw a generic Error.",
    );
    assertEquals(error.message, "Prepared action storage failed.");
    return;
  }

  throw new Error("Expected storage adapter to fail closed.");
});
