import {
  createTelegramOwnerLinkRateLimitedResponse,
  decideTelegramOwnerLinkConsumeRateLimit,
  decideTelegramOwnerLinkIssueRateLimit,
  sanitizeTelegramOwnerLinkRateLimitContractError,
  telegramOwnerLinkConsumeBlockMs,
  telegramOwnerLinkConsumeIdentityMax,
  telegramOwnerLinkConsumeIdentityWindowMs,
  telegramOwnerLinkConsumeSessionMax,
  telegramOwnerLinkConsumeSessionWindowMs,
  telegramOwnerLinkIssueAgentMax,
  telegramOwnerLinkIssueAgentWindowMs,
  telegramOwnerLinkIssueOwnerMax,
  telegramOwnerLinkIssueOwnerWindowMs,
  telegramOwnerLinkIssueSessionMax,
  telegramOwnerLinkIssueSessionWindowMs,
  TelegramOwnerLinkRateLimitContractError,
} from "./telegram-owner-link-rate-limit.ts";

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

function captureError(action: () => unknown) {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw.");
}

Deno.test("owner-link rate-limit policy constants match approved initial design", () => {
  assertEquals(telegramOwnerLinkIssueAgentWindowMs, 15 * 60 * 1000);
  assertEquals(telegramOwnerLinkIssueAgentMax, 3);
  assertEquals(telegramOwnerLinkIssueSessionWindowMs, 15 * 60 * 1000);
  assertEquals(telegramOwnerLinkIssueSessionMax, 3);
  assertEquals(telegramOwnerLinkIssueOwnerWindowMs, 24 * 60 * 60 * 1000);
  assertEquals(telegramOwnerLinkIssueOwnerMax, 20);
  assertEquals(telegramOwnerLinkConsumeIdentityWindowMs, 10 * 60 * 1000);
  assertEquals(telegramOwnerLinkConsumeIdentityMax, 5);
  assertEquals(telegramOwnerLinkConsumeSessionWindowMs, 10 * 60 * 1000);
  assertEquals(telegramOwnerLinkConsumeSessionMax, 30);
  assertEquals(telegramOwnerLinkConsumeBlockMs, 30 * 60 * 1000);
});

Deno.test("owner-link issue rate-limit allows counts below every threshold", () => {
  const result = decideTelegramOwnerLinkIssueRateLimit({
    agentWindowCount: telegramOwnerLinkIssueAgentMax - 1,
    sessionWindowCount: telegramOwnerLinkIssueSessionMax - 1,
    ownerWindowCount: telegramOwnerLinkIssueOwnerMax - 1,
  });

  assertEquals(result.allowed, true);
  assertEquals(result.status, "allowed");
  assertEquals(Object.keys(result).sort().join(","), "allowed,status");
});

Deno.test("owner-link issue rate-limit returns one bounded denial at any threshold", () => {
  const decisions: string[] = [];

  for (
    const input of [
      {
        agentWindowCount: telegramOwnerLinkIssueAgentMax,
        sessionWindowCount: 0,
        ownerWindowCount: 0,
      },
      {
        agentWindowCount: 0,
        sessionWindowCount: telegramOwnerLinkIssueSessionMax,
        ownerWindowCount: 0,
      },
      {
        agentWindowCount: 0,
        sessionWindowCount: 0,
        ownerWindowCount: telegramOwnerLinkIssueOwnerMax,
      },
    ]
  ) {
    decisions.push(
      JSON.stringify(decideTelegramOwnerLinkIssueRateLimit(input)),
    );
  }

  assertEquals(new Set(decisions).size, 1);
  assertEquals(
    decisions[0],
    JSON.stringify({ allowed: false, status: "rate_limited" }),
  );
});

Deno.test("owner-link consume rate-limit allows clean identity and session state", () => {
  const result = decideTelegramOwnerLinkConsumeRateLimit({
    identityWindowCount: telegramOwnerLinkConsumeIdentityMax - 1,
    sessionWindowCount: telegramOwnerLinkConsumeSessionMax - 1,
    blockedUntil: null,
    nowMs: 1000,
  });

  assertEquals(result.allowed, true);
  assertEquals(result.status, "allowed");
});

Deno.test("owner-link consume rate-limit returns one bounded denial for identity session or active block", () => {
  const nowMs = Date.parse("2026-06-05T00:00:00.000Z");
  const decisions: string[] = [];

  for (
    const input of [
      {
        identityWindowCount: telegramOwnerLinkConsumeIdentityMax,
        sessionWindowCount: 0,
        blockedUntil: null,
        nowMs,
      },
      {
        identityWindowCount: 0,
        sessionWindowCount: telegramOwnerLinkConsumeSessionMax,
        blockedUntil: null,
        nowMs,
      },
      {
        identityWindowCount: 0,
        sessionWindowCount: 0,
        blockedUntil: new Date(nowMs + 1).toISOString(),
        nowMs,
      },
    ]
  ) {
    decisions.push(
      JSON.stringify(decideTelegramOwnerLinkConsumeRateLimit(input)),
    );
  }

  assertEquals(new Set(decisions).size, 1);
  assertEquals(
    decisions[0],
    JSON.stringify({ allowed: false, status: "rate_limited" }),
  );
});

Deno.test("owner-link consume rate-limit ignores expired block time", () => {
  const nowMs = Date.parse("2026-06-05T00:00:00.000Z");
  const result = decideTelegramOwnerLinkConsumeRateLimit({
    identityWindowCount: 0,
    sessionWindowCount: 0,
    blockedUntil: new Date(nowMs).toISOString(),
    nowMs,
  });

  assertEquals(result.allowed, true);
  assertEquals(result.status, "allowed");
});

Deno.test("owner-link rate-limit contracts fail closed with fixed sanitized error", () => {
  const raw = "owner_user_id telegram_user_id challenge_hash token_secret_ref";
  const errors = [
    captureError(() =>
      decideTelegramOwnerLinkIssueRateLimit({
        agentWindowCount: -1,
        sessionWindowCount: 0,
        ownerWindowCount: 0,
      })
    ),
    captureError(() =>
      decideTelegramOwnerLinkConsumeRateLimit({
        identityWindowCount: 0,
        sessionWindowCount: Number.POSITIVE_INFINITY,
        blockedUntil: raw,
        nowMs: 0,
      })
    ),
    sanitizeTelegramOwnerLinkRateLimitContractError(new Error(raw)),
  ];

  for (const error of errors) {
    const serialized = JSON.stringify(error);

    assert(
      error instanceof TelegramOwnerLinkRateLimitContractError,
      "Expected sanitized contract error.",
    );
    assertEquals(
      (error as TelegramOwnerLinkRateLimitContractError).statusCode,
      500,
    );
    assertEquals(
      (error as TelegramOwnerLinkRateLimitContractError).code,
      "server_error",
    );
    assertEquals(
      (error as TelegramOwnerLinkRateLimitContractError).message,
      "Telegram owner-link rate limit contract failed.",
    );
    assert(!serialized.includes(raw), "Error must hide raw details.");
  }
});

Deno.test("owner-link rate-limited response is fixed and exposes no policy detail", () => {
  const response = createTelegramOwnerLinkRateLimitedResponse();
  const serialized = JSON.stringify(response);

  assertEquals(Object.keys(response).sort().join(","), "message,ok,status");
  assertEquals(response.ok, false);
  assertEquals(response.status, "rate_limited");
  assertEquals(
    response.message,
    "Telegram owner-link requests are temporarily limited.",
  );
  assert(!serialized.includes("3"), "Response must hide issue threshold.");
  assert(!serialized.includes("5"), "Response must hide consume threshold.");
  assert(!serialized.includes("30"), "Response must hide block threshold.");
});
