import {
  containsOfficialMcpSensitiveText,
  officialMcpSanitizedFallback,
  sanitizeOfficialMcpPublicMessage,
} from "./redaction.ts";

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(
      message ?? `Expected ${String(expected)}, received ${String(actual)}.`,
    );
  }
}

Deno.test("official MCP redaction detects secret-bearing text", () => {
  for (
    const value of [
      "authorization code=secret",
      "oauth_state secret",
      "PKCE verifier secret",
      "Bearer secret-value",
      "access_token secret",
      "refresh token secret",
      "credential ref abc",
      "wallet payload secret",
      "calldata 0x1234",
      "signature 0x1234",
      "telegram bot token secret",
      "service role secret",
      "sk-abcdefghijklmnopqrstuvwxyz123456",
      "aaaaaaaaaaaaaaaaaaaa.bbbbbbbbbbbbbbbbbbbb.cccccccccccccccccccc",
    ]
  ) {
    assertEquals(containsOfficialMcpSensitiveText(value), true, value);
    assertEquals(
      sanitizeOfficialMcpPublicMessage(value),
      officialMcpSanitizedFallback,
      value,
    );
  }
});

Deno.test("official MCP redaction preserves reviewed static messages", () => {
  assertEquals(
    sanitizeOfficialMcpPublicMessage("Official Base MCP route is disabled."),
    "Official Base MCP route is disabled.",
  );
  assertEquals(
    sanitizeOfficialMcpPublicMessage(
      "Official Base MCP route is not implemented.",
    ),
    "Official Base MCP route is not implemented.",
  );
});
