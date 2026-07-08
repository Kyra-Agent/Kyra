import {
  Activity,
  ArrowRight,
  CircleDot,
  Clock,
  ExternalLink,
} from "lucide-react";
import type { AgentTemplate } from "../types/agent";
import { kyraDataService } from "../services/kyraDataService";

interface DashboardPreviewProps {
  selectedTemplate: AgentTemplate;
}

export function DashboardPreview({ selectedTemplate }: DashboardPreviewProps) {
  const agentRecord = kyraDataService.getAgentInstance(selectedTemplate.id);
  const dashboardLogs = kyraDataService.listActivityLines();

  return (
    <section className="section dashboard-section">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Agent Workspace</p>
          <h2>One agent workspace across Telegram, dashboard, and approvals.</h2>
        </div>
        <span className="demo-badge">
          <CircleDot size={14} />
          Workspace model
        </span>
      </div>

      <div className="dashboard-grid">
        <div className="agent-card">
          <div className="agent-card-header">
            <span className="agent-orb">
              <img src="/brand/kyra.jpg" alt="" aria-hidden="true" />
            </span>
            <div>
              <strong>{agentRecord.displayName}</strong>
              <small>{selectedTemplate.role}</small>
            </div>
          </div>
          <p>{selectedTemplate.bestFor}</p>
          <div className="metric-grid">
            <span>
              Template
              <strong>{selectedTemplate.name}</strong>
            </span>
            <span>
              Mode
              <strong>Protected</strong>
            </span>
            <span>
              Platform
              <strong>{agentRecord.handle}</strong>
            </span>
            <span>
              Approval
              <strong>Required</strong>
            </span>
          </div>
        </div>

        <div className="approval-card">
          <div className="panel-title">
            <span>Approval queue</span>
            <span className="status-pill status-mvp">Review ready</span>
          </div>
          <div className="approval-flow">
            <span>
              <Activity size={16} />
              command received
            </span>
            <ArrowRight size={16} />
            <span>
              <Clock size={16} />
              review prepared
            </span>
            <ArrowRight size={16} />
            <span>
              <ExternalLink size={16} />
              wallet approval
            </span>
          </div>
          <p className="muted">
            Kyra prepares review context. Wallet prompts, signing, and network fees require the owner-controlled approval path.
          </p>
        </div>

        <div className="logs-card">
          <div className="panel-title">
            <span>Activity logs</span>
            <span>activity replay</span>
          </div>
          <div className="log-stream">
            {dashboardLogs.map((log) => <p key={log}>{log}</p>)}
          </div>
        </div>
      </div>
    </section>
  );
}
