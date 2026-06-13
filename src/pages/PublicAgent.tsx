import { useEffect, useState } from "react";
import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Copy,
  Database,
  LockKeyhole,
  MessageSquareText,
  Radio,
  Route,
  ShieldCheck,
  Sparkles,
  Terminal,
  WalletCards,
} from "lucide-react";
import type { AgentTemplate } from "../types/agent";
import { kyraDataService } from "../services/kyraDataService";
import {
  fetchPublicAgentProfile,
  type PublicAgentProfile,
  type PublicAgentProfileStatus,
} from "../services/supabasePublicAgentService";

interface PublicAgentProps {
  selectedTemplate: AgentTemplate;
  agentSlug: string;
  onBackDashboard: () => void;
  onBackHome: () => void;
}

const capabilityRows = [
  {
    title: "Telegram interface",
    summary: "Telegram status is controlled by the owner dashboard.",
    icon: Bot,
  },
  {
    title: "Base action layer",
    summary: "Show approval-first Base action preparation while execution stays simulated.",
    icon: Radio,
  },
  {
    title: "Approval guard",
    summary: "No custody, no seed phrases, no real transactions in this demo.",
    icon: ShieldCheck,
  },
];

function getPublicStatusLabel(status: PublicAgentProfileStatus) {
  if (status === "connected") {
    return "Persisted demo profile";
  }

  if (status === "loading") {
    return "Loading public profile";
  }

  return "Public agent preview";
}

function isDemoPreviewSlug(agentSlug: string) {
  return agentSlug.endsWith("-demo");
}

function formatDemoRouteStatus(status: string) {
  return status === "mocked" ? "simulated" : status;
}

function getPublicTelegramPanelStatus(status: string) {
  if (status === "active") {
    return {
      eyebrow: "Telegram live connect",
      headline: "Telegram bot connected",
      description:
        "This agent has an active Telegram bot connection. Public commands stay read-only while wallet, approval, and onchain actions remain gated.",
      label: "Read-only live",
    };
  }

  if (status === "queued") {
    return {
      eyebrow: "Telegram setup queued",
      headline: "Waiting for activation",
      description:
        "The owner has queued Telegram setup. Public profiles never collect bot tokens, and activation stays owner-controlled.",
      label: "Queued",
    };
  }

  return {
    eyebrow: "Telegram status",
    headline: "Controlled from dashboard",
    description:
      "Public profiles never collect bot tokens. Owners connect Telegram during deploy and manage selected-agent status or owner pairing from the dashboard.",
    label: "Status only",
  };
}

function getPublicAgentHeadline(displayName: string, templateName: string) {
  const normalizedName = displayName.trim();
  const normalizedTemplateName = templateName.trim();

  if (!normalizedName || normalizedName.toLowerCase() === "kyra") {
    return `Kyra ${normalizedTemplateName}`;
  }

  if (normalizedName.toLowerCase().includes(normalizedTemplateName.toLowerCase())) {
    return normalizedName;
  }

  return `${normalizedName} ${normalizedTemplateName}`;
}

export function PublicAgent({
  selectedTemplate,
  agentSlug,
  onBackDashboard,
  onBackHome,
}: PublicAgentProps) {
  const [copied, setCopied] = useState(false);
  const [publicStatus, setPublicStatus] = useState<PublicAgentProfileStatus>("loading");
  const [publicProfile, setPublicProfile] = useState<PublicAgentProfile | null>(null);
  const [publicError, setPublicError] = useState<string | null>(null);
  const canUseMockPreview = isDemoPreviewSlug(agentSlug);
  const showUnavailableAgent = !canUseMockPreview && !publicProfile && publicStatus !== "loading";
  const fallbackAgentRecord = kyraDataService.getAgentInstance(selectedTemplate.id);
  const agentRecord = publicProfile?.agent ?? (canUseMockPreview ? fallbackAgentRecord : null);
  const activeTemplate = publicProfile?.template ?? (canUseMockPreview ? selectedTemplate : null);
  const approvalPolicy = agentRecord ? kyraDataService.getApprovalPolicyForAgent(agentRecord) : null;
  const commandRows = activeTemplate ? kyraDataService.listPriorityApprovalRequests(activeTemplate.id, 4) : [];
  const profileSource = publicProfile ? "Persisted demo profile" : "Local demo preview";
  const telegramPanelStatus = getPublicTelegramPanelStatus(agentRecord?.telegramStatus ?? "mocked");

  useEffect(() => {
    let active = true;

    async function loadPublicProfile() {
      setPublicStatus("loading");
      setPublicError(null);

      const result = await fetchPublicAgentProfile(agentSlug, selectedTemplate.id);

      if (!active) {
        return;
      }

      setPublicStatus(result.status);
      setPublicProfile(result.ok ? result.profile : null);
      setPublicError(result.error);
    }

    void loadPublicProfile();

    return () => {
      active = false;
    };
  }, [agentSlug, selectedTemplate.id]);

  if (!agentRecord || !activeTemplate || showUnavailableAgent) {
    const loading = publicStatus === "loading";

    return (
      <main className="public-agent-page public-agent-empty-page">
        <section className="public-agent-empty-card">
          <button className="button button-ghost profile-back" type="button" onClick={onBackDashboard}>
            <ArrowLeft size={16} />
            Dashboard
          </button>

          <span className={`demo-badge ${loading ? "" : "status-paused"}`}>
            <Bot size={14} />
            {loading ? "Checking public profile" : "Expired demo agent"}
          </span>
          <h1>{loading ? "Checking agent route..." : "Demo agent unavailable."}</h1>
          <p>
            {loading
              ? "Kyra is checking whether this route maps to an active demo agent."
              : "This public agent route does not map to an active demo record. The demo workspace may have been reset, the record may have expired, or the agent was never deployed."}
          </p>
          {!loading ? (
            <div className="public-agent-empty-facts">
              <span>
                <ShieldCheck size={16} />
                No real funds touched
              </span>
              <span>
                <LockKeyhole size={16} />
                No keys stored
              </span>
              <span>
                <Terminal size={16} />
                No transactions executed
              </span>
            </div>
          ) : null}
          <div className="profile-cta-row">
            <button className="button button-primary" type="button" onClick={onBackDashboard}>
              Back to Dashboard
              <ArrowLeft size={16} />
            </button>
            <button className="button button-ghost" type="button" onClick={onBackHome}>
              View Website
            </button>
          </div>
          {publicError && !loading ? (
            <span className="demo-action-note public-profile-note">
              No active demo profile is available for this route.
            </span>
          ) : null}
        </section>
      </main>
    );
  }

  const visibleAgentRecord = agentRecord;
  const visibleTemplate = activeTemplate;
  const publicAgentHeadline = getPublicAgentHeadline(
    visibleAgentRecord.displayName,
    visibleTemplate.name,
  );

  function copyProfileLink() {
    const origin = typeof window === "undefined" ? "https://kyra-agent.demo" : window.location.origin;
    const profileUrl = `${origin}${visibleAgentRecord.publicPath}`;

    if (navigator.clipboard) {
      void navigator.clipboard.writeText(profileUrl);
    }

    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <main className="public-agent-page">
      <section className="agent-profile-hero">
        <div className="agent-profile-copy">
          <button className="button button-ghost profile-back" type="button" onClick={onBackDashboard}>
            <ArrowLeft size={16} />
            Dashboard
          </button>

          <span className="demo-badge">
            <Bot size={14} />
            {getPublicStatusLabel(publicStatus)}
          </span>
          <div className="public-status-line" aria-label="Agent public status">
            <span>
              <Activity size={15} />
              {visibleAgentRecord.status}
            </span>
            <span>
              <Radio size={15} />
              {visibleAgentRecord.network}
            </span>
            <span>
              <ShieldCheck size={15} />
              wallet approval
            </span>
          </div>
          <h1>{publicAgentHeadline}</h1>
          <p>
            A share-ready backend demo profile for a deployed Kyra agent. It shows public
            identity, available demo commands, and safety policy while Telegram and Base
            execution remain simulated.
          </p>
          {publicError ? (
            <span className="demo-action-note public-profile-note">
              Connected profile unavailable. Showing the local demo preview.
            </span>
          ) : null}

          <div className="profile-cta-row">
            <button
              className="button button-primary"
              type="button"
              onClick={onBackDashboard}
            >
              Open Dashboard
              <ArrowLeft size={16} />
            </button>
            <button className="button button-ghost" type="button" onClick={onBackHome}>
              View Website
            </button>
            <button className="button button-ghost" type="button" onClick={copyProfileLink}>
              <Copy size={16} />
              {copied ? "Copied" : "Copy Profile"}
            </button>
          </div>
          <span className="demo-action-note">
            Telegram connection changes are owner-only and handled from deploy or explicit reconnect flows.
          </span>
        </div>

        <div className="agent-identity-card">
          <div className="identity-signal">
            <div className="identity-core">
              <span>KYRA</span>
              <strong>{visibleTemplate.name}</strong>
              <small>{visibleAgentRecord.handle}</small>
            </div>
            <span className="identity-ring" />
          </div>
          <div className="agent-card-header public-agent-handle">
            <span className="agent-orb">
              <img src="/brand/kyra.jpg" alt="" aria-hidden="true" />
            </span>
            <div>
              <strong>{visibleAgentRecord.handle}</strong>
              <small>{visibleTemplate.role}</small>
            </div>
          </div>
          <div className="profile-status-grid">
            <span>
              Status
              <strong>{visibleAgentRecord.status}</strong>
            </span>
            <span>
              Network
              <strong>{visibleAgentRecord.network}</strong>
            </span>
            <span>
              Mode
              <strong>Demo</strong>
            </span>
            <span>
              Public route
              <strong>{visibleAgentRecord.publicPath}</strong>
            </span>
          </div>
        </div>
      </section>

      <section className="public-proof-strip" aria-label="Kyra public agent facts">
        <span>
          <Database size={16} />
          {profileSource}
        </span>
        <span>
          <LockKeyhole size={16} />
          {approvalPolicy?.value ?? "Approval required"}
        </span>
        <span>
          <Route size={16} />
          {formatDemoRouteStatus(visibleAgentRecord.baseMcpStatus)} Base action route
        </span>
      </section>

      <section className="public-agent-grid">
        <article className="public-panel public-summary">
          <div className="panel-title">
            <span>Agent summary</span>
            <span>{visibleTemplate.status}</span>
          </div>
          <p>{visibleTemplate.summary}</p>
          <div className="dashboard-action-chips">
            {visibleTemplate.actions.map((action) => (
              <span className="chip chip-active" key={action}>
                <CheckCircle2 size={13} />
                {action}
              </span>
            ))}
          </div>
        </article>

        <article className="public-panel telegram-status-panel">
          <div className="panel-title">
            <span>Telegram connection</span>
            <span>{formatDemoRouteStatus(agentRecord.telegramStatus)}</span>
          </div>
          <div className="telegram-status-card">
            <span className="telegram-status-icon">
              <Bot size={18} />
            </span>
            <div>
              <small>{telegramPanelStatus.eyebrow}</small>
              <strong>{telegramPanelStatus.headline}</strong>
              <p>{telegramPanelStatus.description}</p>
            </div>
          </div>
          <div className="telegram-status-actions">
            <button className="button button-ghost" type="button" onClick={onBackDashboard}>
              <LockKeyhole size={16} />
              Owner Dashboard
            </button>
            <span>{telegramPanelStatus.label}</span>
          </div>
        </article>

        <article className="public-panel">
          <div className="panel-title">
            <span>Capabilities</span>
            <span>demo</span>
          </div>
          <div className="capability-list">
            {capabilityRows.map((item) => {
              const Icon = item.icon;

              return (
                <div key={item.title}>
                  <Icon size={17} />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.summary}</small>
                  </span>
                </div>
              );
            })}
          </div>
        </article>

        <article className="public-panel">
          <div className="panel-title">
            <span>Try commands</span>
            <span>{commandRows.length} examples</span>
          </div>
          <div className="command-demo-list public-command-list">
            {commandRows.map((request) => (
              <div key={request.id}>
                <MessageSquareText size={16} />
                <span>
                  <code>{request.command}</code>
                  <small>{request.route}</small>
                </span>
                <em>{request.requiresWallet ? "approval" : request.risk}</em>
              </div>
            ))}
          </div>
        </article>

        <article className="public-panel public-record-panel">
          <div className="panel-title">
            <span>Demo profile</span>
            <span>share-ready</span>
          </div>
          <div className="record-fact-grid">
            <span>
              Workspace
              <strong>Demo workspace</strong>
            </span>
            <span>
              Telegram
              <strong>{formatDemoRouteStatus(visibleAgentRecord.telegramStatus)}</strong>
            </span>
            <span>
              Base actions
              <strong>{formatDemoRouteStatus(visibleAgentRecord.baseMcpStatus)}</strong>
            </span>
            <span>
              Last sync
              <strong>{visibleAgentRecord.lastSyncAt.slice(0, 16).replace("T", " ")}</strong>
            </span>
          </div>
        </article>

        <article className="public-panel security-profile-panel">
          <div className="panel-title">
            <span>Safety policy</span>
            <span>required</span>
          </div>
          <div className="profile-safety-grid">
            <span>
              <ShieldCheck size={17} />
              No seed phrases
            </span>
            <span>
              <WalletCards size={17} />
              No custody
            </span>
            <span>
              <Terminal size={17} />
              Demo mode only
            </span>
            <span>
              <Sparkles size={17} />
              Public preview
            </span>
          </div>
          <p>
            Kyra prepares actions. The connected wallet is always the final decision
            point. This public preview does not execute real transactions.
          </p>
        </article>
      </section>
    </main>
  );
}
