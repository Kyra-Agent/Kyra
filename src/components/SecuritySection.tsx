import { LockKeyhole, ShieldCheck, WalletCards } from "lucide-react";

const guarantees = [
  "No seed phrases",
  "No private keys",
  "No custody",
  "Wallet approval gate required",
  "Public execution needs approval",
  "No credentials stored",
];

export function SecuritySection() {
  return (
    <section className="section security-section" id="security">
      <div className="security-copy">
        <p className="eyebrow">Security Model</p>
        <h2>Kyra plans. Your wallet decides.</h2>
        <p>
          Kyra is built around user control. Agents can understand commands and prepare review drafts, while the wallet remains the final gate for any onchain action.
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
            Swaps, sends, and admin actions require explicit wallet or Base Account approval before execution can proceed.
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
