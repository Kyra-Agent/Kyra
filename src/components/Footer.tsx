import { ArrowUpRight, Github, ShieldCheck } from "lucide-react";
import { currentProductChain } from "../config/productChains";

const currentYear = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="footer-brand">
        <span className="footer-logo">
          <img src="/brand/kyra.jpg" alt="" aria-hidden="true" />
          <strong>KYRA-AGENT</strong>
        </span>
        <p>
          {currentProductChain.name} AI agents with user-owned wallet authority.
          Kyra prepares; your wallet decides.
        </p>
      </div>

      <div className="footer-links">
        <a href="https://github.com/Kyra-Agent/Kyra" target="_blank" rel="noreferrer">
          <Github size={15} />
          GitHub
          <ArrowUpRight size={13} />
        </a>
        <a href="https://x.com/Kyra_Agent" target="_blank" rel="noreferrer">
          X / Twitter
          <ArrowUpRight size={13} />
        </a>
        <span>
          <ShieldCheck size={15} />
          Approval-first workflow
        </span>
      </div>

      <div className="footer-legal">
        <span>© {currentYear} Kyra Agent</span>
        <span>
          Independent product. Not affiliated with, sponsored by, or endorsed by
          Robinhood.
        </span>
      </div>
    </footer>
  );
}
