import { appConfig } from "../config/appConfig";
import type { KyraDatabase, KyraTableName } from "../types/database";
import type { KyraAuthSession } from "./supabaseAuthService";

export type SupabaseTableRow<TName extends KyraTableName> =
  KyraDatabase["public"]["Tables"][TName]["Row"];
export type SupabaseTableInsert<TName extends KyraTableName> =
  KyraDatabase["public"]["Tables"][TName]["Insert"];
export type SupabaseTableUpdate<TName extends KyraTableName> =
  KyraDatabase["public"]["Tables"][TName]["Update"];

export function getSupabaseApiKey() {
  return import.meta.env.VITE_SUPABASE_ANON_KEY || "";
}

export function getRestUrl(path: string) {
  return `${appConfig.supabase.url.replace(/\/$/, "")}/rest/v1/${path.replace(/^\//, "")}`;
}

export function getJsonHeaders(session: KyraAuthSession, prefer?: string) {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: getSupabaseApiKey(),
    Authorization: `Bearer ${session.accessToken}`,
  };

  if (prefer) {
    headers.Prefer = prefer;
  }

  return headers;
}

export function getPublicJsonHeaders() {
  const apiKey = getSupabaseApiKey();
  const headers: Record<string, string> = {
    Accept: "application/json",
    apikey: apiKey,
  };

  if (apiKey && !apiKey.startsWith("sb_")) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  return headers;
}

export function sanitizeSupabaseMessage(message: string) {
  return message
    .replace(/sb_publishable_[A-Za-z0-9_-]+/g, "sb_publishable_[hidden]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "jwt_[hidden]")
    .slice(0, 240);
}

export async function parseSupabaseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `Supabase request failed with ${response.status}.`);
  }

  return text ? (JSON.parse(text) as T) : ([] as T);
}

export async function selectRows<T>(session: KyraAuthSession, path: string): Promise<T[]> {
  const response = await fetch(getRestUrl(path), {
    headers: getJsonHeaders(session),
  });

  return parseSupabaseResponse<T[]>(response);
}

export async function selectPublicRows<T>(path: string): Promise<T[]> {
  const response = await fetch(getRestUrl(path), {
    headers: getPublicJsonHeaders(),
  });

  return parseSupabaseResponse<T[]>(response);
}

export async function insertRow<TName extends KyraTableName>(
  session: KyraAuthSession,
  tableName: TName,
  payload: SupabaseTableInsert<TName>,
): Promise<SupabaseTableRow<TName>> {
  const response = await fetch(getRestUrl(tableName), {
    method: "POST",
    headers: getJsonHeaders(session, "return=representation"),
    body: JSON.stringify(payload),
  });
  const rows = await parseSupabaseResponse<SupabaseTableRow<TName>[]>(response);

  if (!rows[0]) {
    throw new Error(`Supabase did not return a ${tableName} row.`);
  }

  return rows[0];
}

export async function insertRows<TName extends KyraTableName>(
  session: KyraAuthSession,
  tableName: TName,
  payload: SupabaseTableInsert<TName>[],
) {
  if (payload.length === 0) {
    return;
  }

  const response = await fetch(getRestUrl(tableName), {
    method: "POST",
    headers: getJsonHeaders(session),
    body: JSON.stringify(payload),
  });

  await parseSupabaseResponse(response);
}

export async function patchRow<TName extends KyraTableName>(
  session: KyraAuthSession,
  tableName: TName,
  id: string,
  payload: SupabaseTableUpdate<TName>,
) {
  const response = await fetch(getRestUrl(`${tableName}?id=eq.${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: getJsonHeaders(session),
    body: JSON.stringify(payload),
  });

  await parseSupabaseResponse(response);
}

export async function deleteRows(session: KyraAuthSession, path: string) {
  const response = await fetch(getRestUrl(path), {
    method: "DELETE",
    headers: getJsonHeaders(session),
  });

  await parseSupabaseResponse(response);
}
