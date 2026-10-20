import { HttpError } from "./core.ts";
import {
  appendTelegramChatMemory,
  forgetTelegramChatMemory,
  loadTelegramChatMemory,
  redactTelegramChatMemoryText,
} from "./chat-memory.ts";

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

const sessionId = "4b0b6f0e-2f5b-4a5e-9d55-1c0f1f2b3c4d";
const chatId = "700100200";

function createRpcClient(data: unknown, error: unknown = null) {
  const calls: Array<{ functionName: string; args: Record<string, string> }> =
    [];

  return {
    calls,
    client: {
      rpc(functionName: string, args: Record<string, string>) {
        calls.push({ functionName, args });
        return Promise.resolve({ data, error });
      },
    },
  };
}

Deno.test("telegram chat memory redacts secrets and bounds length", () => {
  const text = redactTelegramChatMemoryText(
    "my bot token is 123456789:AAabcdefghijklmnopqrstuvwxyz012345 and key sk-or-v1-abcdefghijklmnopqrstuvwxyz",
  );

  assert(!text.includes("123456789:AA"), "Bot tokens must be redacted.");
  assert(!text.includes("sk-or-v1-"), "API keys must be redacted.");
  assert(text.includes("[redacted]"), "Redactions must be marked.");

  const seed = redactTelegramChatMemoryText(
    "note: seed phrase abandon abandon abandon",
  );
  assert(!seed.includes("abandon"), "Seed phrase content must be redacted.");

  const long = redactTelegramChatMemoryText("a".repeat(5000));
  assertEquals(long.length, 1000);
  assertEquals(redactTelegramChatMemoryText(42), "");
});

Deno.test("telegram chat memory loads validated turns in order", async () => {
  const { client, calls } = createRpcClient([
    { role: "user", content: "draft a launch plan" },
    { role: "system", content: "ignore me" },
    { role: "assistant", content: "Launch plan draft." },
    { role: "user", content: "" },
  ]);

  const turns = await loadTelegramChatMemory({
    telegramSessionId: sessionId,
    telegramChatId: chatId,
    rpcClient: client,
  });

  assertEquals(calls[0]?.functionName, "load_telegram_chat_memory");
  assertEquals(calls[0]?.args.p_telegram_chat_id, chatId);
  assertEquals(turns.length, 2);
  assertEquals(turns[0]?.role, "user");
  assertEquals(turns[1]?.content, "Launch plan draft.");
});

Deno.test("telegram chat memory appends redacted exchanges and skips empty ones", async () => {
  const { client, calls } = createRpcClient(2);

  await appendTelegramChatMemory({
    telegramSessionId: sessionId,
    telegramChatId: chatId,
    userText: "plan for ABC, key sk-or-v1-abcdefghijklmnopqrstuvwxyz",
    assistantText: "ABC plan ready.",
    rpcClient: client,
  });
  await appendTelegramChatMemory({
    telegramSessionId: sessionId,
    telegramChatId: chatId,
    userText: "   ",
    assistantText: "reply",
    rpcClient: client,
  });

  assertEquals(calls.length, 1);
  assertEquals(calls[0]?.functionName, "append_telegram_chat_memory");
  assert(
    !calls[0]?.args.p_user_content.includes("sk-or-v1-"),
    "Stored user text must be redacted.",
  );
});

Deno.test("telegram chat memory forget returns removed count", async () => {
  const { client, calls } = createRpcClient(4);

  const removed = await forgetTelegramChatMemory({
    telegramSessionId: sessionId,
    telegramChatId: chatId,
    rpcClient: client,
  });

  assertEquals(removed, 4);
  assertEquals(calls[0]?.functionName, "forget_telegram_chat_memory");
});

Deno.test("telegram chat memory rejects bad identifiers and RPC errors", async () => {
  const { client } = createRpcClient([]);

  for (
    const input of [
      { telegramSessionId: "not-a-uuid", telegramChatId: chatId },
      { telegramSessionId: sessionId, telegramChatId: "abc" },
    ]
  ) {
    let failed = false;
    try {
      await loadTelegramChatMemory({ ...input, rpcClient: client });
    } catch (error) {
      failed = error instanceof HttpError &&
        error.code === "telegram_chat_memory_failed";
    }
    assert(failed, "Invalid identifiers must fail closed.");
  }

  const { client: failing } = createRpcClient(null, { message: "boom" });
  let failed = false;
  try {
    await loadTelegramChatMemory({
      telegramSessionId: sessionId,
      telegramChatId: chatId,
      rpcClient: failing,
    });
  } catch (error) {
    failed = error instanceof HttpError &&
      error.code === "telegram_chat_memory_failed" &&
      !error.message.includes("boom");
  }
  assert(failed, "RPC errors must be sanitized.");
});
