import {
  Activity,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  Database,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  Server,
  Radio,
  ShieldCheck,
  Terminal,
  WalletCards,
} from "lucide-react";
import type { AgentTemplate } from "../types/agent";
import { appConfig } from "../config/appConfig";
import { coreModules } from "../data/modules";
import { kyraDataService } from "../services/kyraDataService";
import { kyraRepositoryRuntime } from "../services/repositoryFactory";
import {
  getSupabaseAdapterStatus,
  type SupabaseConnectionStatus,
} from "../services/supabaseKyraRepository";
import type { DataProvider } from "../types/api";
import type { DemoApprovalRequest } from "../types/backend";

interface DashboardProps {
  selectedTemplate: AgentTemplate;
  templates: AgentTemplate[];
  templateCatalogSource: DataProvider;
  templateCatalogStatus: SupabaseConnectionStatus;
  templateCatalogError: string | null;
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

function formatRuntimeValue(value: string) {
  return value.replace(/-/g, " ");
}

function getReadinessTone(status: SupabaseConnectionStatus) {
  if (status === "connected") {
    return "ready";
  }

  return status === "error" ? "error" : "standby";
}

function getCatalogValue(status: SupabaseConnectionStatus, source: DataProvider, templateCount: number) {
  if (status === "connected") {
    return `${templateCount} from ${source}`;
  }

  if (status === "error") {
    return "mock fallback";
  }

  return status === "checking" ? "checking" : "local";
}

export function Dashboard({
  selectedTemplate,
  templates,
  templateCatalogSource,
  templateCatalogStatus,
  templateCatalogError,
  onBackHome,
  onOpenAgent,
}: DashboardProps) {
  const agentTemplates = templates;
  const agentRecord = kyraDataService.getAgentInstance(selectedTemplate.id);
  const visibleRequests = kyraDataService.listPriorityApprovalRequests(selectedTemplate.id, 3);
  const walletPolicies = kyraDataService.listWalletPolicies();
  const backendTables = kyraDataService.listBackendTables();
  const workspace = kyraDataService.getWorkspace();
  const supabaseStatus = getSupabaseAdapterStatus();
  const readinessRows = [
    {
      label: "Demo records",
      value: kyraRepositoryRuntime.activeProvider,
      tone: "ready",
      icon: Database,
    },
    {
      label: "Template catalog",
      value: getCatalogValue(templateCatalogStatus, templateCatalogSource, agentTemplates.length),
      tone: getReadinessTone(templateCatalogStatus),
      icon: Server,
    },
    {
      label: "Supabase env",
      value: supabaseStatus.configured ? "configured" : "waiting",
      tone: supabaseStatus.configured ? "ready" : "standby",
      icon: Database,
    },
    {
      label: "Auth",
      value: appConfig.integrations.auth,
      tone: appConfig.integrations.auth === "supabase" ? "ready" : "standby",
      icon: KeyRound,
    },
    {
      label: "Database",
      value: appConfig.integrations.database,
      tone: appConfig.integrations.database === "supabase" ? "ready" : "standby",
      icon: Server,
    },
    {
      label: "Execution",
      value: appConfig.integrations.walletExecution,
      tone: "locked",
      icon: LockKeyhole,
    },
  ];
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
          <a href="#backend">
            <Server size={16} />
            Backend
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

          <section className="dashboard-panel backend-readiness-panel" id="backend">
            <div className="panel-title">
              <span>backend.readiness</span>
              <span>{formatRuntimeValue(appConfig.mode)}</span>
            </div>
            <div className="readiness-summary">
              <span className={`readiness-chip readiness-${getReadinessTone(templateCatalogStatus)}`}>
                <ShieldCheck size={14} />
                {templateCatalogStatus === "connected" ? "Supabase read connected" : "demo safe"}
              </span>
              <p>{kyraRepositoryRuntime.note}</p>
              {templateCatalogError ? (
                <p className="readiness-error-note">
                  Supabase catalog query failed. Kyra is using local template fallback for this session.
                </p>
              ) : null}
            </div>
            <div className="readiness-grid">
              {readinessRows.map((item) => {
                const Icon = item.icon;

                return (
                  <article className={`readiness-item readiness-${item.tone}`} key={item.label}>
                    <Icon size={16} />
                    <span>
                      <small>{item.label}</small>
                      <strong>{formatRuntimeValue(item.value)}</strong>
                    </span>
                  </article>
                );
              })}
            </div>
            <div className="backend-contract-line">
              <span>{supabaseStatus.tables.length} Supabase tables mapped</span>
              <span>{agentTemplates.length} templates loaded</span>
              <span>onchain execution disabled</span>
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
