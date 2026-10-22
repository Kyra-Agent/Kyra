// Pure pieces of the Kyra Telegram Mini App backend: verifying Telegram's
// signed initData and reading the request. Telegram signs initData with the
// bot's token, so a valid signature from the agent's own bot proves which
// Telegram user opened the Mini App.

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const miniAppActions = ["context", "quote", "prepare", "closeout"] as const;
export type MiniAppAction = typeof miniAppActions[number];

export interface MiniAppRequest {
  initData: string;
  agentId: string;
  action: MiniAppAction;
  payload: Record<string, unknown>;
}

// initData from a Mini App opened by a button is signed when it opens; an
// hour covers reviewing and confirming a swap.
export const maxInitDataAgeSeconds = 3600;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function assertMiniAppRequest(value: unknown): MiniAppRequest {
  if (!isRecord(value)) throw invalidRequest();
  if (Object.keys(value).sort().join(",") !== "action,agentId,initData,payload") {
    throw invalidRequest();
  }
  if (
    typeof value.initData !== "string" || value.initData.length < 20 || value.initData.length > 4096 ||
    typeof value.agentId !== "string" || !uuidPattern.test(value.agentId) ||
    typeof value.action !== "string" || !miniAppActions.includes(value.action as MiniAppAction) ||
    !isRecord(value.payload)
  ) {
    throw invalidRequest();
  }
  return {
    initData: value.initData,
    agentId: value.agentId.toLowerCase(),
    action: value.action as MiniAppAction,
    payload: value.payload,
  };
}

// https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
export async function verifyTelegramInitData(
  initData: string,
  botToken: string,
  nowSeconds = Math.floor(Date.now() / 1000),
): Promise<{ telegramUserId: string; authDate: number }> {
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(initData);
  } catch {
    throw unauthorized();
  }
  const hash = params.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/u.test(hash)) throw unauthorized();

  const pairs: string[] = [];
  for (const [key, value] of params.entries()) {
    if (key !== "hash") pairs.push(`${key}=${value}`);
  }
  pairs.sort();
  const dataCheckString = pairs.join("\n");

  const secretKey = await hmacSha256(new TextEncoder().encode("WebAppData"), botToken);
  const expected = toHex(await hmacSha256(secretKey, dataCheckString));
  if (!constantTimeEqual(expected, hash)) throw unauthorized();

  const authDate = Number(params.get("auth_date"));
  if (
    !Number.isInteger(authDate) || authDate <= 0 ||
    authDate > nowSeconds + 60 || nowSeconds - authDate > maxInitDataAgeSeconds
  ) {
    throw new HttpError(401, "miniapp_session_expired", "This Kyra window expired. Open it again from the bot.");
  }

  let user: unknown;
  try {
    user = JSON.parse(params.get("user") ?? "");
  } catch {
    throw unauthorized();
  }
  const id = isRecord(user) ? user.id : null;
  if (typeof id !== "number" || !Number.isSafeInteger(id) || id <= 0) throw unauthorized();

  return { telegramUserId: String(id), authDate };
}

async function hmacSha256(key: Uint8Array<ArrayBuffer>, message: string) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return new Uint8Array(await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message)));
}

function toHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function unauthorized() {
  return new HttpError(401, "miniapp_unauthorized", "Open Kyra from your agent's Telegram bot to continue.");
}

function invalidRequest() {
  return new HttpError(400, "invalid_miniapp_request", "The Kyra Mini App request is invalid.");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
