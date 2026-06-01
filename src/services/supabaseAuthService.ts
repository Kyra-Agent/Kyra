import { appConfig } from "../config/appConfig";

const AUTH_STORAGE_KEY = "kyra.supabase.session.v1";
const SESSION_REFRESH_BUFFER_SECONDS = 120;

export type KyraAuthStatus =
  | "not-configured"
  | "signed-out"
  | "signing-in"
  | "signed-in"
  | "confirmation-required"
  | "error";

export interface KyraAuthUser {
  id: string;
  email: string | null;
}

export interface KyraAuthSession {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  user: KyraAuthUser;
}

export interface KyraAuthResult {
  ok: boolean;
  status: KyraAuthStatus;
  session: KyraAuthSession | null;
  message: string;
}

interface SupabaseAuthUserResponse {
  id: string;
  email?: string | null;
}

interface SupabaseAuthTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  user?: SupabaseAuthUserResponse | null;
  error?: string;
  error_description?: string;
  msg?: string;
  message?: string;
}

function getSupabaseApiKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || "";
}

function getAuthUrl(path: string) {
  return `${appConfig.supabase.url.replace(/\/$/, "")}/auth/v1/${path.replace(/^\//, "")}`;
}

function getPublicAuthHeaders() {
  const apiKey = getSupabaseApiKey();

  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: apiKey,
  };
}

function getSessionAuthHeaders(accessToken: string) {
  return {
    ...getPublicAuthHeaders(),
    Authorization: `Bearer ${accessToken}`,
  };
}

function sanitizeAuthMessage(message: string) {
  return message
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "sb_publishable_[hidden]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "jwt_[hidden]")
    .slice(0, 220);
}

function getAuthErrorMessage(payload: SupabaseAuthTokenResponse, fallback: string) {
  return sanitizeAuthMessage(
    payload.error_description ?? payload.msg ?? payload.message ?? payload.error ?? fallback,
  );
}

function parseSession(payload: SupabaseAuthTokenResponse): KyraAuthSession | null {
  if (!payload.access_token || !payload.refresh_token || !payload.user) {
    return null;
  }

  return {
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    expiresAt:
      payload.expires_at ??
      Math.floor(Date.now() / 1000) + Math.max(0, payload.expires_in ?? 3600),
    user: {
      id: payload.user.id,
      email: payload.user.email ?? null,
    },
  };
}

function makeResult(
  status: KyraAuthStatus,
  message: string,
  session: KyraAuthSession | null = null,
): KyraAuthResult {
  return {
    ok: status === "signed-in" || status === "confirmation-required",
    status,
    session,
    message,
  };
}

async function requestAuth(path: string, body: Record<string, unknown>) {
  if (!appConfig.supabase.configured) {
    return makeResult("not-configured", "Supabase environment variables are missing.");
  }

  try {
    const response = await fetch(getAuthUrl(path), {
      method: "POST",
      headers: getPublicAuthHeaders(),
      body: JSON.stringify(body),
    });
    const payload = (await response.json()) as SupabaseAuthTokenResponse;

    if (!response.ok) {
      return makeResult("error", getAuthErrorMessage(payload, "Supabase auth request failed."));
    }

    const session = parseSession(payload);

    if (session) {
      saveStoredAuthSession(session);
      return makeResult("signed-in", "Session active.", session);
    }

    return makeResult(
      "confirmation-required",
      "Confirmation email sent. Verify the email, then sign in again.",
      null,
    );
  } catch (error) {
    return makeResult(
      "error",
      error instanceof Error ? sanitizeAuthMessage(error.message) : "Supabase auth request failed.",
    );
  }
}

export function loadStoredAuthSession(): KyraAuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const session = JSON.parse(raw) as KyraAuthSession;

    if (!session.accessToken || !session.refreshToken || !session.user?.id) {
      return null;
    }

    return session;
  } catch {
    window.localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

export function saveStoredAuthSession(session: KyraAuthSession) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
}

export function clearStoredAuthSession() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY);
}

export async function signUpWithPassword(email: string, password: string) {
  return requestAuth("signup", {
    email,
    password,
    data: {
      workspace_name: "Kyra demo workspace",
    },
  });
}

export async function signInWithPassword(email: string, password: string) {
  return requestAuth("token?grant_type=password", {
    email,
    password,
  });
}

export async function refreshAuthSession(session: KyraAuthSession): Promise<KyraAuthResult> {
  return requestAuth("token?grant_type=refresh_token", {
    refresh_token: session.refreshToken,
  });
}

export function shouldRefreshAuthSession(
  session: KyraAuthSession,
  bufferSeconds = SESSION_REFRESH_BUFFER_SECONDS,
) {
  return session.expiresAt - Math.floor(Date.now() / 1000) <= bufferSeconds;
}

export async function ensureFreshAuthSession(
  session: KyraAuthSession | null,
): Promise<KyraAuthResult> {
  if (!session) {
    return makeResult("signed-out", "Sign in before using Supabase-backed demo records.");
  }

  if (!appConfig.supabase.configured) {
    return makeResult("not-configured", "Supabase environment variables are missing.");
  }

  if (!shouldRefreshAuthSession(session)) {
    return makeResult("signed-in", "Session active.", session);
  }

  const result = await refreshAuthSession(session);

  if (result.session) {
    return makeResult("signed-in", "Session refreshed.", result.session);
  }

  clearStoredAuthSession();

  return makeResult(
    "error",
    `Session expired and refresh failed. Sign in again before using Supabase records. ${result.message}`,
  );
}

export async function getCurrentAuthUser(session: KyraAuthSession): Promise<KyraAuthResult> {
  if (!appConfig.supabase.configured) {
    return makeResult("not-configured", "Supabase environment variables are missing.");
  }

  try {
    const response = await fetch(getAuthUrl("user"), {
      headers: getSessionAuthHeaders(session.accessToken),
    });
    const payload = (await response.json()) as SupabaseAuthUserResponse & SupabaseAuthTokenResponse;

    if (!response.ok) {
      return makeResult("error", getAuthErrorMessage(payload, "Session validation failed."));
    }

    const nextSession = {
      ...session,
      user: {
        id: payload.id,
        email: payload.email ?? session.user.email,
      },
    };

    saveStoredAuthSession(nextSession);
    return makeResult("signed-in", "Session active.", nextSession);
  } catch (error) {
    return makeResult(
      "error",
      error instanceof Error ? sanitizeAuthMessage(error.message) : "Session validation failed.",
    );
  }
}

export async function signOutAuthSession(session: KyraAuthSession | null): Promise<KyraAuthResult> {
  clearStoredAuthSession();

  if (!session || !appConfig.supabase.configured) {
    return makeResult("signed-out", "Session cleared.");
  }

  try {
    await fetch(getAuthUrl("logout"), {
      method: "POST",
      headers: getSessionAuthHeaders(session.accessToken),
      body: JSON.stringify({ scope: "local" }),
    });
  } catch {
    // Local session clearing is the important behavior for the demo.
  }

  return makeResult("signed-out", "Session cleared.");
}
