import { ArrowRightLeft, Coins, History, Radio, Send, ShieldCheck, Users } from "lucide-react";
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
  "bankr-launch": ShieldCheck,
};

export function ActionConsole() {
  return (
    <section className="section" id="actions">
      <div className="section-heading">
        <p className="eyebrow">Onchain Actions</p>
        <h2>Chat intent becomes a wallet-approved action.</h2>
        <p>
          MVP actions stay controlled: read wallet context, prepare Base transactions,
          and wait for explicit approval before anything can move onchain.
        </p>
      </div>

      <div className="actions-grid">
        {actions.map((action) => {
          const Icon = actionIcons[action.id as keyof typeof actionIcons] ?? Radio;

          return (
            <article className={`action-card tier-${action.tier}`} key={action.id}>
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
