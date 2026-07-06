import type { ActionDefinition } from "../types/agent";

export const actions: ActionDefinition[] = [
  {
    id: "balance",
    name: "Balance",
    summary: "Read wallet balances and summarize available assets on Base.",
    tier: "mvp",
  },
  {
    id: "swap",
    name: "Swap Review",
    summary:
      "Turn swap requests into owner-review drafts. No Telegram-triggered swap execution.",
    tier: "mvp",
  },
  {
    id: "send",
    name: "Transfer Review",
    summary:
      "Summarize recipient, token, amount, and risk context before any future wallet prompt.",
    tier: "mvp",
  },
  {
    id: "tx-history",
    name: "Tx History",
    summary: "Summarize recent wallet transactions and agent activity.",
    tier: "mvp",
  },
  {
    id: "token-info",
    name: "Token Info",
    summary:
      "Surface token metadata, supply context, holders, and liquidity signals.",
    tier: "mvp",
  },
  {
    id: "holder-verify",
    name: "Holder Verify",
    summary:
      "Plan owner-controlled verification flows without asking Telegram to request signatures.",
    tier: "mvp",
  },
  {
    id: "launch-monitor",
    name: "Launch Monitor",
    summary:
      "Track launches and project activity across the Base ecosystem.",
    tier: "mvp",
  },
  {
    id: "dca",
    name: "DCA Rules",
    summary:
      "Design recurring-rule drafts with limits, risk checks, and approval policy.",
    tier: "later",
  },
  {
    id: "campaign-plan",
    name: "Campaign Plan",
    summary:
      "Turn market, token, and community context into launch messaging and decision-ready campaign steps.",
    tier: "mvp",
  },
];
