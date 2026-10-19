import { LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";
import { currentWalletDisplayName } from "../config/productChains";
import { ApprovalGateDemo } from "./ApprovalGateDemo";
import { RevealHeading } from "./RevealHeading";

const guarantees = [
  "No seed phrases",
  "No private keys",
  "No custody",
  "Wallet approval gate required",
  "Public actions need approval",
  "No credentials stored",
];

export function SecuritySection() {
  return (
    <section className="section security-section" id="security">
      <div className="security-copy">
        <p className="eyebrow">Security Model</p>
        <RevealHeading text="Kyra plans. Your wallet decides." />
        <p>
          Kyra is built around user control. Agents can understand commands and prepare review context, while the wallet remains the final gate for any onchain action.
        </p>
      </div>

      <div className="security-grid">
        <article>
          <LockKeyhole size={22} />
          <strong>No custody</strong>
          <p>
            Kyra never needs seed phrases, private keys, or raw wallet credentials.
          </p>
        </article>
        <article>
          <WalletCards size={22} />
          <strong>Approval first</strong>
          <p>
            Swaps, sends, and admin actions require explicit {currentWalletDisplayName} approval before execution can proceed.
          </p>
        </article>
        <article>
          <ShieldCheck size={22} />
          <strong>Risk guard</strong>
          <p>
            Kyra checks risky tokens, suspicious approvals, slippage, and unsafe
            flows.
          </p>
        </article>
      </div>

      <ApprovalGateDemo />

      <div className="guarantee-marquee">
        <ul className="guarantee-strip" aria-label="Kyra security guarantees">
          {guarantees.map((item) => <li key={item}>{item}</li>)}
        </ul>
        <ul className="guarantee-strip" aria-hidden="true">
          {guarantees.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </div>
    </section>
  );
}
