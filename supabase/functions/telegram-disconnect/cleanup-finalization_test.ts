import { HttpError } from "../telegram-connect/core.ts";
import {
  assertDisconnectCleanupClaim,
  finalizeTelegramDisconnectCleanup,
  sanitizeTelegramDisconnectCleanupError,
  type TelegramDisconnectCleanupDependencies,
} from "./cleanup-finalization.ts";
import type { TelegramDisconnectClaimResult } from "./session-claim.ts";

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

function captureSyncError(action: () => unknown) {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw.");
}

const agentId = "11111111-1111-4111-8111-111111111111";
const telegramSessionId = "22222222-2222-4222-8222-222222222222";
const botToken = "1234567890:ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghi";
const tokenSecretRef = "vault:telegram:55555555-5555-4555-8555-555555555555";
const webhookSecretRef =
  "webhook:telegram:77777777-7777-4777-8777-777777777777";

function makeClaim(
  action: TelegramDisconnectClaimResult["action"] = "disconnect",
  overrides: Partial<TelegramDisconnectClaimResult> = {},
): TelegramDisconnectClaimResult {
  return {
    claimed: true,
    action,
    telegramSessionId,
    agentId,
    botHandle: "@kyra_test_bot",
    tokenSecretRef,
    webhookSecretRef,
    ...overrides,
  };
}

function makeDependencies(
  order: string[],
  overrides: Partial<TelegramDisconnectCleanupDependencies> = {},
): TelegramDisconnectCleanupDependencies {
  return {
    resolveTelegramBotToken: async (input) => {
      order.push(`resolve:${input.tokenSecretRef}`);
      return { botToken };
    },
    unregisterTelegramWebhook: async (input) => {
      order.push(`unregister:${input.botToken}`);
    },
    revokeTelegramWebhookSecret: async (input) => {
      order.push(`revokeWebhook:${input.webhookSecretRef}`);
      return { revoked: true };
    },
    revokeTelegramBotToken: async (input) => {
      order.push(`revokeToken:${input.tokenSecretRef}`);
      return { revoked: true };
    },
    ...overrides,
  };
}

Deno.test("telegram disconnect cleanup disconnects without revoking bot token", async () => {
  const order: string[] = [];
  const result = await finalizeTelegramDisconnectCleanup(
    makeClaim("disconnect"),
    makeDependencies(order),
  );
  const serialized = JSON.stringify(result);

  assertEquals(result.finalized, true);
  assertEquals(result.action, "disconnect");
  assertEquals(
    order.join(","),
    [
      `resolve:${tokenSecretRef}`,
      `unregister:${botToken}`,
      `revokeWebhook:${webhookSecretRef}`,
    ].join(","),
  );
  assert(!serialized.includes(botToken), "Result must not expose bot token.");
  assert(
    !serialized.includes(tokenSecretRef),
    "Result must not expose token ref.",
  );
  assert(
    !serialized.includes(webhookSecretRef),
    "Result must not expose webhook ref.",
  );
  assert(!serialized.includes(agentId), "Result must not expose agent id.");
  assert(
    !serialized.includes(telegramSessionId),
    "Result must not expose session id.",
  );
});

Deno.test("telegram disconnect cleanup revoke also revokes bot token", async () => {
  const order: string[] = [];
  const result = await finalizeTelegramDisconnectCleanup(
    makeClaim("revoke"),
    makeDependencies(order),
  );

  assertEquals(result.finalized, true);
  assertEquals(result.action, "revoke");
  assertEquals(
    order.join(","),
    [
      `resolve:${tokenSecretRef}`,
      `unregister:${botToken}`,
      `revokeWebhook:${webhookSecretRef}`,
      `revokeToken:${tokenSecretRef}`,
    ].join(","),
  );
});

Deno.test("telegram disconnect cleanup rejects pause and missing refs before dependencies", async () => {
  const order: string[] = [];
  const pauseError = captureSyncError(() =>
    assertDisconnectCleanupClaim(
      makeClaim("pause", {
        tokenSecretRef: undefined,
        webhookSecretRef: undefined,
      }),
    )
  );
  const missingRefError = await captureError(() =>
    finalizeTelegramDisconnectCleanup(
      makeClaim("disconnect", { tokenSecretRef: undefined }),
      makeDependencies(order),
    )
  );
  const serialized = JSON.stringify({
    pause: pauseError,
    missing: missingRefError,
  });

  assert(pauseError instanceof HttpError, "Pause cleanup must reject safely.");
  assert(missingRefError instanceof HttpError, "Missing refs must reject.");
  assertEquals(order.length, 0);
  assert(!serialized.includes(agentId), "Errors must not expose agent id.");
  assert(
    !serialized.includes(telegramSessionId),
    "Errors must not expose session id.",
  );
});

Deno.test("telegram disconnect cleanup resolves failure but still revokes local refs", async () => {
  const order: string[] = [];
  const error = await captureError(() =>
    finalizeTelegramDisconnectCleanup(
      makeClaim("revoke"),
      makeDependencies(order, {
        resolveTelegramBotToken: async () => {
          order.push("resolve");
          throw new Error(`raw resolve ${tokenSecretRef} ${botToken}`);
        },
      }),
    )
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "Resolve failure must sanitize.");
  assertEquals((error as HttpError).statusCode, 424);
  assertEquals(
    order.join(","),
    [
      "resolve",
      `revokeWebhook:${webhookSecretRef}`,
      `revokeToken:${tokenSecretRef}`,
    ].join(","),
  );
  assert(!serialized.includes(botToken), "Error must not expose bot token.");
  assert(
    !serialized.includes(tokenSecretRef),
    "Error must not expose token ref.",
  );
  assert(
    !serialized.includes(webhookSecretRef),
    "Error must not expose webhook ref.",
  );
});

Deno.test("telegram disconnect cleanup unregister failure still revokes webhook and token refs", async () => {
  const order: string[] = [];
  const error = await captureError(() =>
    finalizeTelegramDisconnectCleanup(
      makeClaim("revoke"),
      makeDependencies(order, {
        unregisterTelegramWebhook: async () => {
          order.push("unregister");
          throw new Error(`raw unregister ${botToken}`);
        },
      }),
    )
  );
  const serialized = JSON.stringify(error);

  assert(error instanceof HttpError, "Unregister failure must sanitize.");
  assertEquals(
    order.join(","),
    [
      `resolve:${tokenSecretRef}`,
      "unregister",
      `revokeWebhook:${webhookSecretRef}`,
      `revokeToken:${tokenSecretRef}`,
    ].join(","),
  );
  assert(!serialized.includes(botToken), "Error must not expose bot token.");
});

Deno.test("telegram disconnect cleanup sanitizes webhook and token revoke failures", async () => {
  const webhookOrder: string[] = [];
  const webhookError = await captureError(() =>
    finalizeTelegramDisconnectCleanup(
      makeClaim("disconnect"),
      makeDependencies(webhookOrder, {
        revokeTelegramWebhookSecret: async () => {
          webhookOrder.push("revokeWebhook");
          throw new Error(`raw webhook ${webhookSecretRef}`);
        },
      }),
    )
  );

  const tokenOrder: string[] = [];
  const tokenError = await captureError(() =>
    finalizeTelegramDisconnectCleanup(
      makeClaim("revoke"),
      makeDependencies(tokenOrder, {
        revokeTelegramBotToken: async () => {
          tokenOrder.push("revokeToken");
          throw new Error(`raw token ${tokenSecretRef}`);
        },
      }),
    )
  );
  const serialized = JSON.stringify({ webhookError, tokenError });

  assert(webhookError instanceof HttpError, "Webhook revoke must sanitize.");
  assert(tokenError instanceof HttpError, "Token revoke must sanitize.");
  assert(
    !serialized.includes(webhookSecretRef),
    "Errors must not expose webhook ref.",
  );
  assert(
    !serialized.includes(tokenSecretRef),
    "Errors must not expose token ref.",
  );
});

Deno.test("telegram disconnect cleanup sanitizer always returns fixed error", () => {
  const rawHttp = new HttpError(
    429,
    "rate_limited",
    `raw ${botToken} ${tokenSecretRef}`,
  );
  const raw = new Error(`raw ${botToken} ${tokenSecretRef}`);
  const httpResult = sanitizeTelegramDisconnectCleanupError(rawHttp);
  const rawResult = sanitizeTelegramDisconnectCleanupError(raw);
  const serialized = JSON.stringify({ httpResult, rawResult });

  assertEquals(httpResult.statusCode, 424);
  assertEquals(httpResult.code, "telegram_disconnect_cleanup_failed");
  assertEquals(rawResult.statusCode, 424);
  assertEquals(rawResult.code, "telegram_disconnect_cleanup_failed");
  assert(!serialized.includes(botToken), "Raw error must be hidden.");
  assert(!serialized.includes(tokenSecretRef), "Raw ref must be hidden.");
});
