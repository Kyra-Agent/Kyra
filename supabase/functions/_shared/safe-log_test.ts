import { logSafeEvent } from "./safe-log.ts";

Deno.test("safe log writes only snake_case identifiers", () => {
  const lines: string[] = [];
  const original = console.warn;
  console.warn = (line: unknown) => lines.push(String(line));

  try {
    logSafeEvent("telegram_agent_brain_fallback", "agent_brain_timeout");
    logSafeEvent("telegram_agent_brain_fallback", "123456789:AAsecret-token");
    logSafeEvent("Hello <user text>", "agent_brain_timeout");
  } finally {
    console.warn = original;
  }

  if (
    lines[0] !==
      '{"event":"telegram_agent_brain_fallback","code":"agent_brain_timeout"}'
  ) {
    throw new Error(`Unexpected log line: ${lines[0]}`);
  }

  if (lines.some((line) => line.includes("secret") || line.includes("user"))) {
    throw new Error("Unsafe content reached the log.");
  }
});
