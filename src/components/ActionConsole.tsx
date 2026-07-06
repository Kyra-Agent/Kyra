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
        <p className="eyebrow">Action Readiness</p>
        <h2>Chat intent becomes a review draft.</h2>
        <p>
          Current actions stay execution-safe: read context, prepare bounded review
          summaries, and keep wallet prompts and onchain execution disabled.
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
              <span className="mini-label">{action.tier}</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
