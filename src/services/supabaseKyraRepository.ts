import { appConfig } from "../config/appConfig";
import type { KyraDatabase, KyraTableName } from "../types/database";

export const supabaseKyraTables: KyraTableName[] = [
  "workspaces",
  "agent_templates",
  "agent_instances",
  "wallet_policies",
  "approval_requests",
  "activity_logs",
  "telegram_sessions",
];

export interface SupabaseAdapterStatus {
  configured: boolean;
  urlPresent: boolean;
  anonKeyPresent: boolean;
  tables: KyraTableName[];
  executionEnabled: false;
}

export function getSupabaseAdapterStatus(): SupabaseAdapterStatus {
  return {
    configured: appConfig.supabase.configured,
    urlPresent: Boolean(appConfig.supabase.url),
    anonKeyPresent: appConfig.supabase.hasAnonKey,
    tables: supabaseKyraTables,
    executionEnabled: false,
  };
}

export type SupabaseTableRow<TName extends KyraTableName> = KyraDatabase["public"]["Tables"][TName]["Row"];
