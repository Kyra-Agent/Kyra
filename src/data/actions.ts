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
    name: "Swap",
    summary: "Prepare token swaps from natural language commands for wallet approval.",
    tier: "mvp",
  },
  {
    id: "send",
    name: "Send",
    summary: "Prepare token transfers with recipient, token, amount, and risk checks.",
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
    summary: "Surface token metadata, supply context, holders, and liquidity signals.",
    tier: "mvp",
  },
  {
    id: "holder-verify",
    name: "Holder Verify",
    summary: "Let community users prove wallet ownership and token holder status.",
    tier: "mvp",
  },
  {
    id: "launch-monitor",
    name: "Launch Monitor",
    summary: "Track new launches and project activity across the Base ecosystem.",
    tier: "demo",
  },
  {
    id: "dca",
    name: "DCA Rules",
    summary: "Create recurring action rules with limits and approval policies.",
    tier: "later",
  },
  {
    id: "bankr-launch",
    name: "Bankr Launch",
    summary: "Prepare token launch flows, metadata, and post-launch monitoring.",
    tier: "later",
  },
];
