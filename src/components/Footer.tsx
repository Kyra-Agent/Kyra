import { Github, Terminal } from "lucide-react";

export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <strong>KYRA-AGENT</strong>
        <p>Base-native onchain agent console. Demo mode only.</p>
      </div>
      <div className="footer-links">
        <a href="https://github.com/Kyra-Agent/Kyra" target="_blank" rel="noreferrer">
          <Github size={15} />
          GitHub
        </a>
        <a href="https://x.com/KyraAgent" target="_blank" rel="noreferrer">
          X
          Social
        </a>
        <span>
          <Terminal size={15} />
          mcp.base.org ready
        </span>
      </div>
    </footer>
  );
}
