import { useState } from "react";
import { BadgeCheck, Check, Copy, ExternalLink } from "lucide-react";
import { officialKyraToken } from "../config/officialToken";

type CopyState = "idle" | "copied" | "error";

export function OfficialTokenCard() {
  const [copyState, setCopyState] = useState<CopyState>("idle");

  async function copyContractAddress() {
    try {
      await navigator.clipboard.writeText(officialKyraToken.contractAddress);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 1600);
    } catch {
      setCopyState("error");
      window.setTimeout(() => setCopyState("idle"), 2200);
    }
  }

  const copyLabel = copyState === "copied"
    ? "Copied"
    : copyState === "error"
    ? "Copy failed"
    : "Copy contract address";

  return (
    <div className="official-token-card" aria-label="Official Kyra token contract">
      <div className="official-token-mark" aria-hidden="true">
        <BadgeCheck size={20} strokeWidth={1.8} />
      </div>

      <div className="official-token-copy">
        <div className="official-token-heading">
          <strong>Official Kyra token</strong>
          <span>{officialKyraToken.chain.name}</span>
        </div>
        <code title={officialKyraToken.contractAddress}>
          {officialKyraToken.contractAddress}
        </code>
      </div>

      <div className="official-token-actions">
        <button
          className={`official-token-action${copyState === "copied" ? " is-copied" : ""}`}
          type="button"
          onClick={copyContractAddress}
          title={copyLabel}
          aria-label={copyLabel}
        >
          {copyState === "copied" ? <Check size={16} /> : <Copy size={16} />}
          <span>{copyState === "copied" ? "Copied" : "Copy"}</span>
        </button>
        <a
          className="official-token-action"
          href={officialKyraToken.explorerUrl}
          target="_blank"
          rel="noreferrer"
          title="View official token contract on Blockscout"
          aria-label="View official token contract on Blockscout"
        >
          <ExternalLink size={16} />
          <span>Explorer</span>
        </a>
      </div>
    </div>
  );
}
