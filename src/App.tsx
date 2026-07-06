import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ShieldCheck, Terminal } from "lucide-react";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { ActionConsole } from "./components/ActionConsole";
import { CoreModules } from "./components/CoreModules";
import { DashboardPreview } from "./components/DashboardPreview";
import { DeployPanel, type DeployWizardStepId } from "./components/DeployPanel";
import { FAQSection } from "./components/FAQSection";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { HeroConsole } from "./components/HeroConsole";
import { SecuritySection } from "./components/SecuritySection";
import { TemplatePicker } from "./components/TemplatePicker";
import { WalletApprovalModal } from "./components/WalletApprovalModal";
import { appConfig } from "./config/appConfig";
import { Dashboard } from "./pages/Dashboard";
import { PublicAgent } from "./pages/PublicAgent";
import { kyraDataService } from "./services/kyraDataService";
import {
  consumeAuthCallbackSession,
  ensureFreshAuthSession,
  getCurrentAuthUser,
  type KyraAuthSession,
  type KyraAuthStatus,
  loadStoredAuthSession,
} from "./services/supabaseAuthService";
import { fetchSupabaseDashboardData } from "./services/supabaseDashboardService";
import {
  fetchSupabaseTemplates,
  type SupabaseConnectionStatus,
} from "./services/supabaseKyraRepository";
import type { DataProvider } from "./types/api";
import {
  baseChainId,
  validateUnsignedTransactionHandoff,
  type WalletUnsignedTransactionHandoff,
  walletUnsignedTransactionHandoffVersion,
} from "./types/unsignedTransactionHandoff";
import { reviewUnsignedTransactionHandoff } from "./types/riskReview";
import {
  transitionWalletSigningState,
  type WalletSigningState,
} from "./types/walletSigning";

const fallbackAgentTemplates = kyraDataService.listTemplates();
const demoScenarios = kyraDataService.listScenarios();
const homeSectionIds = [
  "templates",
  "deploy",
  "actions",
  "security",
  "faq",
] as const;

type HomeSectionId = (typeof homeSectionIds)[number];

function isHomeSectionId(sectionId: string): sectionId is HomeSectionId {
  return homeSectionIds.includes(sectionId as HomeSectionId);
}

function getHomeSectionIdFromPath(pathname: string) {
  const sectionId = pathname.replace(/^\/|\/$/g, "");

  return isHomeSectionId(sectionId) ? sectionId : null;
}

function getAgentSlugFromPath(pathname: string) {
  return pathname.match(/^\/agents\/([^/]+)$/)?.[1] ?? null;
}

function getTemplateIdFromAgentSlug(agentSlug: string | null) {
  if (!agentSlug) {
    return "operator";
  }

  const templateId = agentSlug.endsWith("-demo")
    ? agentSlug.replace(/-demo$/, "")
    : fallbackAgentTemplates.find((template) =>
      agentSlug.startsWith(`${template.id}-`)
    )?.id;

  if (
    templateId &&
    fallbackAgentTemplates.some((template) => template.id === templateId)
  ) {
    return templateId;
  }

  return "operator";
}

function getInitialTemplateId() {
  if (typeof window === "undefined") {
    return "operator";
  }

  return window.location.pathname.startsWith("/agents/")
    ? getTemplateIdFromAgentSlug(getAgentSlugFromPath(window.location.pathname))
    : "operator";
}

function getInitialAgentSlug() {
  if (typeof window === "undefined") {
    return "operator-demo";
  }

  return getAgentSlugFromPath(window.location.pathname) ?? "operator-demo";
}

function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    return window.localStorage.getItem("kyra-theme") === "light"
      ? "light"
      : "dark";
  });
  const [selectedId, setSelectedId] = useState(getInitialTemplateId);
  const [agentSlug, setAgentSlug] = useState(getInitialAgentSlug);
  const [agentTemplates, setAgentTemplates] = useState(fallbackAgentTemplates);
  const [templateCatalogSource, setTemplateCatalogSource] = useState<
    DataProvider
  >("mock");
  const [templateCatalogStatus, setTemplateCatalogStatus] = useState<
    SupabaseConnectionStatus
  >(
    appConfig.supabase.configured ? "checking" : "not-configured",
  );
  const [templateCatalogError, setTemplateCatalogError] = useState<
    string | null
  >(null);
  const [authSession, setAuthSession] = useState<KyraAuthSession | null>(() =>
    loadStoredAuthSession()
  );
  const hasInitialAuthSession = Boolean(authSession);
  const [authStatus, setAuthStatus] = useState<KyraAuthStatus>(() =>
    hasInitialAuthSession
      ? "signed-in"
      : appConfig.supabase.configured
      ? "signed-out"
      : "not-configured"
  );
  const [authMessage, setAuthMessage] = useState(() =>
    hasInitialAuthSession
      ? "Stored account session loaded."
      : appConfig.supabase.configured
      ? "Sign in to load account-scoped agent records."
      : "Account session is not configured."
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState("swap");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalApproved, setApprovalApproved] = useState(false);
  const [approvalRejected, setApprovalRejected] = useState(false);
  const [approvalClosing, setApprovalClosing] = useState(false);
  const [approvalDismissed, setApprovalDismissed] = useState(false);
  const [walletSigningState, setWalletSigningState] = useState<
    WalletSigningState
  >("not_ready");
  const [homeSectionId, setHomeSectionId] = useState<HomeSectionId | null>(
    () => {
      if (typeof window === "undefined") {
        return null;
      }

      return getHomeSectionIdFromPath(window.location.pathname);
    },
  );
  const [deployInitialStepId, setDeployInitialStepId] = useState<
    DeployWizardStepId
  >("account");
  const [route, setRoute] = useState<"home" | "dashboard" | "agent">(() => {
    if (typeof window === "undefined") {
      return "home";
    }

    if (
      window.location.pathname === "/dashboard" ||
      window.location.pathname.startsWith("/dashboard/")
    ) {
      return "dashboard";
    }

    if (window.location.pathname.startsWith("/agents/")) {
      return "agent";
    }

    return "home";
  });

  const selectedTemplate = useMemo(
    () =>
      agentTemplates.find((template) => template.id === selectedId) ??
        agentTemplates[0] ??
        fallbackAgentTemplates[0],
    [agentTemplates, selectedId],
  );

  const selectedScenario = useMemo(
    () =>
      demoScenarios.find((scenario) => scenario.id === selectedScenarioId) ??
        demoScenarios[0],
    [selectedScenarioId],
  );

  const walletUnsignedHandoff = useMemo(
    () => createDemoUnsignedHandoff(selectedScenario),
    [selectedScenario],
  );

  const walletUnsignedHandoffValidation = useMemo(
    () => validateUnsignedTransactionHandoff(walletUnsignedHandoff),
    [walletUnsignedHandoff],
  );
  const riskReview = useMemo(
    () =>
      reviewUnsignedTransactionHandoff(
        walletUnsignedHandoff,
        walletUnsignedHandoffValidation,
      ),
    [walletUnsignedHandoff, walletUnsignedHandoffValidation],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("kyra-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (
      appConfig.dataProvider !== "supabase" || !appConfig.supabase.configured
    ) {
      setTemplateCatalogStatus("not-configured");
      return;
    }

    let active = true;

    async function loadTemplateCatalog() {
      setTemplateCatalogStatus("checking");

      const result = await fetchSupabaseTemplates();

      if (!active) {
        return;
      }

      if (result.ok && result.templates.length > 0) {
        setAgentTemplates(result.templates);
        setTemplateCatalogSource("supabase");
        setTemplateCatalogStatus("connected");
        setTemplateCatalogError(null);
        setSelectedId((currentId) =>
          result.templates.some((template) => template.id === currentId)
            ? currentId
            : result.templates[0].id
        );
        return;
      }

      setAgentTemplates(fallbackAgentTemplates);
      setTemplateCatalogSource("mock");
      setTemplateCatalogStatus(
        result.status === "not-configured" ? "not-configured" : "error",
      );
      setTemplateCatalogError(
        result.error ?? "Connected catalog returned no templates.",
      );
    }

    void loadTemplateCatalog();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;

    async function validateStoredSession() {
      const callbackResult = await consumeAuthCallbackSession();

      if (!active) {
        return;
      }

      const sessionToValidate = callbackResult?.session ??
        loadStoredAuthSession();

      if (!sessionToValidate) {
        if (callbackResult) {
          setAuthSession(null);
          setAuthStatus(callbackResult.status);
          setAuthMessage(callbackResult.message);
        }

        return;
      }

      const freshResult = await ensureFreshAuthSession(sessionToValidate);

      if (!active) {
        return;
      }

      if (!freshResult.session) {
        setAuthSession(null);
        setAuthStatus(freshResult.status);
        setAuthMessage(freshResult.message);
        return;
      }

      const result = await getCurrentAuthUser(freshResult.session);

      if (!active) {
        return;
      }

      setAuthSession(result.session);
      setAuthStatus(result.status);
      setAuthMessage(result.message);
    }

    void validateStoredSession();

    return () => {
      active = false;
    };
  }, []);

  function updateAuthSession(
    session: KyraAuthSession | null,
    status: KyraAuthStatus,
    message: string,
  ) {
    setAuthSession(session);
    setAuthStatus(status);
    setAuthMessage(message);
  }

  function toggleTheme() {
    setTheme((value) => (value === "dark" ? "light" : "dark"));
  }

  async function openAgentFromHeader() {
    if (!authSession) {
      navigate("agent");
      return;
    }

    const freshAuth = await ensureFreshAuthSession(authSession);

    if (!freshAuth.session) {
      updateAuthSession(null, freshAuth.status, freshAuth.message);
      navigate("agent");
      return;
    }

    if (
      freshAuth.session.accessToken !== authSession.accessToken ||
      freshAuth.session.expiresAt !== authSession.expiresAt
    ) {
      updateAuthSession(freshAuth.session, freshAuth.status, freshAuth.message);
    }

    const result = await fetchSupabaseDashboardData(freshAuth.session);
    const latestAgent = result.data?.latestAgent;

    navigate(
      "agent",
      latestAgent
        ? {
          templateId: latestAgent.templateId,
          publicPath: latestAgent.publicPath,
        }
        : undefined,
    );
  }

  useEffect(() => {
    if (route !== "home") {
      return;
    }

    if (!homeSectionId) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    window.setTimeout(() => {
      document.getElementById(homeSectionId)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 40);
  }, [homeSectionId, route]);

  useEffect(() => {
    function syncRouteFromLocation() {
      if (
        window.location.pathname === "/dashboard" ||
        window.location.pathname.startsWith("/dashboard/")
      ) {
        setHomeSectionId(null);
        setRoute("dashboard");
        return;
      }

      if (window.location.pathname.startsWith("/agents/")) {
        const nextAgentSlug = getAgentSlugFromPath(window.location.pathname);
        setHomeSectionId(null);
        setAgentSlug(nextAgentSlug ?? "operator-demo");
        setSelectedId(getTemplateIdFromAgentSlug(nextAgentSlug));
        setRoute("agent");
        return;
      }

      setHomeSectionId(getHomeSectionIdFromPath(window.location.pathname));
      setRoute("home");
    }

    window.addEventListener("popstate", syncRouteFromLocation);
    return () => window.removeEventListener("popstate", syncRouteFromLocation);
  }, []);

  function pushAppPath(path: string) {
    window.history.pushState({}, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  function navigate(
    nextRoute: "home" | "dashboard" | "agent",
    target?: { templateId?: string; publicPath?: string },
  ) {
    const targetSlug = target?.publicPath?.replace(/^\/agents\//, "");
    const nextTemplateId = target?.templateId ?? selectedTemplate.id;

    if (nextRoute === "agent") {
      setSelectedId(nextTemplateId);
      setAgentSlug(targetSlug ?? `${nextTemplateId}-demo`);
    }

    setHomeSectionId(null);
    setRoute(nextRoute);
    const path = nextRoute === "dashboard"
      ? "/dashboard"
      : nextRoute === "agent"
      ? `/agents/${targetSlug ?? `${nextTemplateId}-demo`}`
      : "/";
    pushAppPath(path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openAccountSession() {
    setHomeSectionId(null);
    setRoute("dashboard");
    pushAppPath("/dashboard/auth");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openHomeSection(
    sectionId: string,
    options?: { deployStepId?: DeployWizardStepId },
  ) {
    if (!isHomeSectionId(sectionId)) {
      return;
    }

    setDeployInitialStepId(
      sectionId === "deploy" ? options?.deployStepId ?? "account" : "account",
    );
    setRoute("home");
    setHomeSectionId(sectionId);
    pushAppPath(`/${sectionId}`);
  }

  function selectScenario(scenarioId: string) {
    const scenario = demoScenarios.find((item) => item.id === scenarioId);

    if (!scenario) {
      return;
    }

    setSelectedScenarioId(scenario.id);
    setSelectedId(scenario.templateId);
    setApprovalOpen(false);
    setApprovalApproved(false);
    setApprovalRejected(false);
    setApprovalClosing(false);
    setApprovalDismissed(false);
    setWalletSigningState("not_ready");
  }

  function requestApproval() {
    if (
      !selectedScenario.approvalRequired || approvalApproved ||
      approvalDismissed
    ) {
      return;
    }

    const preview = transitionWalletSigningState({
      state: walletSigningState,
      event: "load_preview",
    });
    const review = preview.ok
      ? transitionWalletSigningState({
        state: preview.state,
        event: "require_review",
      })
      : preview;

    if (review.ok) {
      setWalletSigningState(review.state);
    }

    setApprovalOpen(true);
  }

  function approveDemoAction() {
    setApprovalApproved(true);
    setApprovalRejected(false);
    window.setTimeout(() => setApprovalClosing(true), 650);
    window.setTimeout(() => {
      setApprovalOpen(false);
      setApprovalClosing(false);
      setWalletSigningState("not_ready");
    }, 1050);
  }

  function rejectDemoAction() {
    setApprovalDismissed(true);
    setApprovalApproved(false);
    setApprovalRejected(true);
    const rejection = transitionWalletSigningState({
      state: walletSigningState,
      event: "reject",
    });

    if (rejection.ok) {
      setWalletSigningState(rejection.state);
    }

    window.setTimeout(() => setApprovalClosing(true), 650);
    window.setTimeout(() => {
      setApprovalOpen(false);
      setApprovalRejected(false);
      setApprovalClosing(false);
    }, 1050);
  }

  function closeApprovalModal() {
    setApprovalDismissed(true);
    setApprovalClosing(true);
    window.setTimeout(() => {
      setApprovalOpen(false);
      setApprovalApproved(false);
      setApprovalRejected(false);
      setApprovalClosing(false);
    }, 240);
  }

  return (
    <div className="app" id="top">
      <AnimatedBackground />
      <Header
        theme={theme}
        accountSignedIn={Boolean(authSession)}
        onToggleTheme={toggleTheme}
        onOpenDashboard={() => navigate("dashboard")}
        onOpenHome={() => navigate("home")}
        onOpenAgent={() => void openAgentFromHeader()}
        onOpenAccount={openAccountSession}
        onOpenSection={openHomeSection}
      />
      <div
        className="demo-disclaimer"
        role="note"
        aria-label="Kyra product safety boundary"
      >
        <span>
          <ShieldCheck size={15} />
          PRODUCT READY
        </span>
        <p>
          No custody, wallet keys, or Telegram bot tokens. Agents can persist after sign-in, while every onchain action stays behind explicit owner approval.
        </p>
      </div>

      {route === "dashboard"
        ? (
          <Dashboard
            selectedTemplate={selectedTemplate}
            templates={agentTemplates}
            templateCatalogSource={templateCatalogSource}
            templateCatalogStatus={templateCatalogStatus}
            templateCatalogError={templateCatalogError}
            authSession={authSession}
            authStatus={authStatus}
            authMessage={authMessage}
            onAuthSessionChange={updateAuthSession}
            onBackHome={() => navigate("home")}
            onOpenAgent={(target) => navigate("agent", target)}
            onSelectTemplate={setSelectedId}
          />
        )
        : route === "agent"
        ? (
          <PublicAgent
            selectedTemplate={selectedTemplate}
            agentSlug={agentSlug}
            onBackDashboard={() => navigate("dashboard")}
            onBackHome={() => navigate("home")}
          />
        )
        : (
          <>
            <main>
              <section className="hero-section">
                <div className="hero-copy">
                  <span className="demo-badge hero-badge">
                    <Terminal size={15} />
                    Base-native agent platform
                  </span>
                  <h1>
                    Deploy Telegram-native Base agents with approval-first workflows.
                  </h1>
                  <p className="hero-subtitle">
                    Create agent profiles, connect Telegram, prepare Base action reviews, and keep wallet prompts, signing, and onchain execution behind explicit owner approval.
                  </p>

                  <div className="hero-actions">
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => openHomeSection("deploy")}
                    >
                      Deploy Agent
                      <ArrowRight size={17} />
                    </button>
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => navigate("dashboard")}
                    >
                      Open Dashboard
                      <ArrowRight size={17} />
                    </button>
                    <button
                      className="button button-ghost"
                      type="button"
                      onClick={() => openHomeSection("security")}
                    >
                      <ShieldCheck size={17} />
                      View Safety Model
                    </button>
                  </div>

                  <div className="trust-row" aria-label="Kyra trust model">
                    <span>No seed phrases</span>
                    <span>No custody</span>
                    <span>Owner-approved execution</span>
                  </div>
                </div>

                <HeroConsole
                  selectedTemplate={selectedTemplate}
                  scenarios={demoScenarios}
                  selectedScenario={selectedScenario}
                  onSelectScenario={selectScenario}
                  onRequestApproval={requestApproval}
                />
              </section>

              <TemplatePicker
                templates={agentTemplates}
                selectedId={selectedId}
                onSelect={setSelectedId}
                catalogStatus={templateCatalogStatus}
                catalogError={templateCatalogError}
              />
              <DeployPanel
                templates={agentTemplates}
                selectedTemplate={selectedTemplate}
                authSession={authSession}
                initialStepId={deployInitialStepId}
                onOpenAccount={openAccountSession}
                onSelectTemplate={setSelectedId}
                onOpenAgent={(target) => navigate("agent", target)}
                onAuthSessionChange={updateAuthSession}
              />
              <DashboardPreview selectedTemplate={selectedTemplate} />
              <ActionConsole />
              <CoreModules />
              <SecuritySection />
              <FAQSection />
            </main>

            <Footer />
          </>
        )}
      <WalletApprovalModal
        scenario={selectedScenario}
        open={approvalOpen}
        approved={approvalApproved}
        rejected={approvalRejected}
        closing={approvalClosing}
        signingState={walletSigningState}
        unsignedHandoff={walletUnsignedHandoff}
        unsignedHandoffValidation={walletUnsignedHandoffValidation}
        riskReview={riskReview}
        onApprove={approveDemoAction}
        onReject={rejectDemoAction}
        onClose={closeApprovalModal}
      />
    </div>
  );
}

function createDemoUnsignedHandoff(
  scenario: (typeof demoScenarios)[number],
): WalletUnsignedTransactionHandoff {
  const createdAt = new Date();
  const expiresAt = new Date(createdAt.getTime() + 10 * 60 * 1000);

  return {
    version: walletUnsignedTransactionHandoffVersion,
    preparedActionId: `demo-${scenario.id}-handoff`,
    ownerUserId: "demo-owner",
    workspaceId: "demo-workspace",
    agentId: `${scenario.templateId}-demo`,
    actionKind: "base_reviewed_transaction",
    chainId: baseChainId,
    chainName: "Base",
    to: "0x1111111111111111111111111111111111111111",
    valueWei: "0",
    data: "0x",
    gasPayer: "connected_wallet",
    routeSummary: scenario.route,
    valueSummary: scenario.approvalRequired
      ? "Approval review only. No token spend is sent."
      : "Read-only scenario. No transaction handoff required.",
    risk: scenario.risk === "review" ? "medium" : "low",
    createdAt: createdAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  };
}

export default App;
