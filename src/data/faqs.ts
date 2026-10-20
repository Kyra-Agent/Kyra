import { currentProductChain } from "../config/productChains";
import type { FAQItem } from "../types/agent";

export const faqs: FAQItem[] = [
  {
    question: "What is Kyra?",
    answer:
      `Kyra lets you deploy an AI agent for ${currentProductChain.name} and talk to it through your own Telegram bot. Each agent starts from a template, explains and plans in plain language, and never moves funds on its own.`,
  },
  {
    question: "Does Kyra execute transactions automatically?",
    answer:
      "No. Telegram replies are read-only. When something would touch funds, Kyra stops and points you to a review in your private dashboard, and nothing is sent until you sign it in your own wallet.",
  },
  {
    question: "Does Kyra control my wallet?",
    answer:
      "No. Kyra never asks for seed phrases or private keys and does not hold funds. If you paste a secret into chat, the agent refuses it, never passes it to the AI model, and tells you how to secure your wallet.",
  },
  {
    question: "Who pays for onchain actions?",
    answer:
      "Your connected wallet pays network and protocol fees for anything you sign. Kyra shows what you are approving before your wallet asks for a signature.",
  },
  {
    question: "Why Telegram first?",
    answer:
      "Telegram is where most crypto users and communities already talk. Your agent replies there, while records, settings, and approvals live in your private Kyra dashboard.",
  },
  {
    question: "What happens to my Telegram bot token?",
    answer:
      "You paste the BotFather token once, inside the signed-in deploy or reconnect flow. It is encrypted on Kyra's backend, never shown in the browser again, and you can revoke it in BotFather at any time.",
  },
  {
    question: "What can an agent do today?",
    answer:
      "Agents answer questions, explain their template and safety policy, and draft plans such as campaign briefs, swap reviews, and transfer checklists. Live wallet balances, token data, and launch tracking in chat are on the roadmap and marked as Planned on this page.",
  },
  {
    question: "Can project teams use Kyra?",
    answer:
      "Yes. The Steward and Strategist templates are built for teams: community answers, announcement drafts, and campaign plans, with admin actions kept separate from public users.",
  },
  {
    question: "How many agents can I deploy?",
    answer:
      "Each account workspace holds up to three agents. Every agent gets its own public profile, Telegram connection, and activity log in the dashboard.",
  },
];
