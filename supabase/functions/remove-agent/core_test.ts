import {
  assertRemoveAgentBody,
  assertRemoveOwnedAgentRpcRow,
  getRemoveAgentFailure,
  HttpError,
  sanitizeErrorMessage,
} from "./core.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function assertThrowsCode(run: () => unknown, code: string) {
  try {
    run();
  } catch (error) {
    assert(error instanceof HttpError, "Expected HttpError.");
    assert(error.code === code, `Expected ${code}, received ${error.code}.`);
    return;
  }

  throw new Error(`Expected ${code} error.`);
}

Deno.test("remove-agent accepts only an exact confirmed UUID payload", () => {
  const agentId = "77777777-7777-4777-8777-777777777777";
  const body = assertRemoveAgentBody({ agentId, confirmation: "remove_agent" });

  assert(body.agentId === agentId, "Agent ID should be preserved.");
  assertThrowsCode(() => assertRemoveAgentBody({ agentId }), "invalid_request");
  assertThrowsCode(
    () => assertRemoveAgentBody({ agentId, confirmation: "remove_agent", ownerId: agentId }),
    "invalid_request",
  );
  assertThrowsCode(
    () => assertRemoveAgentBody({ agentId: "not-a-uuid", confirmation: "remove_agent" }),
    "invalid_agent_id",
  );
  assertThrowsCode(
    () => assertRemoveAgentBody({ agentId, confirmation: "yes" }),
    "confirmation_required",
  );
});

Deno.test("remove-agent validates bounded RPC rows", () => {
  const result = assertRemoveOwnedAgentRpcRow([{
    ok: true,
    status: "removed",
    display_name: "Scout",
    remaining_count: 2,
  }]);

  assert(result.remaining_count === 2, "Remaining count should be returned.");
  assertThrowsCode(
    () => assertRemoveOwnedAgentRpcRow([{ ok: true, status: "removed" }]),
    "invalid_backend_response",
  );
});

Deno.test("remove-agent maps protected states to conflict responses", () => {
  for (const status of [
    "telegram_disconnect_required",
    "execution_history_present",
    "agent_active",
  ]) {
    const error = getRemoveAgentFailure(status);
    assert(error.statusCode === 409, `${status} should be a conflict.`);
  }
});

Deno.test("remove-agent error sanitizer redacts backend credentials", () => {
  const sanitized = sanitizeErrorMessage(
    "sb_secret_abc eyJabc.def.ghi sb_publishable_xyz",
  );

  assert(!sanitized.includes("sb_secret_abc"), "Secret key must be redacted.");
  assert(!sanitized.includes("eyJabc.def.ghi"), "JWT must be redacted.");
  assert(!sanitized.includes("sb_publishable_xyz"), "Publishable key must be redacted.");
});
