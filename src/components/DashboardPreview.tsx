import { Activity, ArrowRight, CircleDot, Clock, ExternalLink } from "lucide-react";
import type { AgentTemplate } from "../types/agent";
import { dashboardLogs } from "../data/demoLogs";

interface DashboardPreviewProps {
  selectedTemplate: AgentTemplate;
}

export function DashboardPreview({ selectedTemplate }: DashboardPreviewProps) {
  return (
    <section className="section dashboard-section">
      <div className="dashboard-header">
        <div>
          <p className="eyebrow">Agent Output</p>
          <h2>Telegram agent, Kyra console, approval workflow.</h2>
        </div>
        <span className="demo-badge">
          <CircleDot size={14} />
          Agent online
        </span>
      </div>

      <div className="dashboard-grid">
        <div className="agent-card">
          <div className="agent-card-header">
            <span className="agent-orb">K</span>
            <div>
              <strong>Kyra {selectedTemplate.name}</strong>
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
              <strong>Demo</strong>
            </span>
            <span>
              Platform
              <strong>Telegram</strong>
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
            <span className="status-pill status-mvp">Waiting</span>
          </div>
          <div className="approval-flow">
            <span>
              <Activity size={16} />
              command received
            </span>
            <ArrowRight size={16} />
            <span>
              <Clock size={16} />
              approval requested
            </span>
            <ArrowRight size={16} />
            <span>
              <ExternalLink size={16} />
              wallet decides
            </span>
          </div>
          <p className="muted">
            Kyra prepares the action. Your wallet approves and pays network fees.
          </p>
        </div>

        <div className="logs-card">
          <div className="panel-title">
            <span>Activity logs</span>
            <span>demo replay</span>
          </div>
          <div className="log-stream">
            {dashboardLogs.map((log) => (
              <p key={log}>{log}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
