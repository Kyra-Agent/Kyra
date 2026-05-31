import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Radio,
  ShieldCheck,
  Terminal,
  WalletCards,
} from "lucide-react";
import type { AgentTemplate } from "../types/agent";
import { agentTemplates } from "../data/templates";
import { dashboardLogs } from "../data/demoLogs";
import { coreModules } from "../data/modules";

interface DashboardProps {
  selectedTemplate: AgentTemplate;
  onBackHome: () => void;
}

const queue = [
  {
    title: "Swap prepared",
    meta: "10 USDC -> ETH",
    status: "waiting approval",
    tone: "pending",
  },
  {
    title: "Holder verification",
    meta: "wallet proof ready",
    status: "read-only",
    tone: "ok",
  },
  {
    title: "Launch scan",
    meta: "3 signals flagged",
    status: "review",
    tone: "review",
  },
];

const wallets = [
  { label: "Base Account", value: "0x8a...91c", status: "demo connected" },
  { label: "Daily limit", value: "100 USDC", status: "simulated" },
  { label: "Policy", value: "Approval required", status: "active" },
];

export function Dashboard({ selectedTemplate, onBackHome }: DashboardProps) {
  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <span className="agent-orb">K</span>
          <div>
            <strong>Kyra Console</strong>
            <small>Demo workspace</small>
          </div>
        </div>

        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          <a className="is-active" href="#overview">
            <Activity size={16} />
            Overview
          </a>
          <a href="#approvals">
            <WalletCards size={16} />
            Approvals
          </a>
          <a href="#logs">
            <Terminal size={16} />
            Logs
          </a>
          <a href="#modules">
            <Radio size={16} />
            Modules
          </a>
        </nav>

        <button className="button button-ghost dashboard-back" type="button" onClick={onBackHome}>
          <ArrowLeft size={16} />
          Home
        </button>
      </aside>

      <section className="dashboard-main">
        <div className="dashboard-topbar">
          <div>
            <span className="demo-badge compact">
              <Bot size={14} />
              Agent online
            </span>
            <h1>Kyra {selectedTemplate.name}</h1>
            <p>{selectedTemplate.role}</p>
          </div>
          <a className="button button-primary" href="#approvals">
            Review Queue
            <ExternalLink size={16} />
          </a>
        </div>

        <section className="dashboard-kpi-grid" id="overview">
          <article>
            <span>Template</span>
            <strong>{selectedTemplate.name}</strong>
            <small>{selectedTemplate.status}</small>
          </article>
          <article>
            <span>Platform</span>
            <strong>Telegram</strong>
            <small>@kyra_{selectedTemplate.id}_demo</small>
          </article>
          <article>
            <span>Wallet</span>
            <strong>Demo connected</strong>
            <small>no real funds touched</small>
          </article>
          <article>
            <span>Approval policy</span>
            <strong>Required</strong>
            <small>Kyra prepares, wallet decides</small>
          </article>
        </section>

        <div className="dashboard-content-grid">
          <section className="dashboard-panel agent-overview-panel">
            <div className="panel-title">
              <span>agent.instance</span>
              <span>demo</span>
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
          </section>

          <section className="dashboard-panel" id="approvals">
            <div className="panel-title">
              <span>approval.queue</span>
              <span>{queue.length} items</span>
            </div>
            <div className="queue-list">
              {queue.map((item) => (
                <article className={`queue-item queue-${item.tone}`} key={item.title}>
                  <span className="queue-icon">
                    {item.tone === "pending" ? <Clock3 size={16} /> : <ShieldCheck size={16} />}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.meta}</small>
                  </div>
                  <em>{item.status}</em>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-panel">
            <div className="panel-title">
              <span>wallet.policy</span>
              <span>safe mode</span>
            </div>
            <div className="wallet-policy-list">
              {wallets.map((wallet) => (
                <article key={wallet.label}>
                  <span>{wallet.label}</span>
                  <strong>{wallet.value}</strong>
                  <small>{wallet.status}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-panel" id="logs">
            <div className="panel-title">
              <span>activity.stream</span>
              <span>live replay</span>
            </div>
            <div className="dashboard-log-box">
              {dashboardLogs.concat([
                "[12:05:07] dashboard route opened",
                "[12:05:08] approval policy visible",
                "[12:05:09] demo mode remains active",
              ]).map((log) => (
                <p key={log}>{log}</p>
              ))}
            </div>
          </section>

          <section className="dashboard-panel" id="modules">
            <div className="panel-title">
              <span>kyra.modules</span>
              <span>core online</span>
            </div>
            <div className="dashboard-module-grid">
              {coreModules.map((module) => (
                <article key={module.id}>
                  <strong>{module.name}</strong>
                  <span>{module.title}</span>
                  <small>{module.status}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-panel template-switch-panel">
            <div className="panel-title">
              <span>available.templates</span>
              <span>{agentTemplates.length}</span>
            </div>
            <div className="mini-template-list">
              {agentTemplates.map((template) => (
                <article
                  className={template.id === selectedTemplate.id ? "is-active" : ""}
                  key={template.id}
                >
                  <strong>{template.name}</strong>
                  <small>{template.role}</small>
                </article>
              ))}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
