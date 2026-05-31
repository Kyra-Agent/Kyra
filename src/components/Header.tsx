import { Github, Rocket, ShieldCheck, Terminal } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenDashboard: () => void;
  onOpenHome: () => void;
  onOpenAgent: () => void;
  onOpenSection: (sectionId: string) => void;
}

export function Header({
  theme,
  onToggleTheme,
  onOpenDashboard,
  onOpenHome,
  onOpenAgent,
  onOpenSection,
}: HeaderProps) {
  return (
    <header className="site-header">
      <button className="logo-link logo-button" type="button" onClick={onOpenHome} aria-label="Kyra Agent home">
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
        <span className="demo-badge">
          <Terminal size={14} />
          Demo Mode
        </span>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} />
        <a
          className="icon-link"
          href="https://github.com/Kyra-Agent/Kyra"
          target="_blank"
          rel="noreferrer"
          aria-label="Kyra Agent on GitHub"
        >
          <Github size={17} />
        </a>
        <a
          className="x-link icon-link"
          href="https://x.com/Kyra_Agent"
          target="_blank"
          rel="noreferrer"
          aria-label="Kyra Agent on X"
        >
          X
        </a>
        <button
          className="button button-primary button-small"
          type="button"
          onClick={() => onOpenSection("deploy")}
        >
          <Rocket size={16} />
          Launch Demo
        </button>
        <button
          className="button button-ghost button-small hide-on-mobile"
          type="button"
          onClick={() => onOpenSection("security")}
        >
          <ShieldCheck size={16} />
          Safety
        </button>
      </div>
    </header>
  );
}
