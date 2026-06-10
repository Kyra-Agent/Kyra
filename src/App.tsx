import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ShieldCheck, Terminal } from "lucide-react";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { ActionConsole } from "./components/ActionConsole";
import { CoreModules } from "./components/CoreModules";
import { DashboardPreview } from "./components/DashboardPreview";
import { DeployPanel } from "./components/DeployPanel";
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
  loadStoredAuthSession,
  type KyraAuthSession,
  type KyraAuthStatus,
} from "./services/supabaseAuthService";
import { fetchSupabaseDashboardData } from "./services/supabaseDashboardService";
import {
  fetchSupabaseTemplates,
  type SupabaseConnectionStatus,
} from "./services/supabaseKyraRepository";
import type { DataProvider } from "./types/api";

const fallbackAgentTemplates = kyraDataService.listTemplates();
const demoScenarios = kyraDataService.listScenarios();
const homeSectionIds = ["templates", "deploy", "actions", "security", "faq"] as const;

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
    : fallbackAgentTemplates.find((template) => agentSlug.startsWith(`${template.id}-`))?.id;

  if (templateId && fallbackAgentTemplates.some((template) => template.id === templateId)) {
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

    return window.localStorage.getItem("kyra-theme") === "light" ? "light" : "dark";
  });
  const [selectedId, setSelectedId] = useState(getInitialTemplateId);
  const [agentSlug, setAgentSlug] = useState(getInitialAgentSlug);
  const [agentTemplates, setAgentTemplates] = useState(fallbackAgentTemplates);
  const [templateCatalogSource, setTemplateCatalogSource] = useState<DataProvider>("mock");
  const [templateCatalogStatus, setTemplateCatalogStatus] = useState<SupabaseConnectionStatus>(
    appConfig.supabase.configured ? "checking" : "not-configured",
  );
  const [templateCatalogError, setTemplateCatalogError] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<KyraAuthSession | null>(() => loadStoredAuthSession());
  const hasInitialAuthSession = Boolean(authSession);
  const [authStatus, setAuthStatus] = useState<KyraAuthStatus>(() =>
    hasInitialAuthSession ? "signed-in" : appConfig.supabase.configured ? "signed-out" : "not-configured",
  );
  const [authMessage, setAuthMessage] = useState(() =>
    hasInitialAuthSession
      ? "Stored account session loaded."
      : appConfig.supabase.configured
        ? "Sign in to load account-scoped demo records."
        : "Account session is not configured.",
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState("swap");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalApproved, setApprovalApproved] = useState(false);
  const [approvalClosing, setApprovalClosing] = useState(false);
  const [approvalDismissed, setApprovalDismissed] = useState(false);
  const [homeSectionId, setHomeSectionId] = useState<HomeSectionId | null>(() => {
    if (typeof window === "undefined") {
      return null;
    }

    return getHomeSectionIdFromPath(window.location.pathname);
  });
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
      demoScenarios.find((scenario) => scenario.id === selectedScenarioId) ?? demoScenarios[0],
    [selectedScenarioId],
  );

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("kyra-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (appConfig.dataProvider !== "supabase" || !appConfig.supabase.configured) {
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
            : result.templates[0].id,
        );
        return;
      }

      setAgentTemplates(fallbackAgentTemplates);
      setTemplateCatalogSource("mock");
      setTemplateCatalogStatus(result.status === "not-configured" ? "not-configured" : "error");
      setTemplateCatalogError(result.error ?? "Connected catalog returned no templates.");
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

      const sessionToValidate = callbackResult?.session ?? loadStoredAuthSession();

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
      document.getElementById(homeSectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
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
    const path =
      nextRoute === "dashboard"
        ? "/dashboard"
        : nextRoute === "agent"
          ? `/agents/${targetSlug ?? `${nextTemplateId}-demo`}`
          : "/";
    window.history.pushState({}, "", path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openAccountSession() {
    setHomeSectionId(null);
    setRoute("dashboard");
    window.history.pushState({}, "", "/dashboard/auth");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openHomeSection(sectionId: string) {
    if (!isHomeSectionId(sectionId)) {
      return;
    }

    setRoute("home");
    setHomeSectionId(sectionId);
    window.history.pushState({}, "", `/${sectionId}`);
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
    setApprovalClosing(false);
    setApprovalDismissed(false);
  }

  function requestApproval() {
    if (!selectedScenario.approvalRequired || approvalApproved || approvalDismissed) {
      return;
    }

    setApprovalOpen(true);
  }

  function approveDemoAction() {
    setApprovalApproved(true);
    window.setTimeout(() => setApprovalClosing(true), 650);
    window.setTimeout(() => {
      setApprovalOpen(false);
      setApprovalClosing(false);
    }, 1050);
  }

  function closeApprovalModal() {
    setApprovalDismissed(true);
    setApprovalClosing(true);
    window.setTimeout(() => {
      setApprovalOpen(false);
      setApprovalApproved(false);
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
      <div className="demo-disclaimer" role="note" aria-label="Kyra demo disclaimer">
        <span>
          <ShieldCheck size={15} />
          BACKEND-CONNECTED DEMO
        </span>
        <p>
          No real transactions, wallet keys, or Telegram bot tokens. Demo records can persist
          after sign-in, while onchain execution stays simulated.
        </p>
      </div>

      {route === "dashboard" ? (
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
      ) : route === "agent" ? (
        <PublicAgent
          selectedTemplate={selectedTemplate}
          agentSlug={agentSlug}
          onBackDashboard={() => navigate("dashboard")}
          onBackHome={() => navigate("home")}
        />
      ) : (
        <>
          <main>
            <section className="hero-section">
              <div className="hero-copy">
                <span className="demo-badge hero-badge">
                  <Terminal size={15} />
                  Backend-connected demo
                </span>
                <h1>Deploy Base agents with approval-first onchain workflows.</h1>
                <p className="hero-subtitle">
                  Launch Telegram-native AI agents that read wallet context, prepare Base
                  actions, and keep every transaction behind wallet approval.
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
                  <span>Wallet approval required</span>
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
        closing={approvalClosing}
        onApprove={approveDemoAction}
        onClose={closeApprovalModal}
      />
    </div>
  );
}

export default App;
