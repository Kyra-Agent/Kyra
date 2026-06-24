import { OfficialMcpSafeError } from "./owner-auth.ts";
import { resolveOfficialMcpOwnerAgentBinding } from "./ownership.ts";

const ownerUserId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const otherOwnerId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const workspaceId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const otherWorkspaceId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const agentId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function assert(condition: unknown, message = "Assertion failed."): asserts condition {
  if (!condition) throw new Error(message);
}

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, got ${String(actual)}.`);
  }
}

async function assertSafeError(
  action: () => unknown | Promise<unknown>,
  expected: { status: number; code: string },
) {
  try {
    await action();
  } catch (error) {
    assert(error instanceof OfficialMcpSafeError);
    assertEquals(error.status, expected.status);
    assertEquals(error.code, expected.code);
    for (const value of [ownerUserId, otherOwnerId, workspaceId, agentId]) {
      assert(!error.safeMessage.includes(value));
      assert(!error.message.includes(value));
    }
    return;
  }

  throw new Error("Expected safe error.");
}

Deno.test("ownership rejects malformed identifiers before lookup", async () => {
  for (
    const input of [
      { ownerUserId: "bad", workspaceId, agentId },
      { ownerUserId: ownerUserId.toUpperCase(), workspaceId, agentId },
      { ownerUserId, workspaceId: ` ${workspaceId}`, agentId },
      { ownerUserId, workspaceId, agentId: `${agentId} ` },
    ]
  ) {
    let calls = 0;
    await assertSafeError(
      () =>
        resolveOfficialMcpOwnerAgentBinding(input, {
          lookupAgent: async () => {
            calls += 1;
            return { agentId, workspaceId };
          },
          lookupWorkspace: async () => {
            calls += 1;
            return { workspaceId, ownerUserId };
          },
        }),
      { status: 404, code: "requested_binding_not_found" },
    );
    assertEquals(calls, 0);
  }
});

Deno.test("ownership lookup order and exact ids are enforced", async () => {
  const calls: string[] = [];
  const binding = await resolveOfficialMcpOwnerAgentBinding(
    { ownerUserId, workspaceId, agentId },
    {
      lookupAgent: async (id) => {
        calls.push(`agent:${id}`);
        return { agentId, workspaceId, extra: "ignored" };
      },
      lookupWorkspace: async (id) => {
        calls.push(`workspace:${id}`);
        return { workspaceId, ownerUserId, extra: "ignored" };
      },
    },
  );

  assertEquals(calls.join("|"), `agent:${agentId}|workspace:${workspaceId}`);
  assertEquals(
    JSON.stringify(binding),
    JSON.stringify({ ownerUserId, workspaceId, agentId }),
  );
});

Deno.test("ownership returns identical 404 for inaccessible bindings", async () => {
  for (
    const setup of [
      { agent: null, workspace: { workspaceId, ownerUserId } },
      { agent: { agentId, workspaceId }, workspace: null },
      { agent: { agentId, workspaceId }, workspace: { workspaceId, ownerUserId: otherOwnerId } },
      { agent: { agentId, workspaceId: otherWorkspaceId }, workspace: { workspaceId, ownerUserId } },
      { agent: { agentId: otherOwnerId, workspaceId }, workspace: { workspaceId, ownerUserId } },
      { agent: { agentId, workspaceId }, workspace: { workspaceId: otherWorkspaceId, ownerUserId } },
      { agent: [], workspace: { workspaceId, ownerUserId } },
      { agent: { agentId, workspaceId }, workspace: [] },
    ]
  ) {
    await assertSafeError(
      () =>
        resolveOfficialMcpOwnerAgentBinding(
          { ownerUserId, workspaceId, agentId },
          {
            lookupAgent: async () => setup.agent,
            lookupWorkspace: async () => setup.workspace,
          },
        ),
      { status: 404, code: "requested_binding_not_found" },
    );
  }
});

Deno.test("ownership returns sanitized 500 for lookup availability failures", async () => {
  await assertSafeError(
    () =>
      resolveOfficialMcpOwnerAgentBinding(
        { ownerUserId, workspaceId, agentId },
        {
          lookupAgent: async () => {
            throw new Error(`select agents ${agentId}`);
          },
          lookupWorkspace: async () => ({ workspaceId, ownerUserId }),
        },
      ),
    { status: 500, code: "server_error" },
  );

  await assertSafeError(
    () =>
      resolveOfficialMcpOwnerAgentBinding(
        { ownerUserId, workspaceId, agentId },
        {
          lookupAgent: async () => ({ agentId, workspaceId }),
          lookupWorkspace: async () => {
            throw new Error(`select workspaces ${workspaceId}`);
          },
        },
      ),
    { status: 500, code: "server_error" },
  );
});
