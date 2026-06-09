import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Copy,
  ExternalLink,
  KeyRound,
  Play,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
} from "lucide-react";
import { appConfig } from "../config/appConfig";
import { demoAgentLimits } from "../config/demoLimits";
import type { AgentTemplate } from "../types/agent";
import { kyraDataService } from "../services/kyraDataService";
import {
  fetchSupabaseDemoAgentQuota,
  saveSupabaseDemoDeployment,
  type DemoAgentQuota,
  type DeployFailureKind,
  type DeployPersistenceResult,
  type DeployPersistenceStatus,
} from "../services/supabaseDeployService";
import {
  ensureFreshAuthSession,
  type KyraAuthSession,
  type KyraAuthStatus,
} from "../services/supabaseAuthService";
import { recordBackendEvent } from "../services/backendObservabilityService";
import {
  connectTelegramBot,
  type TelegramConnectStatus,
} from "../services/telegramConnectService";

interface DeployPanelProps {
  templates: AgentTemplate[];
  selectedTemplate: AgentTemplate;
  authSession: KyraAuthSession | null;
  onOpenAccount: () => void;
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
  "sync simulated Base action route",
  "enable wallet approval gate",
  "publish demo dashboard",
  "persist backend records",
];

const wizardSteps = [
  {
    id: "account",
    title: "Account",
    summary: "Sign in to save.",
  },
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

type TelegramDeployConnectUiStatus = "idle" | "ready" | "running" | "success" | "error";

function getDeployFailureTitle(kind?: DeployFailureKind) {
  switch (kind) {
    case "session":
      return "Account session required";
    case "quota":
      return "Demo agent limit reached";
    case "template":
      return "Template unavailable";
    case "request":
      return "Deploy request incomplete";
    case "configuration":
      return "Backend configuration required";
    case "backend":
      return "Backend unavailable";
    case "unknown":
    default:
      return "Deploy persistence blocked";
  }
}

export function DeployPanel({
  templates,
  selectedTemplate,
  authSession,
  onOpenAccount,
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
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramDeployConnectStatus, setTelegramDeployConnectStatus] =
    useState<TelegramDeployConnectUiStatus>("idle");
  const [telegramDeployConnectMessage, setTelegramDeployConnectMessage] = useState(
    "Optional: connect Telegram during deploy. Token is cleared after submit.",
  );
  const [agentQuota, setAgentQuota] = useState<DemoAgentQuota>({
    used: 0,
    limit: demoAgentLimits.maxAgentsPerWorkspace,
    remaining: demoAgentLimits.maxAgentsPerWorkspace,
    reached: false,
    source: "local",
    message: `${demoAgentLimits.maxAgentsPerWorkspace} demo agent slots available.`,
  });
  const [quotaLoading, setQuotaLoading] = useState(false);
  const deployingRef = useRef(false);

  const backendTables = useMemo(() => kyraDataService.listBackendTables(), []);
  const agentRecord = useMemo(
    () => kyraDataService.getAgentInstance(selectedTemplate.id),
    [selectedTemplate.id],
  );

  const selectedActions = useMemo(
    () => selectedTemplate.actions.slice(0, 5),
    [selectedTemplate.actions],
  );
  const terminalLines = useMemo(
    () => [
      `kyra deploy --template ${selectedTemplate.id} --agent "${agentName || "Unnamed Agent"}"`,
      `agent.instance=${agentRecord.id}`,
      `agent.public_route=${agentRecord.publicPath}`,
      `profile.template=${selectedTemplate.name}`,
      "profile.mode=demo",
      `demo.record_groups=${backendTables.length}`,
      `modules.load=${selectedTemplate.modules.join(",")}`,
      `actions.enable=${selectedActions.join(",")}`,
      "telegram.webhook=simulated",
      "base.actions=simulated",
      "wallet.policy=approval_required",
      `agent.quota=${authSession ? `${agentQuota.used}/${agentQuota.limit}` : `0/${agentQuota.limit}`}`,
      `quota.guard=max_${agentQuota.limit}_demo_agents`,
      `account.session=${authSession ? "active" : "missing"}`,
      `deploy.api=${authSession ? "backend_preferred" : "local_preview"}`,
      `demo.persistence=${authSession ? "active" : "local_preview"}`,
      "security.no_private_keys=true",
      "demo.transactions=disabled",
    ],
    [
      agentName,
      agentQuota.limit,
      agentQuota.used,
      agentRecord,
      authSession,
      backendTables.length,
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
  const atAccountStep = wizardStep === 0;
  const quotaBlocksDeploy = Boolean(authSession && agentQuota.reached);
  const telegramConnectTokenInputEnabled = appConfig.featureFlags.telegramConnectTokenInput;
  const telegramStepTitle = telegramConnectTokenInputEnabled ? "Connect Telegram" : "Prepare Telegram";
  const telegramStepDescription = telegramConnectTokenInputEnabled
    ? "Optionally connect Telegram while deploying this agent. Token handling stays backend-only and the field clears after submit."
    : "Telegram connect belongs in deploy or explicit reconnect after backend token storage is enabled. This step stays status-only until the gate is on.";
  const telegramInterfaceStatus = telegramConnectTokenInputEnabled ? "deploy scoped" : "backend gated";
  const activePublicPath = persistedRecord?.publicSlug
    ? `/agents/${persistedRecord.publicSlug}`
    : agentRecord.publicPath;
  const activeTelegramHandle = persistedRecord?.telegramHandle ?? agentRecord.handle;
  const hasPersistedPublicRoute = Boolean(
    persistedRecord?.publicSlug &&
      (persistedRecord.source === "edge-function" || persistedRecord.source === "supabase-rest") &&
      persistedRecord.status === "saved",
  );
  const receiptPublicRoute = hasPersistedPublicRoute ? activePublicPath : "not created";
  const receiptQuotaLabel = persistedRecord?.quota
    ? `${persistedRecord.quota.used}/${persistedRecord.quota.limit}`
    : authSession
      ? `${agentQuota.used}/${agentQuota.limit}`
      : "local preview";
  const receiptSourceLabel =
    persistedRecord?.source === "edge-function" || persistedRecord?.source === "supabase-rest"
      ? "Backend"
        : persistStatus === "error"
          ? "Guard"
          : "Demo";

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

  function getTelegramDeployConnectTone(status: TelegramConnectStatus): TelegramDeployConnectUiStatus {
    return status === "validated" ||
        status === "review" ||
        status === "queued" ||
        status === "active"
      ? "success"
      : "error";
  }

  function resetTelegramDeployConnectState(message?: string) {
    setTelegramBotToken("");
    setTelegramDeployConnectStatus("idle");
    setTelegramDeployConnectMessage(
      message ?? "Optional: connect Telegram during deploy. Token is cleared after submit.",
    );
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
          message: "Quota check unavailable. The backend deploy guard will still validate.",
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

  useEffect(() => {
    resetTelegramDeployConnectState();
  }, [authSession?.user.id, selectedTemplate.id]);

  function runDeploySimulation() {
    if (deployingRef.current) {
      return;
    }

    const telegramTokenForDeploy = telegramConnectTokenInputEnabled ? telegramBotToken.trim() : "";

    deployingRef.current = true;
    setDeploying(true);
    setDeployed(false);
    setActiveLogStep(0);
    setPersistStatus("skipped");
    setPersistMessage(authSession ? "Preparing demo persistence." : "Demo will run locally until you sign in.");
    setPersistedRecord(null);
    if (telegramTokenForDeploy) {
      setTelegramDeployConnectStatus("ready");
      setTelegramDeployConnectMessage("Telegram connect will run after backend deploy creates the agent.");
    } else {
      setTelegramDeployConnectStatus("idle");
      setTelegramDeployConnectMessage("Telegram can be connected later from the selected agent flow.");
    }

    deployLogs.forEach((_, index) => {
      window.setTimeout(() => {
        setActiveLogStep(index + 1);
        if (index === deployLogs.length - 1) {
          window.setTimeout(async () => {
            let deploySession = authSession;

            try {
              if (authSession) {
                setPersistMessage("Checking account session before deploy...");

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
                  recordBackendEvent({
                    kind: "deploy",
                    status: "blocked",
                    message: blockedResult.message,
                    source: "account session",
                    code: "session_refresh_failed",
                  });
                  if (telegramTokenForDeploy) {
                    setTelegramDeployConnectStatus("error");
                    setTelegramDeployConnectMessage("Telegram connect skipped because account session refresh failed.");
                  }
                  return;
                }

                deploySession = freshAuth.session;
              }

              recordBackendEvent({
                kind: "deploy",
                status: "running",
                message: `Deploy attempt started for ${selectedTemplate.name}.`,
                source: deploySession ? "backend" : "local preview",
              });

              const result = await saveSupabaseDemoDeployment({
                session: deploySession,
                template: selectedTemplate,
                agentName,
                selectedActions,
              });
              setPersistStatus(result.status);
              setPersistMessage(result.message);
              setPersistedRecord(result);
              const deployEventSource =
                result.source === "edge-function" || result.source === "supabase-rest"
                  ? "Backend"
                  : "local preview";
              recordBackendEvent({
                kind: "deploy",
                status: result.status === "saved" ? "success" : result.status === "error" ? "error" : "info",
                message:
                  result.status === "saved"
                    ? `Deploy persisted through ${deployEventSource}.`
                    : result.message,
                source: result.source,
                code: result.code,
              });
              if (telegramTokenForDeploy) {
                if (result.status !== "saved" || !deploySession || !result.agentId) {
                  setTelegramDeployConnectStatus("error");
                  setTelegramDeployConnectMessage("Telegram connect skipped because deploy was not persisted.");
                } else {
                  setTelegramDeployConnectStatus("running");
                  setTelegramDeployConnectMessage("Connecting Telegram for the deployed agent...");

                  const telegramResult = await connectTelegramBot({
                    session: deploySession,
                    agentId: result.agentId,
                    botToken: telegramTokenForDeploy,
                  });

                  setTelegramDeployConnectStatus(getTelegramDeployConnectTone(telegramResult.status));
                  setTelegramDeployConnectMessage(telegramResult.message);
                  recordBackendEvent({
                    kind: "deploy",
                    status: telegramResult.ok ? "success" : "error",
                    message: telegramResult.message,
                    source: "telegram-connect",
                    code: telegramResult.status,
                  });
                }
              }
            } catch {
              const message = "Demo deploy failed unexpectedly. No public route was confirmed.";

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
                code: "deploy_unexpected_error",
                failureKind: "unknown",
              });
              recordBackendEvent({
                kind: "deploy",
                status: "error",
                message,
                source: "deploy flow",
                code: "deploy_unexpected_error",
              });
              if (telegramTokenForDeploy) {
                setTelegramDeployConnectStatus("error");
                setTelegramDeployConnectMessage("Telegram connect skipped because deploy failed before completion.");
              }
            } finally {
              setTelegramBotToken("");
              deployingRef.current = false;
              setDeploying(false);
              setDeployed(true);
            }
          }, 700);
        }
      }, 420 * (index + 1));
    });
  }

  function goNext() {
    if (deployingRef.current) {
      return;
    }

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
          code: "quota_exceeded",
          failureKind: "quota",
          quota: {
            used: agentQuota.used,
            limit: agentQuota.limit,
            remaining: agentQuota.remaining,
          },
        });
        recordBackendEvent({
          kind: "deploy",
          status: "blocked",
          message,
          source: "quota guard",
          code: "quota_exceeded",
        });
        if (telegramBotToken.trim()) {
          setTelegramDeployConnectStatus("error");
          setTelegramDeployConnectMessage("Telegram connect skipped because deploy was blocked by quota.");
          setTelegramBotToken("");
        }
        return;
      }

      runDeploySimulation();
      return;
    }

    setWizardStep((step) => Math.min(step + 1, wizardSteps.length - 1));
  }

  function copyDemoLink() {
    if (!hasPersistedPublicRoute) {
      return;
    }

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

      <div className="deploy-howto" aria-label="How to deploy a Kyra demo agent">
        <article>
          <span>01</span>
          <strong>Create an account</strong>
          <p>Sign in so Kyra can save demo records, quota, and the public agent route.</p>
        </article>
        <article>
          <span>02</span>
          <strong>Choose a template</strong>
          <p>Pick Operator, Steward, Strategist, or another demo profile for the use case.</p>
        </article>
        <article>
          <span>03</span>
          <strong>Configure identity</strong>
          <p>Name the agent and review the enabled demo actions before publishing.</p>
        </article>
        <article>
          <span>04</span>
          <strong>Publish demo route</strong>
          <p>Deploy a backend-persisted profile, then open dashboard or share the public route.</p>
        </article>
      </div>

      <div className="deploy-layout">
        <div className={`config-panel wizard-panel ${templateMenuOpen ? "is-menu-open" : ""}`}>
          <div className="panel-title">
            <span>Demo deploy wizard</span>
            <span className="demo-badge compact">Simulated</span>
          </div>

          <div className="wizard-stepper" aria-label="Deploy wizard steps">
            {wizardSteps.map((step, index) => (
              <button
                className={index === wizardStep ? "is-active" : index < wizardStep ? "is-complete" : ""}
                key={step.id}
                type="button"
                disabled={deploying}
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
                <h3>Create an account or sign in</h3>
                <p>
                  A saved demo agent needs an account session. You can still browse Kyra without
                  signing in, but persisted agents, quota, dashboard records, and public routes are
                  account-scoped.
                </p>

                <div className="deploy-account-card">
                  <span className={`readiness-chip readiness-${authSession ? "ready" : "standby"}`}>
                    {authSession ? <CheckCircle2 size={14} /> : <KeyRound size={14} />}
                    {authSession ? "Account active" : "Sign-in recommended"}
                  </span>
                  <strong>
                    {authSession
                      ? "Kyra can save this deploy to the connected backend."
                      : "Sign in before deploy to create a shareable agent route."}
                  </strong>
                  <p>
                    No wallet access is requested. The account only stores demo workspace records
                    for this backend-connected preview.
                  </p>
                  <button className="button button-ghost" type="button" onClick={onOpenAccount}>
                    <UserRound size={16} />
                    {authSession ? "View account session" : "Open sign-in"}
                  </button>
                </div>
              </div>
            ) : null}

            {wizardStep === 1 ? (
              <div className="wizard-screen">
                <span className="wizard-kicker">Step 02</span>
                <h3>Choose template</h3>
                <p>Start from a clear use case. Kyra modules run behind the selected template.</p>

                <div className="field template-menu-field">
                  <span>Agent template</span>
                  <button
                    className="template-menu-trigger"
                    type="button"
                    disabled={deploying}
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
                            disabled={deploying}
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

            {wizardStep === 2 ? (
              <div className="wizard-screen">
                <span className="wizard-kicker">Step 03</span>
                <h3>Configure agent</h3>
                <p>Set the visible identity and confirm which demo actions are enabled.</p>

                <label className="field">
                  <span>Agent name</span>
                  <input
                    value={agentName}
                    onChange={(event) => setAgentName(event.target.value)}
                    placeholder="Kyra Operator"
                    disabled={deploying}
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

            {wizardStep === 3 ? (
              <div className="wizard-screen">
                <span className="wizard-kicker">Step 04</span>
                <h3>{telegramStepTitle}</h3>
                <p>{telegramStepDescription}</p>

                {telegramConnectTokenInputEnabled ? (
                  <div className="deploy-telegram-token-box">
                    <label className="field">
                      <span>Telegram bot token</span>
                      <input
                        type="password"
                        value={telegramBotToken}
                        onChange={(event) => {
                          setTelegramBotToken(event.target.value);
                          setTelegramDeployConnectStatus(event.target.value.trim() ? "ready" : "idle");
                          setTelegramDeployConnectMessage(
                            event.target.value.trim()
                              ? "Telegram connect will run after this agent deploy is persisted."
                              : "Optional: connect Telegram during deploy. Token is cleared after submit.",
                          );
                        }}
                        placeholder="123456:AA..."
                        autoComplete="new-password"
                        autoCorrect="off"
                        autoCapitalize="none"
                        spellCheck={false}
                        disabled={deploying || !authSession}
                      />
                    </label>
                    <button
                      className="button button-ghost deploy-token-clear"
                      type="button"
                      onClick={() => resetTelegramDeployConnectState()}
                      disabled={deploying || !telegramBotToken}
                      aria-label="Clear Telegram token input"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ) : (
                  <label className="field">
                    <span>Telegram bot token</span>
                    <input readOnly value="connect during deploy - coming next" />
                  </label>
                )}

                <div className="telegram-guide-card">
                  <span className="mini-label-inline">
                    {telegramConnectTokenInputEnabled
                      ? authSession
                        ? "Deploy scoped"
                        : "Sign in required"
                      : "Backend gated"}
                  </span>
                  {telegramConnectTokenInputEnabled ? (
                    <ol>
                      <li>Open Telegram and message @BotFather.</li>
                      <li>Create a bot with /newbot and choose a handle.</li>
                      <li>Paste the token only during deploy or reconnect.</li>
                    </ol>
                  ) : (
                    <ol>
                      <li>Telegram bots are created through @BotFather.</li>
                      <li>Token entry stays hidden until backend storage and webhook gates are enabled.</li>
                      <li>Dashboard and public profiles show selected-agent status only.</li>
                    </ol>
                  )}
                </div>
                <div
                  className={`deploy-persist-note persist-${
                    telegramDeployConnectStatus === "idle" ? "standby" : telegramDeployConnectStatus
                  }`}
                >
                  <ShieldCheck size={15} />
                  {authSession
                    ? telegramDeployConnectMessage
                    : "Sign in before deploy if you want Telegram to connect with this agent."}
                </div>

                <div className="connection-grid single-row">
                  <span>
                    <Bot size={16} />
                    Telegram interface
                    <strong>{telegramInterfaceStatus}</strong>
                  </span>
                </div>
              </div>
            ) : null}

            {wizardStep === 4 ? (
              <div className="wizard-screen">
                <span className="wizard-kicker">Step 05</span>
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

            {wizardStep === 5 ? (
              <div className="wizard-screen">
                <span className="wizard-kicker">Step 06</span>
                <h3>Publish demo agent</h3>
                <p>
                  {authSession
                    ? "Publish a backend-persisted demo profile with dashboard records and a shareable public route."
                    : "Review the demo output. Sign in before deploying if you want backend persistence and a shareable public route."}
                </p>

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
                    Persistence
                    <strong>{authSession ? "Demo persistence active" : "Local preview only"}</strong>
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
                    ? "Account session active. Kyra will persist this demo through the connected backend."
                    : "No active account session. This deploy stays local unless you sign in first."}
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
                atAccountStep && !authSession ? "Continue as preview" : "Continue"
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
                      Public route
                      <strong>{receiptPublicRoute}</strong>
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
                    <span>
                      Agent quota
                      <strong>{receiptQuotaLabel}</strong>
                    </span>
                    <span>
                      Execution
                      <strong>simulated</strong>
                    </span>
                  </div>
                  <p className="receipt-safety-line">
                    Backend persistence stores demo records only. No real transaction or wallet key is used.
                    Telegram tokens are never stored in frontend state after submit.
                  </p>
                  {telegramDeployConnectStatus !== "idle" ? (
                    <div className={`deploy-persist-note persist-${telegramDeployConnectStatus}`}>
                      <ShieldCheck size={15} />
                      {telegramDeployConnectMessage}
                    </div>
                  ) : null}
                  <div className="receipt-actions">
                    <button type="button" onClick={copyDemoLink} disabled={!hasPersistedPublicRoute}>
                      <Copy size={14} />
                      {copiedLink ? "Copied" : hasPersistedPublicRoute ? "Copy demo link" : "No public route"}
                    </button>
                    <button
                      type="button"
                      disabled={!hasPersistedPublicRoute}
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
              ) : (
                <div className="receipt-error-detail">
                  <strong>{getDeployFailureTitle(persistedRecord?.failureKind)}</strong>
                  <small>No demo public route was confirmed, and no live transaction was attempted.</small>
                </div>
              )}
            </div>
          ) : null}
        </div>

        <div className="deployment-terminal">
          <div className="terminal-heading">
            <span>Deploy progress</span>
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
