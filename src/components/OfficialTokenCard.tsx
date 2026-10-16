import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck,
  Check,
  Copy,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { officialKyraToken } from "../config/officialToken";

type CopyState = "idle" | "copied" | "error";

export function OfficialTokenCard() {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const resetTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
  }, []);

  if (!officialKyraToken.published || !officialKyraToken.contractAddress) {
    return (
      <div
        className="official-token-card is-pending"
        role="note"
        aria-label="Official Kyra token status"
      >
        <div className="official-token-mark" aria-hidden="true">
          <ShieldAlert size={20} strokeWidth={1.8} />
        </div>

        <div className="official-token-copy">
          <div className="official-token-heading">
            <strong>Official {officialKyraToken.symbol} contract</strong>
            <span>{officialKyraToken.chain.name}</span>
          </div>
          <p>
            Not published yet. Trust only the address announced on Kyra's
            official channels.
          </p>
        </div>

        <div className="official-token-actions">
          <a
            className="official-token-action"
            href={officialKyraToken.announcementUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Updates: official Kyra announcements on X"
          >
            <ExternalLink size={16} />
            <span>Updates</span>
          </a>
        </div>
      </div>
    );
  }

  const contractAddress = officialKyraToken.contractAddress;

  function scheduleReset(delayMs: number) {
    if (resetTimerRef.current !== null) {
      window.clearTimeout(resetTimerRef.current);
    }
    resetTimerRef.current = window.setTimeout(() => {
      resetTimerRef.current = null;
      setCopyState("idle");
    }, delayMs);
  }

  async function copyContractAddress() {
    try {
      await navigator.clipboard.writeText(contractAddress);
      setCopyState("copied");
      scheduleReset(1600);
    } catch {
      setCopyState("error");
      scheduleReset(2200);
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
          <strong>Official {officialKyraToken.symbol} token</strong>
          <span>{officialKyraToken.chain.name}</span>
        </div>
        <code title={contractAddress}>{contractAddress}</code>
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
        {officialKyraToken.explorerUrl ? (
          <a
            className="official-token-action"
            href={officialKyraToken.explorerUrl}
            target="_blank"
            rel="noreferrer"
            title="View official token contract on Blockscout"
            aria-label="Explorer: view the official token contract on Blockscout"
          >
            <ExternalLink size={16} />
            <span>Explorer</span>
          </a>
        ) : null}
      </div>
    </div>
  );
}
