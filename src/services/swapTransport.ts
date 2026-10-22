import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey } from "./supabaseRestClient";

// How a swap step reaches the backend. The dashboard posts with the account
// session; the Telegram Mini App posts through telegram-miniapp with
// Telegram's signed initData. Response validation is shared either way.

export interface SwapPostResult {
  ok: boolean;
  status: number;
  value: unknown;
}

export type SwapPost = (body: Record<string, unknown>) => Promise<SwapPostResult>;

const maxResponseBytes = 16 * 1024;

export function createSessionSwapPost(
  url: string,
  session: KyraAuthSession,
  timeoutMs: number,
): SwapPost {
  return (body) =>
    postBoundedJson(url, {
      Accept: "application/json",
      "Content-Type": "application/json",
      apikey: getSupabaseApiKey(),
      Authorization: `Bearer ${session.accessToken}`,
    }, body, timeoutMs);
}

// Network failures and timeouts come back as status 0 so callers fail safely
// without a thrown error.
export async function postBoundedJson(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<SwapPostResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      redirect: "error",
      signal: controller.signal,
    });
    return {
      ok: response.ok,
      status: response.status,
      value: await readBoundedJson(response),
    };
  } catch {
    return { ok: false, status: 0, value: {} };
  } finally {
    clearTimeout(timeout);
  }
}

export async function readBoundedJson(response: Response): Promise<unknown> {
  const declaredLength = Number(response.headers.get("Content-Length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) {
    try {
      await response.body?.cancel("response_too_large");
    } catch {
      // Best-effort cancellation; the response is rejected either way.
    }
    return {};
  }

  const reader = response.body?.getReader();
  if (!reader) return {};

  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteLength = 0;
  let text = "";
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      byteLength += value.byteLength;
      if (byteLength > maxResponseBytes) {
        try {
          await reader.cancel("response_too_large");
        } catch {
          // Best-effort cancellation; the response is rejected either way.
        }
        return {};
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } catch {
    return {};
  } finally {
    reader.releaseLock();
  }

  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}
