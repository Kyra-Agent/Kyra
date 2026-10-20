import {
  assertAgentSettingsBody,
  assertOwnedAgent,
  HttpError,
  readTemplateActions,
} from "./core.ts";

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

function assertHttpError(action: () => unknown, code: string, statusCode: number) {
  try {
    action();
  } catch (error) {
    if (error instanceof HttpError) {
      assertEquals(error.code, code);
      assertEquals(error.statusCode, statusCode);
      return;
    }
    throw error;
  }
  throw new Error(`Expected ${code}.`);
}

const agentId = "9220060d-2760-496c-9774-18384211496c";
const userId = "11111111-1111-4111-8111-111111111111";

Deno.test("agent settings body requires an agent id and settings object", () => {
  const body = assertAgentSettingsBody({ agentId, settings: { persona: "bold" } });
  assertEquals(body.agentId, agentId);

  assertHttpError(() => assertAgentSettingsBody(null), "invalid_request", 400);
  assertHttpError(
    () => assertAgentSettingsBody({ agentId: "nope", settings: {} }),
    "invalid_request",
    400,
  );
  assertHttpError(
    () => assertAgentSettingsBody({ agentId, settings: [] }),
    "invalid_request",
    400,
  );
});

Deno.test("agent settings only write to agents the caller owns", () => {
  const agent = { id: agentId, workspace_id: "w1", template_id: "steward" };

  assertEquals(assertOwnedAgent(agent, userId, userId).template_id, "steward");
  assertHttpError(
    () => assertOwnedAgent(agent, "someone-else", userId),
    "agent_not_found",
    404,
  );
  assertHttpError(() => assertOwnedAgent(null, null, userId), "agent_not_found", 404);
  assertHttpError(
    () => assertOwnedAgent({ id: agentId }, userId, userId),
    "agent_not_found",
    404,
  );
});

Deno.test("agent settings read only string template actions", () => {
  assertEquals(readTemplateActions(["faq", 3, "token info"]).join(","), "faq,token info");
  assertEquals(readTemplateActions(null).length, 0);
});
