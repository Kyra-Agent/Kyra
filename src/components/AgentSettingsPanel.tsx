import { CheckCircle2, LoaderCircle, Save, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  type AgentSettingsDraft,
  createDefaultAgentSettings,
  getAgentSettingsProblem,
} from "../config/agentSettings";
import { fetchAgentSettings, saveAgentSettings } from "../services/agentSettingsService";
import type { KyraAuthSession } from "../services/supabaseAuthService";
import type { AgentTemplate } from "../types/agent";
import { AgentSettingsFields } from "./AgentSettingsFields";

interface AgentSettingsPanelProps {
  session: KyraAuthSession;
  agentId: string;
  agentName: string;
  template: AgentTemplate;
}

type PanelStatus = "loading" | "ready" | "saving" | "saved" | "error";

// Lets the owner change a deployed agent's tone, actions, focus, project
// knowledge, and safety limits. Changes apply from the bot's next message.
export function AgentSettingsPanel({
  session,
  agentId,
  agentName,
  template,
}: AgentSettingsPanelProps) {
  const [draft, setDraft] = useState<AgentSettingsDraft>(createDefaultAgentSettings);
  const [savedDraft, setSavedDraft] = useState<AgentSettingsDraft>(createDefaultAgentSettings);
  const [status, setStatus] = useState<PanelStatus>("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    setStatus("loading");
    setMessage("");
    fetchAgentSettings(session, agentId)
      .then((settings) => {
        if (!active) {
          return;
        }
        setDraft(settings);
        setSavedDraft(settings);
        setStatus("ready");
      })
      .catch(() => {
        if (!active) {
          return;
        }
        const defaults = createDefaultAgentSettings();
        setDraft(defaults);
        setSavedDraft(defaults);
        setStatus("error");
        setMessage("Kyra could not load this agent's settings. Defaults are shown; saving still works.");
      });

    return () => {
      active = false;
    };
  }, [agentId, session]);

  const dirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedDraft),
    [draft, savedDraft],
  );
  const busy = status === "loading" || status === "saving";

  async function handleSave() {
    const problem = getAgentSettingsProblem(draft);

    if (problem) {
      setStatus("error");
      setMessage(problem);
      return;
    }

    setStatus("saving");
    setMessage("");
    const result = await saveAgentSettings(session, agentId, draft);

    if (result.ok && result.settings) {
      setDraft(result.settings);
      setSavedDraft(result.settings);
      setStatus("saved");
    } else {
      setStatus("error");
    }

    setMessage(result.message);
  }

  return (
    <section className="dashboard-panel agent-settings-panel" id="agent-settings">
      <div className="panel-title">
        <span>Agent settings</span>
        <span>{agentName}</span>
      </div>
      <p className="agent-settings-intro">
        Shape how {agentName} answers in Telegram. Settings never unlock wallet actions; your wallet still signs everything.
      </p>

      {status === "loading" ? (
        <p className="agent-settings-status">
          <LoaderCircle className="spin-icon" size={15} />
          Loading settings...
        </p>
      ) : (
        <AgentSettingsFields
          disabled={busy}
          idPrefix={`settings-${agentId.slice(0, 8)}`}
          onChange={(next) => {
            setDraft(next);
            if (status === "saved" || status === "error") {
              setStatus("ready");
              setMessage("");
            }
          }}
          template={template}
          value={draft}
        />
      )}

      <div className="agent-settings-actions">
        <button
          className="button button-primary"
          disabled={busy || !dirty}
          onClick={() => void handleSave()}
          type="button"
        >
          {status === "saving" ? <LoaderCircle className="spin-icon" size={16} /> : <Save size={16} />}
          {status === "saving" ? "Saving..." : "Save settings"}
        </button>
        {message ? (
          <p
            className={`agent-settings-status status-${status}`}
            role={status === "error" ? "alert" : "status"}
          >
            {status === "saved" ? <CheckCircle2 size={15} /> : <TriangleAlert size={15} />}
            {message}
          </p>
        ) : null}
      </div>
    </section>
  );
}
