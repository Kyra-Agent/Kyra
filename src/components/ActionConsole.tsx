import {
  ArrowRightLeft,
  Coins,
  FileText,
  History,
  Radio,
  Send,
  Users,
} from "lucide-react";
import { actions } from "../data/actions";
import { RevealHeading } from "./RevealHeading";

const actionTierLabel = {
  mvp: "Ready",
  demo: "Guided",
  later: "Planned",
};

const actionIcons = {
  balance: Coins,
  swap: ArrowRightLeft,
  send: Send,
  "tx-history": History,
  "token-info": Radio,
  "holder-verify": Users,
  "launch-monitor": Radio,
  dca: History,
  "campaign-plan": FileText,
};

export function ActionConsole() {
  return (
    <section className="section" id="actions">
      <div className="section-heading">
        <p className="eyebrow">Action Layer</p>
        <RevealHeading text="Every command becomes a controlled review." />
        <p>
          Kyra explains, plans, and drafts reviews. Anything that would touch
          funds waits for your signature in your own wallet.
        </p>
        <p className="action-tier-legend">
          <span className="tier-mvp">Ready</span> works in chat today.{" "}
          <span className="tier-demo">Guided</span> means the agent walks you
          through it and you act in your wallet.
        </p>
      </div>

      <div className="actions-grid">
        {actions.map((action) => {
          const Icon = actionIcons[action.id as keyof typeof actionIcons] ??
            Radio;

          return (
            <article
              className={`action-card tier-${action.tier}`}
              key={action.id}
            >
              <div className="action-icon">
                <Icon size={18} />
              </div>
              <div>
                <span className="action-name">{action.name}</span>
                <p>{action.summary}</p>
              </div>
              <span className="mini-label">{actionTierLabel[action.tier]}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}