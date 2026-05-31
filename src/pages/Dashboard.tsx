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
import { coreModules } from "../data/modules";
import { kyraDataService } from "../services/kyraDataService";
import type { DemoApprovalRequest } from "../types/backend";

interface DashboardProps {
  selectedTemplate: AgentTemplate;
  onBackHome: () => void;
  onOpenAgent: () => void;
}

function getQueueTone(request: DemoApprovalRequest) {
  if (request.status === "waiting_wallet") {
    return "pending";
  }

  return request.status === "read_only_ready" ? "ok" : "review";
}

function formatQueueStatus(status: DemoApprovalRequest["status"]) {
  return status.replace(/_/g, " ");
}

export function Dashboard({ selectedTemplate, onBackHome, onOpenAgent }: DashboardProps) {
  const agentTemplates = kyraDataService.listTemplates();
  const agentRecord = kyraDataService.getAgentInstance(selectedTemplate.id);
  const visibleRequests = kyraDataService.listPriorityApprovalRequests(selectedTemplate.id, 3);
  const walletPolicies = kyraDataService.listWalletPolicies();
  const backendTables = kyraDataService.listBackendTables();
  const workspace = kyraDataService.getWorkspace();
  const activityLines = kyraDataService.listActivityLines([
    "[12:05:07] dashboard route opened",
    "[12:05:08] approval policy visible",
    "[12:05:09] demo mode remains active",
  ]);

  return (
    <main className="dashboard-page">
      <aside className="dashboard-sidebar">
        <div className="sidebar-brand">
          <span className="agent-orb">K</span>
          <div>
            <strong>Kyra Console</strong>
            <small>{workspace.name}</small>
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
            <h1>{agentRecord.displayName}</h1>
            <p>{selectedTemplate.role}</p>
          </div>
          <button className="button button-primary" type="button" onClick={onOpenAgent}>
            Open Public Agent
            <ExternalLink size={16} />
          </button>
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
            <small>{agentRecord.handle}</small>
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
              <span>{agentRecord.id}</span>
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
              <span>{visibleRequests.length} items</span>
            </div>
            <div className="queue-list">
              {visibleRequests.map((item) => (
                <article className={`queue-item queue-${getQueueTone(item)}`} key={item.id}>
                  <span className="queue-icon">
                    {getQueueTone(item) === "pending" ? (
                      <Clock3 size={16} />
                    ) : (
                      <ShieldCheck size={16} />
                    )}
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <small>{item.command}</small>
                  </div>
                  <em>{formatQueueStatus(item.status)}</em>
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
              {walletPolicies.map((policy) => (
                <article key={policy.id}>
                  <span>{policy.label}</span>
                  <strong>{policy.value}</strong>
                  <small>{policy.status}: {policy.description}</small>
                </article>
              ))}
            </div>
          </section>

          <section className="dashboard-panel backend-shape-panel">
            <div className="panel-title">
              <span>backend.records</span>
              <span>frontend mock</span>
            </div>
            <div className="backend-table-list">
              {backendTables.map((table) => (
                <article key={table.name}>
                  <span>{table.name}</span>
                  <strong>{table.records} records</strong>
                  <small>{table.purpose}</small>
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
              {activityLines.map((log) => (
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
