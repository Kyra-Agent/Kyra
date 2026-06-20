import {
  isOfficialMcpRouteGateEnabled,
  officialMcpRouteGateKeys,
  readOfficialMcpRouteGate,
} from "./gates.ts";

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

Deno.test("official MCP route gates enable only on exact lowercase true", () => {
  for (
    const value of [
      undefined,
      null,
      "",
      "false",
      "1",
      "yes",
      "TRUE",
      " true",
      "true ",
    ]
  ) {
    assertEquals(isOfficialMcpRouteGateEnabled(value), false);
  }

  assertEquals(isOfficialMcpRouteGateEnabled("true"), true);
});

Deno.test("official MCP route gates are independent", () => {
  const enabledKey = officialMcpRouteGateKeys.status;
  const readEnv = (key: string) => key === enabledKey ? "true" : "";

  assertEquals(
    readOfficialMcpRouteGate(officialMcpRouteGateKeys.status, readEnv),
    true,
  );
  assertEquals(
    readOfficialMcpRouteGate(officialMcpRouteGateKeys.oauthStart, readEnv),
    false,
  );
  assertEquals(
    readOfficialMcpRouteGate(officialMcpRouteGateKeys.oauthCallback, readEnv),
    false,
  );
  assertEquals(
    readOfficialMcpRouteGate(officialMcpRouteGateKeys.tokenBroker, readEnv),
    false,
  );
  assertEquals(
    readOfficialMcpRouteGate(officialMcpRouteGateKeys.revoke, readEnv),
    false,
  );
});

Deno.test("official MCP route gates fail closed when environment reads fail", () => {
  assertEquals(
    readOfficialMcpRouteGate(officialMcpRouteGateKeys.oauthStart, () => {
      throw new Error("environment unavailable");
    }),
    false,
  );
});
