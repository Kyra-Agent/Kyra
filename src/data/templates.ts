import type { AgentTemplate } from "../types/agent";

export const agentTemplates: AgentTemplate[] = [
  {
    id: "operator",
    name: "Operator",
    role: "Personal wallet action agent",
    status: "mvp",
    summary:
      "A private Telegram-native agent for wallet checks, swaps, sends, action logs, and approval-driven execution on Base.",
    bestFor: "Traders, founders, and Base users who want a command layer for their own wallet.",
    actions: ["balance", "swap", "send", "portfolio", "tx history", "price alert"],
    modules: ["NIRA-01", "NOVA-04", "NYX-05"],
    terminalSeed: "swap 10 USDC to ETH",
  },
  {
    id: "scout",
    name: "Scout",
    role: "Recon and launch monitor",
    status: "mvp",
    summary:
      "A research-forward agent that watches new launches, token activity, and Base ecosystem signals before summarizing what matters.",
    bestFor: "Users tracking launches, new tokens, project signals, and onchain opportunities.",
    actions: ["launch monitor", "token scan", "watchlist", "market brief", "project summary"],
    modules: ["NIRA-01", "VEXA-02", "ASTRA-03", "NOVA-04", "NYX-05"],
    terminalSeed: "scan new Base launches",
  },
  {
    id: "steward",
    name: "Steward",
    role: "Project and community agent",
    status: "mvp",
    summary:
      "A public-facing agent for token communities that can answer project questions, verify holders, and surface token context.",
    bestFor: "Token teams, creator coins, Base communities, and project founders.",
    actions: ["faq", "holder verify", "token info", "announcement", "tx summary"],
    modules: ["NIRA-01", "ASTRA-03", "NOVA-04", "NYX-05"],
    terminalSeed: "verify holder access",
  },
  {
    id: "executor",
    name: "Executor",
    role: "Rule-based action agent",
    status: "advanced",
    summary:
      "An advanced agent for conditional swaps, DCA rules, stop loss flows, and controlled automation with hard approval limits.",
    bestFor: "Power users who want rule-driven execution with strict safety controls.",
    actions: ["conditional swap", "dca", "stop loss", "lp manage", "lend"],
    modules: ["NIRA-01", "NOVA-04", "NYX-05"],
    terminalSeed: "set dca 25 USDC into ETH daily",
  },
  {
    id: "launcher",
    name: "Launcher",
    role: "Token launch agent",
    status: "coming-soon",
    summary:
      "A launch-focused agent for Bankr-style token deployment, launch checklists, token metadata, and post-launch monitoring.",
    bestFor: "Founders and creators preparing a Base token launch.",
    actions: ["bankr launch", "token metadata", "launch checklist", "post-launch monitor"],
    modules: ["NIRA-01", "ASTRA-03", "NOVA-04", "NYX-05"],
    terminalSeed: "prepare token launch checklist",
  },
  {
    id: "custom",
    name: "Custom",
    role: "Build your own agent",
    status: "mvp",
    summary:
      "Choose the personality, modules, actions, and safety limits for a Kyra agent built around a specific workflow.",
    bestFor: "Teams that want a tailored agent without starting from a blank page.",
    actions: ["choose modules", "choose actions", "custom prompt", "safety limits"],
    modules: ["NIRA-01", "NYX-05"],
    terminalSeed: "compile custom agent profile",
  },
];
