import { LoaderCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";
import type { KyraAuthSession } from "../services/supabaseAuthService";
import { selectRows } from "../services/supabaseRestClient";

interface CommunityChatsPanelProps {
  session: KyraAuthSession;
  agentId: string;
  agentName: string;
  botHandle: string | null;
}

interface CommunityChatRow {
  chat_title: string;
  telegram_chat_id: string;
  created_at: string;
}

type PanelStatus = "loading" | "ready" | "error";

// Shows the Telegram groups where this agent answers community members and
// explains how the owner turns community mode on or off from Telegram.
export function CommunityChatsPanel({
  session,
  agentId,
  agentName,
  botHandle,
}: CommunityChatsPanelProps) {
  const [chats, setChats] = useState<CommunityChatRow[]>([]);
  const [status, setStatus] = useState<PanelStatus>("loading");

  useEffect(() => {
    let active = true;

    setStatus("loading");
    selectRows<CommunityChatRow>(
      session,
      `telegram_community_chats?select=chat_title,telegram_chat_id,created_at&agent_id=eq.${
        encodeURIComponent(agentId)
      }&revoked_at=is.null&order=created_at.desc&limit=5`,
    )
      .then((rows) => {
        if (active) {
          setChats(rows);
          setStatus("ready");
        }
      })
      .catch(() => {
        if (active) {
          setStatus("error");
        }
      });

    return () => {
      active = false;
    };
  }, [agentId, session]);

  const bot = botHandle && botHandle.startsWith("@") ? botHandle : "your bot";

  return (
    <section className="dashboard-panel community-chats-panel" id="community">
      <div className="panel-title">
        <span>Community chats</span>
        <span>
          {status === "ready" ? `${chats.length}/5 groups` : "Telegram groups"}
        </span>
      </div>
      <p className="agent-settings-intro">
        Let {agentName} answer your community in Telegram groups. Members ask with /ask or by replying
        to the bot. Answers are read-only, use your project knowledge and live Robinhood Chain data, and
        are rate limited.
      </p>

      {status === "loading" ? (
        <p className="agent-settings-status">
          <LoaderCircle className="spin-icon" size={15} />
          Loading groups...
        </p>
      ) : status === "error" ? (
        <p className="agent-settings-status status-error">
          Kyra could not load your community groups right now.
        </p>
      ) : chats.length ? (
        <ul className="community-chat-list">
          {chats.map((chat) => (
            <li key={chat.telegram_chat_id}>
              <Users size={15} />
              <strong>{chat.chat_title || "Untitled group"}</strong>
              <small>since {new Date(chat.created_at).toLocaleDateString()}</small>
            </li>
          ))}
        </ul>
      ) : (
        <p className="agent-settings-hint">No groups yet.</p>
      )}

      <ol className="community-chat-steps">
        <li>Add {bot} to your Telegram group.</li>
        <li>
          In the group, send <code>/community_on</code> from your own Telegram account (the one linked as
          owner).
        </li>
        <li>
          Members ask with{" "}
          <code>/ask{botHandle && botHandle.startsWith("@") ? botHandle : "@yourbot"}</code>{" "}
          followed by a question, or by replying to one of the bot&apos;s messages. Telegram only passes
          plain group messages to bots in those two cases.
        </li>
        <li>
          Send <code>/community_off</code> in the group to stop.
        </li>
      </ol>
    </section>
  );
}
