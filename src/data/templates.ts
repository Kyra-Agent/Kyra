import type { AgentTemplate } from "../types/agent";

export const agentTemplates: AgentTemplate[] = [
  {
    id: "operator",
    name: "Operator",
    role: "Personal wallet readiness agent",
    status: "mvp",
    summary:
      "A private Telegram-native agent for wallet checks, swap reviews, transfer reviews, action logs, and approval-first Base readiness.",
    bestFor:
      "Traders, founders, and Base users who want a safe command layer for wallet review workflows.",
    actions: [
      "balance",
      "swap review",
      "transfer review",
      "portfolio",
      "tx history",
      "price alert",
    ],
    modules: ["NIRA-01", "NOVA-04", "NYX-05"],
    terminalSeed: "review 10 USDC to ETH swap",
  },
  {
    id: "scout",
    name: "Scout",
    role: "Recon and launch monitor",
    status: "mvp",
    summary:
      "A research-forward agent that watches new launches, token activity, and Base ecosystem signals before summarizing what matters.",
    bestFor:
      "Users tracking launches, new tokens, project signals, and onchain opportunities.",
    actions: [
      "launch monitor",
      "token scan",
      "watchlist",
      "market brief",
      "project summary",
    ],
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
    bestFor:
      "Token teams, creator coins, Base communities, and project founders.",
    actions: [
      "faq",
      "holder verify",
      "token info",
      "announcement",
      "tx summary",
    ],
    modules: ["NIRA-01", "ASTRA-03", "NOVA-04", "NYX-05"],
    terminalSeed: "verify holder access",
  },
  {
    id: "executor",
    name: "Executor",
    role: "Rule-based action readiness agent",
    status: "advanced",
    summary:
      "An advanced agent for conditional swap reviews, DCA plans, stop loss checks, and controlled automation drafts with hard approval limits.",
    bestFor:
      "Power users who want rule-driven planning with strict safety controls before any future execution path.",
    actions: [
      "conditional review",
      "dca plan",
      "stop loss check",
      "lp review",
      "lend review",
    ],
    modules: ["NIRA-01", "NOVA-04", "NYX-05"],
    terminalSeed: "set dca 25 USDC into ETH daily",
  },
  {
    id: "strategist",
    name: "Strategist",
    role: "Market and campaign intelligence agent",
    status: "mvp",
    summary:
      "A planning agent that turns token, market, and community context into launch narratives, campaign plans, and decision-ready briefs.",
    bestFor:
      "Projects and operators who need sharper positioning, launch messaging, and market-aware plans before pushing announcements or owner-approved actions.",
    actions: [
      "market brief",
      "campaign plan",
      "narrative map",
      "launch copy",
      "community pulse",
    ],
    modules: ["ASTRA-03", "NOVA-04", "VEXA-02"],
    terminalSeed: "draft market-aware campaign plan",
  },
  {
    id: "custom",
    name: "Custom",
    role: "Build your own agent",
    status: "mvp",
    summary:
      "Choose the personality, modules, actions, and safety limits for a Kyra agent built around a specific workflow.",
    bestFor:
      "Teams that want a tailored agent without starting from a blank page.",
    actions: [
      "choose modules",
      "choose actions",
      "custom prompt",
      "safety limits",
    ],
    modules: ["NIRA-01", "NYX-05"],
    terminalSeed: "compile custom agent profile",
  },
];
