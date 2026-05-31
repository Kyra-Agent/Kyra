import { useMemo, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  Play,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import type { AgentTemplate } from "../types/agent";

interface DeployPanelProps {
  templates: AgentTemplate[];
  selectedTemplate: AgentTemplate;
  onSelectTemplate: (templateId: string) => void;
}

const deploySteps = [
  "compile agent profile",
  "load Kyra core modules",
  "link Telegram interface",
  "sync Base MCP endpoint",
  "enable wallet approval gate",
  "publish demo dashboard",
];

export function DeployPanel({ templates, selectedTemplate, onSelectTemplate }: DeployPanelProps) {
  const [agentName, setAgentName] = useState("Kyra Operator");
  const [deploying, setDeploying] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const selectedActions = useMemo(
    () => selectedTemplate.actions.slice(0, 5),
    [selectedTemplate.actions],
  );

  const terminalLines = useMemo(
    () => [
      `kyra deploy --template ${selectedTemplate.id} --agent "${agentName || "Unnamed Agent"}"`,
      `profile.template=${selectedTemplate.name}`,
      `profile.mode=demo`,
      `modules.load=${selectedTemplate.modules.join(",")}`,
      `actions.enable=${selectedActions.join(",")}`,
      "telegram.webhook=simulated",
      "base_mcp.endpoint=https://mcp.base.org/",
      "wallet.policy=approval_required",
      "security.no_private_keys=true",
      "demo.transactions=disabled",
    ],
    [agentName, selectedActions, selectedTemplate],
  );

  const activeLogCount = deploying
    ? Math.max(2, Math.min(terminalLines.length, activeStep + 4))
    : terminalLines.length;

  const progress = Math.round((Math.min(activeStep, deploySteps.length) / deploySteps.length) * 100);

  function runDeploySimulation() {
    setDeploying(true);
    setDeployed(false);
    setActiveStep(0);

    deploySteps.forEach((_, index) => {
      window.setTimeout(() => {
        setActiveStep(index + 1);
        if (index === deploySteps.length - 1) {
          window.setTimeout(() => {
            setDeploying(false);
            setDeployed(true);
          }, 700);
        }
      }, 420 * (index + 1));
    });
  }

  return (
    <section className="section deploy-section" id="deploy">
      <div className="section-heading">
        <p className="eyebrow">Deploy Flow</p>
        <h2>Demo deploy, no real funds touched.</h2>
        <p>
          This panel shows the product flow: configure a Telegram agent, connect wallet
          approval, then manage the deployed instance from Kyra.
        </p>
      </div>

      <div className="deploy-layout">
        <div className="config-panel">
          <div className="panel-title">
            <span>Agent config</span>
            <span className="demo-badge compact">Simulated</span>
          </div>

          <label className="field">
            <span>Agent name</span>
            <input
              value={agentName}
              onChange={(event) => setAgentName(event.target.value)}
              placeholder="Kyra Operator"
            />
          </label>

          <div className="field template-menu-field">
            <span>Choose template</span>
            <button
              className="template-menu-trigger"
              type="button"
              onClick={() => setTemplateMenuOpen((open) => !open)}
              aria-expanded={templateMenuOpen}
            >
              <span>
                <strong>{selectedTemplate.name}</strong>
                <small>{selectedTemplate.role}</small>
              </span>
              <ChevronDown size={18} />
            </button>

            {templateMenuOpen ? (
              <div className="template-menu" role="listbox" aria-label="Choose agent template">
                {templates.map((template) => {
                  const active = template.id === selectedTemplate.id;

                  return (
                    <button
                      className={active ? "is-selected" : ""}
                      key={template.id}
                      type="button"
                      onClick={() => {
                        onSelectTemplate(template.id);
                        setTemplateMenuOpen(false);
                      }}
                    >
                      <span>
                        <strong>{template.name}</strong>
                        <small>{template.role}</small>
                      </span>
                      <span className={`mini-label-inline status-${template.status}`}>
                        {template.status === "coming-soon" ? "soon" : template.status}
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>

          <label className="field">
            <span>Telegram bot token</span>
            <input readOnly value="demo mode - no real token required" />
          </label>

          <div className="connection-grid">
            <span>
              <Bot size={16} />
              Telegram interface
              <strong>ready</strong>
            </span>
            <span>
              <WalletCards size={16} />
              Base Account
              <strong>demo connected</strong>
            </span>
            <span>
              <ShieldCheck size={16} />
              Approval gate
              <strong>required</strong>
            </span>
          </div>

          <div className="action-select">
            <span className="field-label">Enabled actions</span>
            <div className="chip-row">
              {selectedActions.map((action) => (
                <span className="chip chip-active" key={action}>
                  <CheckCircle2 size={13} />
                  {action}
                </span>
              ))}
            </div>
          </div>

          <button className="button button-primary deploy-button" onClick={runDeploySimulation}>
            <Play size={17} />
            {deploying ? "Deploying demo..." : "Deploy demo agent"}
          </button>

          {deployed ? (
            <div className="deploy-receipt">
              <div className="receipt-top">
                <span>
                  <CheckCircle2 size={16} />
                  Agent deployed
                </span>
                <strong>demo</strong>
              </div>
              <div className="receipt-grid">
                <span>
                  Telegram
                  <strong>@kyra_{selectedTemplate.id}_demo</strong>
                </span>
                <span>
                  Console
                  <strong>kyra.app/agents/{selectedTemplate.id}-demo</strong>
                </span>
                <span>
                  Template
                  <strong>{selectedTemplate.name}</strong>
                </span>
                <span>
                  Wallet
                  <strong>approval required</strong>
                </span>
              </div>
              <div className="receipt-actions">
                <button type="button">
                  <Copy size={14} />
                  Copy demo link
                </button>
                <button type="button">
                  <ExternalLink size={14} />
                  Open console
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="deployment-terminal">
          <div className="terminal-heading">
            <span>deploy.log</span>
            <span>{progress}%</span>
          </div>

          <div className="deploy-progress" aria-label={`Deploy progress ${progress}%`}>
            <span style={{ width: `${progress}%` }} />
          </div>

          <div className="deploy-command-stack">
            {terminalLines.slice(0, activeLogCount).map((line, index) => (
              <p key={line} className={index < activeLogCount - 1 ? "complete" : "active"}>
                <span>&gt;</span>
                {line}
              </p>
            ))}
          </div>

          <div className="deploy-step-grid">
            {deploySteps.map((step, index) => {
              const complete = activeStep > index;
              const active = activeStep === index;

              return (
                <div className={complete ? "complete" : active ? "active" : ""} key={step}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                  <strong>{step}</strong>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
