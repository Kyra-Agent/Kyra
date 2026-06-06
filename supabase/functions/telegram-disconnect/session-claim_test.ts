import {
  assertTelegramDisconnectClaimRow,
  claimTelegramDisconnectSession,
} from "./session-claim.ts";
import { HttpError } from "../telegram-connect/core.ts";

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

async function captureError(fn: () => unknown | Promise<unknown>) {
  try {
    await fn();
  } catch (error) {
    return error;
  }

  throw new Error("Expected function to throw.");
}

const agentId = "11111111-1111-4111-8111-111111111111";
const ownerUserId = "33333333-3333-4333-8333-333333333333";
const telegramSessionId = "22222222-2222-4222-8222-222222222222";
const tokenSecretRef = "mock_telegram_token_ref_000001";
const webhookSecretRef = "webhook:telegram:44444444-4444-4444-8444-444444444444";

function claimRow(overrides: Record<string, unknown> = {}) {
  return {
    claimed: true,
    status: "claimed",
    telegram_session_id: telegramSessionId,
    agent_id: agentId,
    bot_handle: "@kyra_test_bot",
    token_secret_ref: null,
    webhook_secret_ref: null,
    ...overrides,
  };
}

Deno.test("telegram-disconnect claim adapter calls exact RPC with sanitized params", async () => {
  const calls: Array<{ functionName: string; args: Record<string, unknown> }> =
    [];
  const result = await claimTelegramDisconnectSession({
    agentId: ` ${agentId} `,
    ownerUserId,
    action: "pause",
    rpcClient: {
      rpc(functionName, args) {
        calls.push({ functionName, args });

        return { data: [claimRow()], error: null };
      },
    },
  });

  assertEquals(calls.length, 1);
  assertEquals(calls[0].functionName, "claim_telegram_disconnect_session");
  assertEquals(calls[0].args.p_agent_id, agentId);
  assertEquals(calls[0].args.p_owner_user_id, ownerUserId);
  assertEquals(calls[0].args.p_action, "pause");
  assertEquals(result.claimed, true);
  assertEquals(result.action, "pause");
  assertEquals(result.telegramSessionId, telegramSessionId);
  assertEquals(result.agentId, agentId);
  assertEquals(result.botHandle, "@kyra_test_bot");
  assertEquals(result.tokenSecretRef, undefined);
  assertEquals(result.webhookSecretRef, undefined);
});

Deno.test("telegram-disconnect disconnect and revoke claims require bounded refs", () => {
  const disconnect = assertTelegramDisconnectClaimRow(
    claimRow({
      token_secret_ref: tokenSecretRef,
      webhook_secret_ref: webhookSecretRef,
    }),
    "disconnect",
  );
  const revoke = assertTelegramDisconnectClaimRow(
    claimRow({
      token_secret_ref: tokenSecretRef,
      webhook_secret_ref: webhookSecretRef,
    }),
    "revoke",
  );

  assertEquals(disconnect.tokenSecretRef, tokenSecretRef);
  assertEquals(disconnect.webhookSecretRef, webhookSecretRef);
  assertEquals(revoke.tokenSecretRef, tokenSecretRef);
  assertEquals(revoke.webhookSecretRef, webhookSecretRef);
});

Deno.test("telegram-disconnect pause claim rejects returned secret refs", async () => {
  const error = await captureError(() =>
    assertTelegramDisconnectClaimRow(
      claimRow({
        token_secret_ref: tokenSecretRef,
        webhook_secret_ref: webhookSecretRef,
      }),
      "pause",
    )
  ) as HttpError;

  assertEquals(error.statusCode, 500);
  assertEquals(error.code, "server_error");
});

Deno.test("telegram-disconnect claim failure statuses map to sanitized errors", async () => {
  const cases = [
    ["invalid_request", 400, "invalid_request"],
    ["invalid_action", 400, "invalid_request"],
    ["not_found", 404, "telegram_session_not_found"],
    ["forbidden", 403, "forbidden"],
    ["conflict", 409, "telegram_session_conflict"],
    ["missing_secret_ref", 409, "telegram_disconnect_unavailable"],
  ] as const;

  for (const [status, statusCode, code] of cases) {
    const error = await captureError(() =>
      assertTelegramDisconnectClaimRow(
        claimRow({
          claimed: false,
          status,
          telegram_session_id: null,
          agent_id: null,
          bot_handle: null,
        }),
        "disconnect",
      )
    ) as HttpError;
    const serialized = JSON.stringify({
      code: error.code,
      message: error.message,
      stack: error.stack,
    });

    assertEquals(error.statusCode, statusCode);
    assertEquals(error.code, code);
    assert(
      !serialized.includes("token_secret_ref") &&
        !serialized.includes("webhook_secret_ref") &&
        !serialized.includes(ownerUserId),
      "Sanitized failure must hide refs and owner ids.",
    );
  }
});

Deno.test("telegram-disconnect claim adapter sanitizes RPC errors", async () => {
  const error = await captureError(() =>
    claimTelegramDisconnectSession({
      agentId,
      ownerUserId,
      action: "disconnect",
      rpcClient: {
        rpc() {
          return {
            data: null,
            error: {
              message:
                "raw owner_user_id workspace_id token_secret_ref webhook_secret_ref",
            },
          };
        },
      },
    })
  ) as HttpError;
  const serialized = JSON.stringify({
    code: error.code,
    message: error.message,
    stack: error.stack,
  });

  assertEquals(error.statusCode, 500);
  assertEquals(error.code, "server_error");
  assert(!serialized.includes("token_secret_ref"), "Error must hide token ref.");
  assert(
    !serialized.includes("webhook_secret_ref"),
    "Error must hide webhook ref.",
  );
  assert(!serialized.includes("owner_user_id"), "Error must hide owner id.");
});

Deno.test("telegram-disconnect claim adapter rejects unexpected result shape", async () => {
  const error = await captureError(() =>
    assertTelegramDisconnectClaimRow(
      {
        ...claimRow(),
        owner_user_id: ownerUserId,
      },
      "pause",
    )
  ) as HttpError;

  assertEquals(error.statusCode, 500);
  assertEquals(error.code, "server_error");
  assert(
    !JSON.stringify(error).includes(ownerUserId),
    "Error must not echo owner id.",
  );
});

Deno.test("telegram-disconnect claim adapter validates input before RPC", async () => {
  let called = false;
  const error = await captureError(() =>
    claimTelegramDisconnectSession({
      agentId: "not-a-uuid",
      ownerUserId,
      action: "disconnect",
      rpcClient: {
        rpc() {
          called = true;
          return { data: [claimRow()], error: null };
        },
      },
    })
  ) as HttpError;

  assertEquals(called, false);
  assertEquals(error.statusCode, 400);
  assertEquals(error.code, "invalid_request");
});
