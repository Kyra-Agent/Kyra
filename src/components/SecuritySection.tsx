import { LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";

const guarantees = [
  "No seed phrases",
  "No private keys",
  "No custody",
  "Wallet approval gate required",
  "Public execution stays gated",
  "No credentials stored",
];

export function SecuritySection() {
  return (
    <section className="section security-section" id="security">
      <div className="security-copy">
        <p className="eyebrow">Security Model</p>
        <h2>Kyra prepares. Your wallet decides.</h2>
        <p>
          The product must be built around user control. Agents can understand
          commands and prepare review drafts, but the wallet remains the final
          gate for any future onchain action.
        </p>
      </div>

      <div className="security-grid">
        <article>
          <LockKeyhole size={22} />
          <strong>No custody</strong>
          <p>
            Kyra should never store seed phrases, private keys, or raw wallet
            credentials.
          </p>
        </article>
        <article>
          <WalletCards size={22} />
          <strong>Approval first</strong>
          <p>
            Swaps, sends, and admin actions stay gated until the wallet or Base
            Account handoff is explicitly approved and audited.
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

      <div className="guarantee-strip">
        {guarantees.map((item) => <span key={item}>{item}</span>)}
      </div>
    </section>
  );
}
