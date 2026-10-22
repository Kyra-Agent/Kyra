import { assertMiniAppRequest, verifyTelegramInitData } from "./core.ts";

function assertEquals<T>(actual: T, expected: T, message?: string) {
  if (actual !== expected) {
    throw new Error(message ?? `Expected ${String(expected)}, received ${String(actual)}.`);
  }
}

async function assertRejectsCode(run: () => Promise<unknown>, code: string) {
  try {
    await run();
  } catch (error) {
    assertEquals((error as { code?: string }).code, code);
    return;
  }
  throw new Error(`Expected ${code}.`);
}

const botToken = "123456789:AAEXAMPLEexampleEXAMPLEexample_12345";

// Builds initData exactly the way Telegram signs it.
async function signInitData(fields: Record<string, string>, token = botToken) {
  const key = async (raw: Uint8Array<ArrayBuffer>) =>
    await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const secret = new Uint8Array(
    await crypto.subtle.sign("HMAC", await key(new TextEncoder().encode("WebAppData")), new TextEncoder().encode(token)),
  );
  const check = Object.entries(fields).map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const hash = Array.from(new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret), new TextEncoder().encode(check))))
    .map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return new URLSearchParams({ ...fields, hash }).toString();
}

const now = 1_792_700_000;
const fields = {
  auth_date: String(now - 30),
  query_id: "AAH1",
  user: JSON.stringify({ id: 6152281234, first_name: "Owner" }),
};

Deno.test("mini app accepts initData signed by the agent's bot", async () => {
  const initData = await signInitData(fields);
  const verified = await verifyTelegramInitData(initData, botToken, now);
  assertEquals(verified.telegramUserId, "6152281234");
});

Deno.test("mini app rejects another bot's signature, tampering, and stale data", async () => {
  const otherBot = await signInitData(fields, "987654321:AAOTHERotherOTHERother_otherOTHER12");
  await assertRejectsCode(() => verifyTelegramInitData(otherBot, botToken, now), "miniapp_unauthorized");

  const signed = await signInitData(fields);
  const tampered = signed.replace("6152281234", "6152281235");
  await assertRejectsCode(() => verifyTelegramInitData(tampered, botToken, now), "miniapp_unauthorized");

  const stale = await signInitData({ ...fields, auth_date: String(now - 3601) });
  await assertRejectsCode(() => verifyTelegramInitData(stale, botToken, now), "miniapp_session_expired");

  const noHash = new URLSearchParams(fields).toString();
  await assertRejectsCode(() => verifyTelegramInitData(noHash, botToken, now), "miniapp_unauthorized");
});

Deno.test("mini app requests need exactly the expected fields", () => {
  const ok = assertMiniAppRequest({
    initData: "a".repeat(40),
    agentId: "F6B9CBAB-A55E-4F4D-B2B2-A1B53D2ACA46",
    action: "quote",
    payload: {},
  });
  assertEquals(ok.agentId, "f6b9cbab-a55e-4f4d-b2b2-a1b53d2aca46");
  for (
    const bad of [
      { initData: "a".repeat(40), agentId: "x", action: "quote", payload: {} },
      { initData: "a".repeat(40), agentId: ok.agentId, action: "transfer", payload: {} },
      { initData: "a".repeat(40), agentId: ok.agentId, action: "quote", payload: {}, extra: 1 },
    ]
  ) {
    let refused = false;
    try {
      assertMiniAppRequest(bad);
    } catch {
      refused = true;
    }
    assertEquals(refused, true, JSON.stringify(bad));
  }
});
