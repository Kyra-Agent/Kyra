import { currentProductChain } from "../config/productChains";
import type { ActionDefinition } from "../types/agent";

// Tiers describe what works today: "mvp" runs in chat now, "demo" is guided
// (the agent walks the user through it and the user acts in their own wallet),
// "later" needs live chain data that Kyra does not read yet.
export const actions: ActionDefinition[] = [
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
    id: "holder-verify",
    name: "Holder Verify",
    summary:
      "Plan a holder check your community completes in their own wallets. The bot never asks for signatures.",
    tier: "demo",
  },
  {
    id: "balance",
    name: "Balance",
    summary: `Summarize wallet balances and available assets on ${currentProductChain.name} from chat.`,
    tier: "later",
  },
  {
    id: "tx-history",
    name: "Tx History",
    summary: "Summarize recent wallet transactions next to your agent's activity.",
    tier: "later",
  },
  {
    id: "token-info",
    name: "Token Info",
    summary:
      "Surface token metadata, supply, holders, and liquidity signals.",
    tier: "later",
  },
  {
    id: "launch-monitor",
    name: "Launch Monitor",
    summary:
      `Track new launches and project activity across the ${currentProductChain.name} ecosystem.`,
    tier: "later",
  },
  {
    id: "dca",
    name: "DCA Rules",
    summary:
      "Design recurring-rule drafts with limits, risk checks, and approval policy.",
    tier: "later",
  },
];
