import { HttpError } from "./core.ts";
import { planTelegramClaimedReadOnlyResponse } from "./claim-aware-response.ts";

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

function assertThrowsHttpError(
  action: () => unknown,
  expectedStatusCode: number,
  expectedCode: string,
) {
  let error: unknown;

  try {
    action();
  } catch (caughtError) {
    error = caughtError;
  }

  assert(error instanceof HttpError, "Expected action to throw HttpError.");
  assertEquals((error as HttpError).statusCode, expectedStatusCode);
  assertEquals((error as HttpError).code, expectedCode);

  return error as HttpError;
}

Deno.test("telegram claimed response plan builds one static response", () => {
  const result = planTelegramClaimedReadOnlyResponse(
    { claimed: true, status: "claimed" },
    "status",
  );

  assertEquals(result.status, "claimed");
  assertEquals(result.shouldDeliver, true);

  if (result.status !== "claimed") {
    throw new Error("Expected claimed response plan.");
  }

  assertEquals(result.response.command, "status");
  assert(result.response.text.includes("read-only"), "Expected static status.");
});

Deno.test("telegram claimed response plan supports additional read-only commands", () => {
  const agent = planTelegramClaimedReadOnlyResponse(
    { claimed: true, status: "claimed" },
    "agent",
  );
  const actions = planTelegramClaimedReadOnlyResponse(
    { claimed: true, status: "claimed" },
    "actions",
  );
  const modules = planTelegramClaimedReadOnlyResponse(
    { claimed: true, status: "claimed" },
    "modules",
  );
  const policy = planTelegramClaimedReadOnlyResponse(
    { claimed: true, status: "claimed" },
    "policy",
  );

  if (
    agent.status !== "claimed" || actions.status !== "claimed" ||
    modules.status !== "claimed" || policy.status !== "claimed"
  ) {
    throw new Error("Expected claimed response plans.");
  }

  assertEquals(agent.response.command, "agent");
  assert(agent.response.text.includes("read-only"), "Expected safe agent text.");
  assertEquals(actions.response.command, "actions");
  assert(
    actions.response.text.includes("plain text requests"),
    "Expected safe natural action request guidance.",
  );
  assertEquals(modules.response.command, "modules");
  assert(
    modules.response.text.includes("modules"),
    "Expected safe modules command response.",
  );
  assertEquals(policy.response.command, "policy");
  assert(
    policy.response.text.includes("approval required"),
    "Expected safe policy command response.",
  );
});

Deno.test("telegram duplicate response plan is a bounded no-op", () => {
  const result = planTelegramClaimedReadOnlyResponse(
    { claimed: false, status: "duplicate" },
    "unsupported command that must not be built",
  );

  assertEquals(result.status, "duplicate");
  assertEquals(result.shouldDeliver, false);
  assertEquals(Object.keys(result).sort().join(","), "shouldDeliver,status");
  assert(!("response" in result), "Duplicate plan must not include response.");
});

Deno.test("telegram response plan validates claim before command", () => {
  const error = assertThrowsHttpError(
    () =>
      planTelegramClaimedReadOnlyResponse(
        {
          claimed: true,
          status: "claimed",
          raw: "private claim detail",
        },
        "unsupported raw command",
      ),
    500,
    "server_error",
  );

  assertEquals(error.message, "Telegram update claim validation failed.");
  assert(!error.message.includes("private"), "Error must hide raw details.");
  assert(!error.message.includes("unsupported raw command"), "Hide command.");
});

Deno.test("telegram claimed response plan rejects unsupported commands safely", () => {
  const rawCommand = "private unsupported command";
  const error = assertThrowsHttpError(
    () =>
      planTelegramClaimedReadOnlyResponse(
        { claimed: true, status: "claimed" },
        rawCommand,
      ),
    422,
    "unsupported_update",
  );

  assertEquals(error.message, "Telegram update is not supported.");
  assert(!error.message.includes(rawCommand), "Error must hide raw command.");
});

Deno.test("telegram claimed response plan result excludes raw claim details", () => {
  const result = planTelegramClaimedReadOnlyResponse(
    { claimed: true, status: "claimed" },
    "help",
  );
  const serialized = JSON.stringify(result);

  assertEquals(
    Object.keys(result).sort().join(","),
    "response,shouldDeliver,status",
  );
  assert(!serialized.includes('claimed":true'), "Hide raw claim result.");
  assert(!serialized.includes("update_id"), "Result must hide update ids.");
  assert(!serialized.includes("session"), "Result must hide session details.");
});
