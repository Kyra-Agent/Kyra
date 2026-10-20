import { currentProductChain } from "../config/productChains";
import type { ActionDefinition } from "../types/agent";

// Tiers describe what works today: "mvp" runs in chat now (including live
// Robinhood Chain reads), "demo" is guided (the agent walks the user through
// it and the user acts in their own wallet), "later" is on the roadmap.
export const actions: ActionDefinition[] = [
  {
    id: "balance",
    name: "Balance",
    summary: `Paste any wallet address and get live ETH and token balances from ${currentProductChain.name}.`,
    tier: "mvp",
  },
  {
    id: "token-info",
    name: "Token Info",
    summary:
      "Paste a token address for its name, decimals, total supply, and live transfer activity.",
    tier: "mvp",
  },
  {
    id: "holder-verify",
    name: "Holder Verify",
    summary:
      "Send a wallet and a token address to check whether the wallet holds it, and how much.",
    tier: "mvp",
  },
  {
    id: "tx-history",
    name: "Tx History",
    summary: "See a wallet's latest token transfers, or paste a transaction hash for a plain-English breakdown.",
    tier: "mvp",
  },
  {
    id: "campaign-plan",
    name: "Campaign Plan",
    summary:
      "Turn market, token, and community context into launch messaging and decision-ready campaign steps.",
    tier: "mvp",
  },
  {
    id: "swap",
    name: "Swap Review",
    summary:
      "Talk through a swap's route, size, and risks as a review draft. Telegram never executes swaps.",
    tier: "demo",
  },
  {
    id: "send",
    name: "Transfer Review",
    summary:
      "Check recipient, token, amount, and risk before you open your wallet.",
    tier: "demo",
  },
  {
    id: "dca",
    name: "DCA Rules",
    summary:
      "Design recurring-rule drafts with limits, risk checks, and approval policy. You run them from your own wallet.",
    tier: "demo",
  },
  {
    id: "launch-monitor",
    name: "Launch Monitor",
    summary:
      `Turn on /launches and get a digest of new ${currentProductChain.name} DEX pools every 30 minutes, plus /watch alerts for wallets and tokens.`,
    tier: "mvp",
  },
];
