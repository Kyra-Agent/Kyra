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
import { demoScenarios } from "./data/demoScenarios";
import { agentTemplates } from "./data/templates";
import { Dashboard } from "./pages/Dashboard";

function App() {
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") {
      return "dark";
    }

    return window.localStorage.getItem("kyra-theme") === "light" ? "light" : "dark";
  });
  const [selectedId, setSelectedId] = useState("operator");
  const [selectedScenarioId, setSelectedScenarioId] = useState("swap");
  const [approvalOpen, setApprovalOpen] = useState(false);
  const [approvalApproved, setApprovalApproved] = useState(false);
  const [approvalClosing, setApprovalClosing] = useState(false);
  const [route, setRoute] = useState<"home" | "dashboard">(() => {
    if (typeof window === "undefined") {
      return "home";
    }

    return window.location.pathname === "/dashboard" ? "dashboard" : "home";
  });

  const selectedTemplate = useMemo(
    () => agentTemplates.find((template) => template.id === selectedId) ?? agentTemplates[0],
    [selectedId],
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

  function toggleTheme() {
    setTheme((value) => (value === "dark" ? "light" : "dark"));
  }

  function navigate(nextRoute: "home" | "dashboard") {
    setRoute(nextRoute);
    const path = nextRoute === "dashboard" ? "/dashboard" : "/";
    window.history.pushState({}, "", path);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
      />

      {route === "dashboard" ? (
        <Dashboard selectedTemplate={selectedTemplate} onBackHome={() => navigate("home")} />
      ) : (
        <>
          <main>
            <section className="hero-section">
              <div className="hero-copy">
                <span className="demo-badge hero-badge">
                  <Terminal size={15} />
                  KYRA demo is live locally
                </span>
                <h1>Deploy Base agents that actually do things onchain.</h1>
                <p className="hero-subtitle">
                  Kyra lets you launch Telegram-native AI agents that monitor wallets,
                  prepare onchain actions, and route every transaction through wallet
                  approval.
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
            />
            <DeployPanel
              templates={agentTemplates}
              selectedTemplate={selectedTemplate}
              onSelectTemplate={setSelectedId}
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
