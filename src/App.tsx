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
  getCurrentAuthUser,
  loadStoredAuthSession,
  type KyraAuthSession,
  type KyraAuthStatus,
} from "./services/supabaseAuthService";
import {
  fetchSupabaseTemplates,
  type SupabaseConnectionStatus,
} from "./services/supabaseKyraRepository";
import type { DataProvider } from "./types/api";

const fallbackAgentTemplates = kyraDataService.listTemplates();
const demoScenarios = kyraDataService.listScenarios();

function getTemplateIdFromAgentPath(pathname: string) {
  const match = pathname.match(/^\/agents\/([a-z-]+)-demo$/);
  const templateId = match?.[1];

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
    ? getTemplateIdFromAgentPath(window.location.pathname)
    : "operator";
}

function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    return window.localStorage.getItem("kyra-theme") === "light" ? "light" : "dark";
  });
  const [selectedId, setSelectedId] = useState(getInitialTemplateId);
  const [agentTemplates, setAgentTemplates] = useState(fallbackAgentTemplates);
  const [templateCatalogSource, setTemplateCatalogSource] = useState<DataProvider>("mock");
  const [templateCatalogStatus, setTemplateCatalogStatus] = useState<SupabaseConnectionStatus>(
    appConfig.supabase.configured ? "checking" : "not-configured",
  );
  const [templateCatalogError, setTemplateCatalogError] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<KyraAuthSession | null>(() => loadStoredAuthSession());
  const [authStatus, setAuthStatus] = useState<KyraAuthStatus>(() =>
    loadStoredAuthSession() ? "signed-in" : appConfig.supabase.configured ? "signed-out" : "not-configured",
  );
  const [authMessage, setAuthMessage] = useState(() =>
    loadStoredAuthSession()
      ? "Stored Supabase session loaded."
      : appConfig.supabase.configured
        ? "Sign in to create a Supabase session for RLS-backed records."
        : "Supabase auth is not configured.",
  );
  const [selectedScenarioId, setSelectedScenarioId] = useState("swap");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalApproved, setApprovalApproved] = useState(false);
  const [approvalClosing, setApprovalClosing] = useState(false);
  const [route, setRoute] = useState<"home" | "dashboard" | "agent">(() => {
    if (typeof window === "undefined") {
      return "home";
    }

    if (window.location.pathname === "/dashboard") {
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
      setTemplateCatalogError(result.error ?? "Supabase returned an empty template catalog.");
    }

    void loadTemplateCatalog();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const storedSession = loadStoredAuthSession();

    if (!storedSession) {
      return;
    }

    const sessionToValidate = storedSession;
    let active = true;

    async function validateStoredSession() {
      const result = await getCurrentAuthUser(sessionToValidate);

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

  useEffect(() => {
    function syncRouteFromLocation() {
      if (window.location.pathname === "/dashboard") {
        setRoute("dashboard");
        return;
      }

      if (window.location.pathname.startsWith("/agents/")) {
        setSelectedId(getTemplateIdFromAgentPath(window.location.pathname));
        setRoute("agent");
        return;
      }

      setRoute("home");
    }

    window.addEventListener("popstate", syncRouteFromLocation);
    return () => window.removeEventListener("popstate", syncRouteFromLocation);
  }, []);

  function navigate(nextRoute: "home" | "dashboard" | "agent", templateId?: string) {
    const nextTemplateId = templateId ?? selectedTemplate.id;

    if (nextRoute === "agent") {
      setSelectedId(nextTemplateId);
    }

    setRoute(nextRoute);
    const path =
      nextRoute === "dashboard"
        ? "/dashboard"
        : nextRoute === "agent"
          ? `/agents/${nextTemplateId}-demo`
          : "/";
    window.history.pushState({}, "", path);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openHomeSection(sectionId: string) {
    setRoute("home");
    window.history.pushState({}, "", `/#${sectionId}`);
    window.setTimeout(() => {
      document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
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
  }

  function requestApproval() {
    if (!selectedScenario.approvalRequired || approvalApproved) {
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
        onToggleTheme={toggleTheme}
        onOpenDashboard={() => navigate("dashboard")}
        onOpenHome={() => navigate("home")}
        onOpenAgent={() => navigate("agent")}
        onOpenSection={openHomeSection}
      />
      <div className="demo-disclaimer" role="note" aria-label="Kyra demo disclaimer">
        <span>
          <ShieldCheck size={15} />
          {appConfig.dataProvider === "supabase" ? "Backend-connected demo" : "Frontend demo"}
        </span>
        <p>
          No real transactions, wallet keys, or Telegram bot tokens. Deploy records can persist
          to Supabase after sign-in, while onchain execution stays simulated.
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
          onOpenAgent={(templateId) => navigate("agent", templateId)}
        />
      ) : route === "agent" ? (
        <PublicAgent
          selectedTemplate={selectedTemplate}
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
                  Static demo environment
                </span>
                <h1>Deploy Base agents that actually do things onchain.</h1>
                <p className="hero-subtitle">
                  Launch Telegram-native AI agents that read wallet context, prepare Base
                  actions, and keep every transaction behind wallet approval.
                </p>

                <div className="hero-actions">
                  <a className="button button-primary" href="#deploy">
                    Deploy Agent
                    <ArrowRight size={17} />
                  </a>
                  <button
                    className="button button-ghost"
                    type="button"
                    onClick={() => navigate("dashboard")}
                  >
                    Open Dashboard
                    <ArrowRight size={17} />
                  </button>
                  <a className="button button-ghost" href="#security">
                    <ShieldCheck size={17} />
                    View Safety Model
                  </a>
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
              catalogSource={templateCatalogSource}
              catalogStatus={templateCatalogStatus}
              catalogError={templateCatalogError}
            />
            <DeployPanel
              templates={agentTemplates}
              selectedTemplate={selectedTemplate}
              authSession={authSession}
              onSelectTemplate={setSelectedId}
              onOpenAgent={() => navigate("agent")}
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
