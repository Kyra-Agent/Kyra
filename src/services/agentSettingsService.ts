import { appConfig } from "../config/appConfig";
import {
  type AgentSettingsDraft,
  readAgentSettingsDraft,
  toAgentSettingsPayload,
} from "../config/agentSettings";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey, sanitizeSupabaseMessage, selectRows } from "./supabaseRestClient";

export interface AgentSettingsSaveResult {
  ok: boolean;
  message: string;
  settings: AgentSettingsDraft | null;
  field: string | null;
}

const settingsColumns =
  "persona,instructions,knowledge,enabled_actions,enabled_modules,risk_profile,max_review_usd";

// Owners can read their own agent settings (RLS). A missing row means the
// agent still runs on template defaults.
export async function fetchAgentSettings(
  session: KyraAuthSession,
  agentId: string,
): Promise<AgentSettingsDraft> {
  const rows = await selectRows<Record<string, unknown>>(
    session,
    `agent_settings?select=${settingsColumns}&agent_id=eq.${encodeURIComponent(agentId)}&limit=1`,
  );

  return readAgentSettingsDraft(rows[0]);
}

export async function saveAgentSettings(
  session: KyraAuthSession,
  agentId: string,
  draft: AgentSettingsDraft,
): Promise<AgentSettingsSaveResult> {
  if (!appConfig.functions.agentSettingsConfigured) {
    return {
      ok: false,
      message: "Agent settings are not available yet.",
      settings: null,
      field: null,
    };
  }

  try {
    const response = await fetch(appConfig.functions.agentSettingsUrl, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        apikey: getSupabaseApiKey(),
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({
        agentId,
        settings: toAgentSettingsPayload(draft),
      }),
    });
    const payload = await response.json().catch(() => null) as
      | Record<string, unknown>
      | null;

    if (!response.ok || !payload || payload.ok !== true) {
      return {
        ok: false,
        message: typeof payload?.message === "string"
          ? sanitizeSupabaseMessage(payload.message)
          : "Kyra could not save these settings. Try again in a moment.",
        settings: null,
        field: typeof payload?.field === "string" ? payload.field : null,
      };
    }

    return {
      ok: true,
      message: "Settings saved. Your agent uses them from the next message.",
      settings: readAgentSettingsDraft(payload.settings),
      field: null,
    };
  } catch {
    return {
      ok: false,
      message: "Kyra could not reach the settings service. Check your connection and try again.",
      settings: null,
      field: null,
    };
  }
}
