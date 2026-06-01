import { useEffect, useMemo, useState } from "react";
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
import { demoAgentLimits } from "../config/demoLimits";
import type { AgentTemplate } from "../types/agent";
import { kyraDataService } from "../services/kyraDataService";
import {
  fetchSupabaseDemoAgentQuota,
  saveSupabaseDemoDeployment,
  type DemoAgentQuota,
  type DeployPersistenceResult,
  type DeployPersistenceStatus,
} from "../services/supabaseDeployService";
import {
  ensureFreshAuthSession,
  type KyraAuthSession,
  type KyraAuthStatus,
} from "../services/supabaseAuthService";

interface DeployPanelProps {
  templates: AgentTemplate[];
  selectedTemplate: AgentTemplate;
  authSession: KyraAuthSession | null;
  onSelectTemplate: (templateId: string) => void;
  onOpenAgent: (target?: { templateId?: string; publicPath?: string }) => void;
  onAuthSessionChange: (
    session: KyraAuthSession | null,
    status: KyraAuthStatus,
    message: string,
  ) => void;
}

const deployLogs = [
  "compile agent profile",
  "prepare demo backend records",
  "load Kyra core modules",
  "link Telegram interface",
  "sync Base MCP endpoint",
  "enable wallet approval gate",
  "publish demo dashboard",
  "persist backend records",
];

const wizardSteps = [
  {
    id: "template",
    title: "Template",
    summary: "Choose the agent type.",
  },
  {
    id: "configure",
    title: "Configure",
    summary: "Set identity and actions.",
  },
  {
    id: "telegram",
    title: "Telegram",
    summary: "Link the chat surface.",
  },
  {
    id: "wallet",
    title: "Wallet",
    summary: "Require approval policy.",
  },
  {
    id: "deploy",
    title: "Deploy",
    summary: "Publish demo instance.",
  },
];

export function DeployPanel({
  templates,
  selectedTemplate,
  authSession,
  onSelectTemplate,
  onOpenAgent,
  onAuthSessionChange,
}: DeployPanelProps) {
  const [agentName, setAgentName] = useState("Kyra Operator");
  const [deploying, setDeploying] = useState(false);
  const [activeLogStep, setActiveLogStep] = useState(0);
  const [wizardStep, setWizardStep] = useState(0);
  const [templateMenuOpen, setTemplateMenuOpen] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [persistStatus, setPersistStatus] = useState<DeployPersistenceStatus>("skipped");
  const [persistMessage, setPersistMessage] = useState(
    "Sign in from the dashboard to persist deployments.",
  );
  const [persistedRecord, setPersistedRecord] = useState<DeployPersistenceResult | null>(null);
  const [agentQuota, setAgentQuota] = useState<DemoAgentQuota>({
    used: 0,
    limit: demoAgentLimits.maxAgentsPerWorkspace,
    remaining: demoAgentLimits.maxAgentsPerWorkspace,
    reached: false,
    source: "local",
    message: `${demoAgentLimits.maxAgentsPerWorkspace} demo agent slots available.`,
  });
  const [quotaLoading, setQuotaLoading] = useState(false);

  const backendTables = useMemo(() => kyraDataService.listBackendTables(), []);
  const agentRecord = useMemo(
    () => kyraDataService.getAgentInstance(selectedTemplate.id),
    [selectedTemplate.id],
  );

  const selectedActions = useMemo(
    () => selectedTemplate.actions.slice(0, 5),
    [selectedTemplate.actions],
  );
  const backendTableNames = useMemo(
    () => backendTables.map((table) => table.name).join(","),
    [backendTables],
  );

  const terminalLines = useMemo(
    () => [
      `kyra deploy --template ${selectedTemplate.id} --agent "${agentName || "Unnamed Agent"}"`,
      `agent.instance=${agentRecord.id}`,
      `agent.public_route=${agentRecord.publicPath}`,
      `profile.template=${selectedTemplate.name}`,
      "profile.mode=demo",
      `db.prepare=${backendTableNames}`,
      `modules.load=${selectedTemplate.modules.join(",")}`,
      `actions.enable=${selectedActions.join(",")}`,
      "telegram.webhook=simulated",
      "base_mcp.endpoint=https://mcp.base.org/",
      "wallet.policy=approval_required",
      `agent.quota=${authSession ? `${agentQuota.used}/${agentQuota.limit}` : `0/${agentQuota.limit}`}`,
      `quota.guard=max_${agentQuota.limit}_demo_agents`,
      `supabase.session=${authSession ? "active" : "missing"}`,
      `deploy.api=${authSession ? "edge_function_preferred" : "mock_only"}`,
      `db.write=${authSession ? "edge_or_rls_fallback" : "mock_only"}`,
      "security.no_private_keys=true",
      "demo.transactions=disabled",
    ],
    [
      agentName,
      agentQuota.limit,
      agentQuota.used,
      agentRecord,
      authSession,
      backendTableNames,
      selectedActions,
      selectedTemplate,
    ],
  );

  const activeLogCount = deploying
    ? Math.max(2, Math.min(terminalLines.length, activeLogStep + 4))
    : terminalLines.length;

  const progress = Math.round((Math.min(activeLogStep, deployLogs.length) / deployLogs.length) * 100);
  const atFirstStep = wizardStep === 0;
  const atDeployStep = wizardStep === wizardSteps.length - 1;
  const quotaBlocksDeploy = Boolean(authSession && agentQuota.reached);
  const activePublicPath = persistedRecord?.publicSlug
    ? `/agents/${persistedRecord.publicSlug}`
    : agentRecord.publicPath;
  const activeTelegramHandle = persistedRecord?.telegramHandle ?? agentRecord.handle;
  const receiptSourceLabel =
    persistedRecord?.source === "edge-function"
      ? "edge"
      : persistedRecord?.source === "supabase-rest"
        ? "supabase"
        : persistStatus === "error"
          ? "guard"
          : "demo";

  function syncFreshAuthSession(
    currentSession: KyraAuthSession,
    result: Awaited<ReturnType<typeof ensureFreshAuthSession>>,
  ) {
    if (!result.session) {
      onAuthSessionChange(null, result.status, result.message);
      return;
    }

    if (
      result.session.accessToken !== currentSession.accessToken ||
      result.session.expiresAt !== currentSession.expiresAt
    ) {
      onAuthSessionChange(result.session, result.status, result.message);
    }
  }

  useEffect(() => {
    let active = true;

    async function loadQuota() {
      setQuotaLoading(Boolean(authSession));

      try {
        if (!authSession) {
          const quota = await fetchSupabaseDemoAgentQuota(null);

          if (!active) {
            return;
          }

          setAgentQuota(quota);
          return;
        }

        const freshAuth = await ensureFreshAuthSession(authSession);

        if (!active) {
          return;
        }

        syncFreshAuthSession(authSession, freshAuth);

        if (!freshAuth.session) {
          setAgentQuota({
            used: 0,
            limit: demoAgentLimits.maxAgentsPerWorkspace,
            remaining: demoAgentLimits.maxAgentsPerWorkspace,
            reached: false,
            source: "local",
            message: "Session refresh failed. Sign in again to read demo quota.",
          });
          return;
        }

        const quota = await fetchSupabaseDemoAgentQuota(freshAuth.session);

        if (!active) {
          return;
        }

        setAgentQuota(quota);
      } catch {
        if (!active) {
          return;
        }

        setAgentQuota({
          used: 0,
          limit: demoAgentLimits.maxAgentsPerWorkspace,
          remaining: demoAgentLimits.maxAgentsPerWorkspace,
          reached: false,
          source: "local",
          message: "Quota check unavailable. Supabase deploy guard will still validate.",
        });
      } finally {
        if (active) {
          setQuotaLoading(false);
        }
      }
    }

    void loadQuota();

    return () => {
      active = false;
    };
  }, [authSession, deployed]);

  function runDeploySimulation() {
    setDeploying(true);
    setDeployed(false);
    setActiveLogStep(0);
    setPersistStatus("skipped");
    setPersistMessage(authSession ? "Preparing Supabase persistence." : "Demo will run locally until you sign in.");
    setPersistedRecord(null);

    deployLogs.forEach((_, index) => {
      window.setTimeout(() => {
        setActiveLogStep(index + 1);
        if (index === deployLogs.length - 1) {
          window.setTimeout(async () => {
            let deploySession = authSession;

            if (authSession) {
              setPersistMessage("Checking Supabase session before deploy...");

              const freshAuth = await ensureFreshAuthSession(authSession);

              syncFreshAuthSession(authSession, freshAuth);

              if (!freshAuth.session) {
                const blockedResult: DeployPersistenceResult = {
                  status: "error",
                  message: freshAuth.message,
                  workspaceId: null,
                  agentId: null,
                  publicSlug: null,
                  telegramHandle: null,
                  source: "local",
                };

                setPersistStatus(blockedResult.status);
                setPersistMessage(blockedResult.message);
                setPersistedRecord(blockedResult);
                setDeploying(false);
                setDeployed(true);
                return;
              }

              deploySession = freshAuth.session;
            }

            const result = await saveSupabaseDemoDeployment({
              session: deploySession,
              template: selectedTemplate,
              agentName,
              selectedActions,
            });
            setPersistStatus(result.status);
            setPersistMessage(result.message);
            setPersistedRecord(result);
            setDeploying(false);
            setDeployed(true);
          }, 700);
        }
      }, 420 * (index + 1));
    });
  }

  function goNext() {
    setTemplateMenuOpen(false);

    if (atDeployStep) {
      if (quotaBlocksDeploy) {
        const message = `${agentQuota.message} Max ${agentQuota.limit} agents per demo workspace.`;

        setDeployed(true);
        setPersistStatus("error");
        setPersistMessage(message);
        setPersistedRecord({
          status: "error",
          message,
          workspaceId: null,
          agentId: null,
          publicSlug: null,
          telegramHandle: null,
          source: "local",
        });
        return;
      }

      runDeploySimulation();
      return;
    }

    setWizardStep((step) => Math.min(step + 1, wizardSteps.length - 1));
  }

  function copyDemoLink() {
    const origin = typeof window === "undefined" ? "https://kyra-agent.demo" : window.location.origin;
    const demoLink = `${origin}${activePublicPath}`;

    if (navigator.clipboard) {
      void navigator.clipboard.writeText(demoLink);
    }

    setCopiedLink(true);
    window.setTimeout(() => setCopiedLink(false), 1500);
  }

  return (
    <section className="section deploy-section" id="deploy">
      <div className="section-heading">
        <p className="eyebrow">Deploy Flow</p>
        <h2>Deploy flow, demo-safe by design.</h2>
        <p>
          Choose a template, configure the agent, link Telegram, set the wallet approval
          policy, and publish a simulated instance with dashboard and public preview.
        </p>
      </div>

      <div className="deploy-layout">
        <div className={`config-panel wizard-panel ${templateMenuOpen ? "is-menu-open" : ""}`}>
          <div className="panel-title">
            <span>deploy.wizard</span>
            <span className="demo-badge compact">Simulated</span>
          </div>

          <div className="wizard-stepper" aria-label="Deploy wizard steps">
            {wizardSteps.map((step, index) => (
              <button
                className={index === wizardStep ? "is-active" : index < wizardStep ? "is-complete" : ""}
                key={step.id}
                type="button"
                onClick={() => {
                  setTemplateMenuOpen(false);
                  setWizardStep(index);
                }}
              >
                <span>{index + 1}</span>
                <strong>{step.title}</strong>
              </button>
            ))}
          </div>

          <div className="wizard-body">
            {wizardStep === 0 ? (
              <div className="wizard-screen">
                <span className="wizard-kicker">Step 01</span>
                <h3>Choose template</h3>
                <p>Start from a clear use case. Kyra modules run behind the selected template.</p>

                <div className="field template-menu-field">
                  <span>Agent template</span>
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
              </div>
            ) : null}

            {wizardStep === 1 ? (
              <div className="wizard-screen">
                <span className="wizard-kicker">Step 02</span>
                <h3>Configure agent</h3>
                <p>Set the visible identity and confirm which demo actions are enabled.</p>

                <label className="field">
                  <span>Agent name</span>
                  <input
                    value={agentName}
                    onChange={(event) => setAgentName(event.target.value)}
                    placeholder="Kyra Operator"
                  />
                </label>

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
              </div>
            ) : null}

            {wizardStep === 2 ? (
              <div className="wizard-screen">
                <span className="wizard-kicker">Step 03</span>
                <h3>Connect Telegram</h3>
                <p>No real BotFather token is required while the product is in backend-connected demo mode.</p>

                <label className="field">
                  <span>Telegram bot token</span>
                  <input readOnly value="demo mode - no real token required" />
                </label>

                <div className="connection-grid single-row">
                  <span>
                    <Bot size={16} />
                    Telegram interface
                    <strong>ready</strong>
                  </span>
                </div>
              </div>
            ) : null}

            {wizardStep === 3 ? (
              <div className="wizard-screen">
                <span className="wizard-kicker">Step 04</span>
                <h3>Wallet approval policy</h3>
                <p>Kyra prepares actions. The wallet remains the final approval gate.</p>

                <div className="connection-grid">
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
                  <span>
                    <CheckCircle2 size={16} />
                    Transactions
                    <strong>disabled</strong>
                  </span>
                </div>
              </div>
            ) : null}

            {wizardStep === 4 ? (
              <div className="wizard-screen">
                <span className="wizard-kicker">Step 05</span>
                <h3>Publish demo agent</h3>
                <p>Compile the profile and publish a demo instance with a dashboard and public agent preview.</p>

                <div className="wizard-review-grid">
                  <span>
                    Template
                    <strong>{selectedTemplate.name}</strong>
                  </span>
                  <span>
                    Agent
                    <strong>{agentName || "Unnamed Agent"}</strong>
                  </span>
                  <span>
                    Platform
                    <strong>Telegram demo</strong>
                  </span>
                  <span>
                    Wallet
                    <strong>approval required</strong>
                  </span>
                  <span>
                    Records
                    <strong>{authSession ? "Edge Function preferred" : `${backendTables.length} mock tables`}</strong>
                  </span>
                  <span>
                    Agent limit
                    <strong>{quotaLoading ? "checking" : `${agentQuota.used}/${agentQuota.limit}`}</strong>
                  </span>
                  <span>
                    Public route
                    <strong>{activePublicPath}</strong>
                  </span>
                </div>
                <div
                  className={`deploy-persist-note persist-${
                    quotaBlocksDeploy ? "error" : authSession ? "ready" : "standby"
                  }`}
                >
                  <ShieldCheck size={15} />
                  {quotaBlocksDeploy
                    ? `${agentQuota.message} Max ${agentQuota.limit} agents per demo workspace.`
                    : authSession
                    ? "Session active. Kyra will try deploy-agent first, then use the safe RLS fallback if needed."
                    : "No active session. This demo deploy will stay local until auth is connected."}
                </div>
              </div>
            ) : null}
          </div>

          <div className="wizard-controls">
            <button
              className="button button-ghost"
              type="button"
              disabled={atFirstStep || deploying}
              onClick={() => {
                setTemplateMenuOpen(false);
                setWizardStep((step) => Math.max(step - 1, 0));
              }}
            >
              Back
            </button>
            <button
              className="button button-primary"
              type="button"
              disabled={deploying || (atDeployStep && quotaBlocksDeploy)}
              onClick={goNext}
            >
              {atDeployStep ? (
                <>
                  <Play size={17} />
                  {deploying
                    ? "Deploying demo..."
                    : quotaBlocksDeploy
                      ? "Limit reached"
                      : "Deploy demo agent"}
                </>
              ) : (
                "Continue"
              )}
            </button>
          </div>

          {deployed ? (
            <div className="deploy-receipt">
              <div className="receipt-top">
                <span>
                  {persistStatus === "error" ? <ShieldCheck size={16} /> : <CheckCircle2 size={16} />}
                  {persistStatus === "error" ? "Deploy blocked" : "Agent deployed"}
                </span>
                <strong>{receiptSourceLabel}</strong>
              </div>
              <div className={`deploy-persist-note persist-${persistStatus}`}>
                <ShieldCheck size={15} />
                {persistMessage}
              </div>
              {persistStatus !== "error" ? (
                <>
                  <div className="receipt-grid">
                    <span>
                      Telegram
                      <strong>{activeTelegramHandle}</strong>
                    </span>
                    <span>
                      Console
                      <strong>kyra.app{activePublicPath}</strong>
                    </span>
                    <span>
                      Template
                      <strong>{selectedTemplate.name}</strong>
                    </span>
                    <span>
                      Wallet
                      <strong>approval required</strong>
                    </span>
                    <span>
                      Record
                      <strong>{persistedRecord?.agentId ?? agentRecord.id}</strong>
                    </span>
                    <span>
                      Workspace
                      <strong>{persistedRecord?.workspaceId ?? "local demo"}</strong>
                    </span>
                  </div>
                  <div className="receipt-actions">
                    <button type="button" onClick={copyDemoLink}>
                      <Copy size={14} />
                      {copiedLink ? "Copied" : "Copy demo link"}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        onOpenAgent({
                          templateId: selectedTemplate.id,
                          publicPath: activePublicPath,
                        })
                      }
                    >
                      <ExternalLink size={14} />
                      Open public agent
                    </button>
                  </div>
                </>
              ) : null}
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
            {deployLogs.map((step, index) => {
              const complete = activeLogStep > index;
              const active = activeLogStep === index;

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
