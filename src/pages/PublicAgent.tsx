import {
  ArrowLeft,
  Bot,
  CheckCircle2,
  ExternalLink,
  MessageSquareText,
  Radio,
  ShieldCheck,
  Terminal,
  WalletCards,
} from "lucide-react";
import type { AgentTemplate } from "../types/agent";
import { getDemoAgentInstance } from "../data/demoBackend";
import { demoScenarios } from "../data/demoScenarios";

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
    summary: "Prepare wallet-approved actions through the Base MCP concept.",
    icon: Radio,
  },
  {
    title: "Approval guard",
    summary: "No custody, no seed phrases, no real transactions in this demo.",
    icon: ShieldCheck,
  },
];

export function PublicAgent({ selectedTemplate, onBackDashboard, onBackHome }: PublicAgentProps) {
  const agentRecord = getDemoAgentInstance(selectedTemplate.id);

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
          <h1>{agentRecord.displayName}</h1>
          <p>
            A public-facing preview of the deployed agent instance. This page shows what
            users, communities, or project members would see before opening the agent in
            Telegram.
          </p>

          <div className="profile-cta-row">
            <button className="button button-primary" type="button">
              Open Telegram Demo
              <ExternalLink size={16} />
            </button>
            <button className="button button-ghost" type="button" onClick={onBackHome}>
              View Website
            </button>
          </div>
        </div>

        <div className="agent-identity-card">
          <div className="agent-card-header">
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
              Route
              <strong>{agentRecord.publicPath}</strong>
            </span>
          </div>
        </div>
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
            <span>simulated</span>
          </div>
          <div className="command-demo-list">
            {demoScenarios.map((scenario) => (
              <div key={scenario.id}>
                <MessageSquareText size={16} />
                <code>{scenario.command}</code>
                <small>{scenario.approvalRequired ? "wallet approval" : "read-only"}</small>
              </div>
            ))}
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
