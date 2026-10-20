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
      "Paste a wallet address, token address, or transaction hash and your agent reads it live from Robinhood Chain: balances, token supply, holder checks, and recent transfers. Agents also draft campaign briefs, swap reviews, and transfer checklists, and answer project questions from the knowledge you give them. USD prices and launch tracking are still on the roadmap.",
  },
  {
    question: "Does my agent remember our conversation?",
    answer:
      "For a short time. Your agent remembers the last six messages in your private chat for 24 hours so follow-ups make sense. Secrets are redacted, refusals are never stored, and you can wipe it instantly with /forget. Disconnecting the bot or removing the agent deletes it too.",
  },
  {
    question: "Can project teams use Kyra?",
    answer:
      "Yes, as a private assistant for the team. Today the bot answers only its owner's chat, so teams use Steward and Strategist to draft community answers, announcements, and campaign plans. A community mode for group chats is planned.",
  },
  {
    question: "How many agents can I deploy?",
    answer:
      "Each account workspace holds up to three agents. Every agent gets its own public profile, Telegram connection, and activity log in the dashboard.",
  },
];
