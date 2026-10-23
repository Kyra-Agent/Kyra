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
      "Swap ETH and USDG on Uniswap with /swap in Telegram or from your dashboard. You see a live, simulated quote and confirm it in your own wallet; Kyra never signs.",
    tier: "mvp",
  },
  {
    id: "send",
    name: "Transfer Review",
    summary:
      "Check recipient, amount, and risk, then send ETH from your dashboard's transfer lane, signed in your own wallet.",
    tier: "mvp",
  },
  {
    id: "dca",
    name: "DCA and Price Rules",
    summary:
      "Set /dca, /stoploss, or /takeprofit in Telegram. When a rule comes due, your bot sends a live Uniswap quote and you confirm it in your own wallet.",
    tier: "mvp",
  },
  {
    id: "launch-monitor",
    name: "Launch Monitor",
    summary:
      `Turn on /launches and get a digest of new ${currentProductChain.name} DEX pools every 30 minutes, plus /watch alerts for wallets and tokens.`,
    tier: "mvp",
  },
];
