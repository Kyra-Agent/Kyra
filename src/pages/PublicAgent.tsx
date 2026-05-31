import { useState } from "react";
import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Copy,
  Database,
  ExternalLink,
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

interface PublicAgentProps {
  selectedTemplate: AgentTemplate;
  onBackDashboard: () => void;
  onBackHome: () => void;
}

const capabilityRows = [
  {
    title: "Telegram interface",
    summary: "Command the agent from chat in demo mode.",
    icon: Bot,
  },
  {
    title: "Base action layer",
    summary: "Prepare Base actions through a Base MCP-style route.",
    icon: Radio,
  },
  {
    title: "Approval guard",
    summary: "No custody, no seed phrases, no real transactions in this demo.",
    icon: ShieldCheck,
  },
];

export function PublicAgent({ selectedTemplate, onBackDashboard, onBackHome }: PublicAgentProps) {
  const [copied, setCopied] = useState(false);
  const agentRecord = kyraDataService.getAgentInstance(selectedTemplate.id);
  const approvalPolicy = kyraDataService.getApprovalPolicyForAgent(agentRecord);
  const commandRows = kyraDataService.listPriorityApprovalRequests(selectedTemplate.id, 4);
  const backendTables = kyraDataService.listBackendTables();

  function copyProfileLink() {
    const origin = typeof window === "undefined" ? "https://kyra-agent.demo" : window.location.origin;
    const profileUrl = `${origin}${agentRecord.publicPath}`;

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
            Public agent preview
          </span>
          <div className="public-status-line" aria-label="Agent public status">
            <span>
              <Activity size={15} />
              {agentRecord.status}
            </span>
            <span>
              <Radio size={15} />
              {agentRecord.network}
            </span>
            <span>
              <ShieldCheck size={15} />
              wallet approval
            </span>
          </div>
          <h1>{agentRecord.displayName}</h1>
          <p>
            A share-ready preview for a deployed Kyra agent. It shows the public identity,
            available commands, safety policy, and backend-shaped records before live
            Telegram and Base MCP integrations are connected.
          </p>

          <div className="profile-cta-row">
            <button className="button button-primary" type="button">
              Open Telegram Demo
              <ExternalLink size={16} />
            </button>
            <button className="button button-ghost" type="button" onClick={onBackHome}>
              View Website
            </button>
            <button className="button button-ghost" type="button" onClick={copyProfileLink}>
              <Copy size={16} />
              {copied ? "Copied" : "Copy Profile"}
            </button>
          </div>
        </div>

        <div className="agent-identity-card">
          <div className="identity-signal">
            <div className="identity-core">
              <span>KYRA</span>
              <strong>{selectedTemplate.name}</strong>
              <small>{agentRecord.handle}</small>
            </div>
            <span className="identity-ring" />
          </div>
          <div className="agent-card-header public-agent-handle">
            <span className="agent-orb">K</span>
            <div>
              <strong>{agentRecord.handle}</strong>
              <small>{selectedTemplate.role}</small>
            </div>
          </div>
          <div className="profile-status-grid">
            <span>
              Status
              <strong>{agentRecord.status}</strong>
            </span>
            <span>
              Network
              <strong>{agentRecord.network}</strong>
            </span>
            <span>
              Mode
              <strong>{agentRecord.mode}</strong>
            </span>
            <span>
              Public route
              <strong>{agentRecord.publicPath}</strong>
            </span>
          </div>
        </div>
      </section>

      <section className="public-proof-strip" aria-label="Kyra public agent facts">
        <span>
          <Database size={16} />
          {backendTables.length} mock tables
        </span>
        <span>
          <LockKeyhole size={16} />
          {approvalPolicy?.value ?? "Approval required"}
        </span>
        <span>
          <Route size={16} />
          {agentRecord.baseMcpStatus} Base MCP route
        </span>
      </section>

      <section className="public-agent-grid">
        <article className="public-panel public-summary">
          <div className="panel-title">
            <span>agent.summary</span>
            <span>{selectedTemplate.status}</span>
          </div>
          <p>{selectedTemplate.summary}</p>
          <div className="dashboard-action-chips">
            {selectedTemplate.actions.map((action) => (
              <span className="chip chip-active" key={action}>
                <CheckCircle2 size={13} />
                {action}
              </span>
            ))}
          </div>
        </article>

        <article className="public-panel">
          <div className="panel-title">
            <span>capabilities</span>
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
            <span>try.commands</span>
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
            <span>agent.record</span>
            <span>{agentRecord.id}</span>
          </div>
          <div className="record-fact-grid">
            <span>
              Workspace
              <strong>{agentRecord.workspaceId}</strong>
            </span>
            <span>
              Telegram
              <strong>{agentRecord.telegramStatus}</strong>
            </span>
            <span>
              Base MCP
              <strong>{agentRecord.baseMcpStatus}</strong>
            </span>
            <span>
              Last sync
              <strong>{agentRecord.lastSyncAt.slice(0, 16).replace("T", " ")}</strong>
            </span>
          </div>
        </article>

        <article className="public-panel security-profile-panel">
          <div className="panel-title">
            <span>safety.policy</span>
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
            point. This preview does not execute real transactions.
          </p>
        </article>
      </section>
    </main>
  );
}
