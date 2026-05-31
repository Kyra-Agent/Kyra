import { Github, Rocket, ShieldCheck, Terminal } from "lucide-react";
import { BrandMark } from "./BrandMark";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderProps {
  theme: "dark" | "light";
  onToggleTheme: () => void;
  onOpenDashboard: () => void;
  onOpenHome: () => void;
}

export function Header({ theme, onToggleTheme, onOpenDashboard, onOpenHome }: HeaderProps) {
  return (
    <header className="site-header">
      <button className="logo-link logo-button" type="button" onClick={onOpenHome} aria-label="Kyra Agent home">
        <BrandMark />
      </button>

      <nav className="site-nav" aria-label="Primary navigation">
        <a href="#templates">Templates</a>
        <a href="#actions">Actions</a>
        <a href="#security">Security</a>
        <a href="#faq">FAQ</a>
        <button type="button" onClick={onOpenDashboard}>
          Dashboard
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
          href="https://x.com/KyraAgent"
          target="_blank"
          rel="noreferrer"
          aria-label="Kyra Agent on X"
        >
          X
        </a>
        <button className="button button-primary button-small" type="button" onClick={onOpenHome}>
          <Rocket size={16} />
          Launch Demo
        </button>
        <a className="button button-ghost button-small hide-on-mobile" href="#security">
          <ShieldCheck size={16} />
          Safety
        </a>
      </div>
    </header>
  );
}
