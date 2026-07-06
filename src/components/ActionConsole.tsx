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

const actionTierLabel = {
  mvp: "Ready",
  demo: "Preview",
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
        <h2>Every command becomes a controlled review.</h2>
        <p>
          Kyra reads context, prepares bounded summaries, and routes wallet or
          onchain requests through explicit owner approval.
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