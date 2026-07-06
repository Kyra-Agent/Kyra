import { useState } from "react";
import { Github, Menu, Rocket, ShieldCheck, Terminal, UserRound, X } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  theme: "dark" | "light";
  accountSignedIn: boolean;
  onToggleTheme: () => void;
  onOpenDashboard: () => void;
  onOpenHome: () => void;
  onOpenAgent: () => void;
  onOpenAccount: () => void;
  onOpenSection: (sectionId: string) => void;
}

export function Header({
  theme,
  accountSignedIn,
  onToggleTheme,
  onOpenDashboard,
  onOpenHome,
  onOpenAgent,
  onOpenAccount,
  onOpenSection,
}: HeaderProps) {
  const [compactNavOpen, setCompactNavOpen] = useState(false);

  function handleNavigation(action: () => void) {
    setCompactNavOpen(false);
    action();
  }

  return (
    <header className="site-header">
      <button
        className="logo-link logo-button"
        type="button"
        onClick={() => handleNavigation(onOpenHome)}
        aria-label="Kyra Agent home"
      >
        <BrandMark />
      </button>

      <nav className="site-nav" aria-label="Primary navigation">
        <button type="button" onClick={() => onOpenSection("templates")}>
          Templates
        </button>
        <button type="button" onClick={() => onOpenSection("actions")}>
          Actions
        </button>
        <button type="button" onClick={() => onOpenSection("security")}>
          Security
        </button>
        <button type="button" onClick={() => onOpenSection("faq")}>
          FAQ
        </button>
        <button type="button" onClick={onOpenDashboard}>
          Dashboard
        </button>
        <button type="button" onClick={onOpenAgent}>
          Agent
        </button>
      </nav>

      <div className="header-actions">
        <button
          aria-controls="compact-site-nav"
          aria-expanded={compactNavOpen}
          aria-label={compactNavOpen ? "Close navigation menu" : "Open navigation menu"}
          className="compact-nav-trigger"
          type="button"
          onClick={() => setCompactNavOpen((open) => !open)}
        >
          {compactNavOpen ? <X size={18} /> : <Menu size={18} />}
        </button>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <button
          className="button button-ghost button-small header-account"
          type="button"
          onClick={onOpenAccount}
        >
          <UserRound size={16} />
          {accountSignedIn ? "Account" : "Sign in"}
        </button>
        <button
          className="button button-primary button-small"
          type="button"
          onClick={() => onOpenSection("deploy")}
        >
          <Rocket size={16} />
          Deploy Agent
        </button>
        <button
          className="button button-ghost button-small header-safety hide-on-mobile"
          type="button"
          onClick={() => onOpenSection("security")}
        >
          <ShieldCheck size={16} />
          Safety
        </button>
        <span className="demo-badge">
          <Terminal size={14} />
          Release Candidate
        </span>
      </div>

      <nav
        className={`compact-nav-menu ${compactNavOpen ? "is-open" : ""}`}
        id="compact-site-nav"
        aria-label="Compact navigation"
      >
        <button type="button" onClick={() => handleNavigation(() => onOpenSection("templates"))}>
          Templates
        </button>
        <button type="button" onClick={() => handleNavigation(() => onOpenSection("actions"))}>
          Actions
        </button>
        <button type="button" onClick={() => handleNavigation(() => onOpenSection("security"))}>
          Security
        </button>
        <button type="button" onClick={() => handleNavigation(() => onOpenSection("faq"))}>
          FAQ
        </button>
        <button type="button" onClick={() => handleNavigation(onOpenDashboard)}>
          Dashboard
        </button>
        <button type="button" onClick={() => handleNavigation(onOpenAccount)}>
          {accountSignedIn ? "Account" : "Sign in"}
        </button>
        <button type="button" onClick={() => handleNavigation(() => onOpenSection("deploy"))}>
          Deploy Agent
        </button>
        <button type="button" onClick={() => handleNavigation(onToggleTheme)}>
          {theme === "light" ? "Dark mode" : "Light mode"}
        </button>
        <button type="button" onClick={() => handleNavigation(onOpenAgent)}>
          Agent
        </button>
        <a href="https://github.com/Kyra-Agent/Kyra" target="_blank" rel="noreferrer">
          <Github size={16} />
          GitHub
        </a>
        <a href="https://x.com/Kyra_Agent" target="_blank" rel="noreferrer" aria-label="Kyra Agent on X">
          X
        </a>
      </nav>
    </header>
  );
}
