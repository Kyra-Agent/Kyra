import { HttpError } from "./core.ts";
import {
  buildTelegramExecutionDraftReplayKey,
  reviewTelegramExecutionGate,
} from "./execution-gate.ts";

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

Deno.test("telegram execution gate allows normal read-only chat", () => {
  const decision = reviewTelegramExecutionGate({
    text: "make a campaign plan for Agent 666",
    command: "chat",
    authorizationRole: "owner",
  });

  assertEquals(decision.status, "read_only_allowed");
  assertEquals(decision.canExecuteFromTelegram, false);
  assertEquals(decision.canCreateDraftNow, false);
  assertEquals(decision.requiresOwnerDashboardApproval, false);
});

Deno.test("telegram execution gate marks owner swap review as draft candidate only", () => {
  const decision = reviewTelegramExecutionGate({
    text: "review 10 USDC to ETH swap",
    command: "chat",
    authorizationRole: "owner",
  });

  assertEquals(decision.status, "approval_draft_candidate");
  assertEquals(decision.draftKind, "swap_review");
  assertEquals(decision.canExecuteFromTelegram, false);
  assertEquals(decision.canCreateDraftNow, false);
  assert(decision.requiresOwnerDashboardApproval, "Dashboard approval required.");
  assert(decision.replayProtectionRequired, "Replay protection required.");
  assert(decision.rateLimitRequired, "Rate limit required.");
  assert(
    decision.responseText.includes("No wallet prompt"),
    "Response must say no wallet prompt was created.",
  );
});

Deno.test("telegram execution gate blocks direct execution language", () => {
  const decision = reviewTelegramExecutionGate({
    text: "swap now 10 USDC to ETH and execute",
    command: "chat",
    authorizationRole: "owner",
  });

  assertEquals(decision.status, "blocked");
  assertEquals(decision.draftKind, "swap_review");
  assertEquals(decision.canExecuteFromTelegram, false);
  assert(
    decision.responseText.includes("Command rejected"),
    "Direct execution must be rejected.",
  );
});

Deno.test("telegram execution gate blocks non-owner draft creation", () => {
  const decision = reviewTelegramExecutionGate({
    text: "review transfer 10 USDC to 0x1111111111111111111111111111111111111111",
    command: "chat",
    authorizationRole: "member",
  });

  assertEquals(decision.status, "blocked");
  assertEquals(decision.draftKind, "transfer_review");
  assertEquals(decision.canCreateDraftNow, false);
});

Deno.test("telegram execution gate blocks secret-like content", () => {
  const decision = reviewTelegramExecutionGate({
    text: "use seed phrase alpha beta gamma to approve",
    command: "chat",
    authorizationRole: "owner",
  });

  assertEquals(decision.status, "blocked");
  assert(
    decision.responseText.includes("cannot process secrets"),
    "Secret-like content must be refused.",
  );
});

Deno.test("telegram execution draft replay key is scoped and validated", () => {
  assertEquals(
    buildTelegramExecutionDraftReplayKey({
      telegramSessionId: "session_123",
      updateId: "9001",
      messageId: "42",
    }),
    "telegram-draft:session_123:9001:42",
  );

  let error: unknown;

  try {
    buildTelegramExecutionDraftReplayKey({
      telegramSessionId: "session/unsafe",
      updateId: "9001",
      messageId: "42",
    });
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof HttpError, "Unsafe replay key part must throw.");
  assertEquals((error as HttpError).code, "invalid_update");
});
