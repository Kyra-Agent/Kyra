import type { FAQItem } from "../types/agent";

export const faqs: FAQItem[] = [
  {
    question: "What is Kyra?",
    answer:
      "Kyra is a Base-native agent console. It lets users deploy Telegram-native agents that read context, understand commands, and prepare approval-gated action reviews.",
  },
  {
    question: "Is this demo executing real transactions?",
    answer:
      "No. Kyra is currently a backend-connected demo. It simulates deployment, approval requests, and Base action workflows without touching real funds.",
  },
  {
    question: "Does Kyra control my wallet?",
    answer:
      "No. Kyra should never ask for seed phrases or private keys. The agent can prepare review context, but wallet prompts, signing, and onchain execution stay disabled until the owner-controlled handoff is audited.",
  },
  {
    question: "Who pays for onchain actions?",
    answer:
      "No live onchain action is submitted in the current demo. Future network and protocol fees must be shown to the owner wallet before any approval path is enabled.",
  },
  {
    question: "Why Telegram first?",
    answer:
      "Telegram gives Kyra a fast command interface for personal and community agents. The product output is still an agent instance: Telegram interface, Kyra dashboard, and an approval-gated review workflow.",
  },
  {
    question: "Do I need a Telegram bot token to try the demo?",
    answer:
      "No. The current backend-connected demo does not ask for a real BotFather token. When Telegram integration ships, owners will create a bot through @BotFather and paste the token only during agent deploy or an explicit reconnect flow.",
  },
  {
    question: "What is the Base action layer?",
    answer:
      "It is the approval-first workflow Kyra uses to prepare Base ecosystem action reviews while keeping wallet prompts and execution behind explicit owner control.",
  },
  {
    question: "Can project teams use Kyra?",
    answer:
      "Yes. Project-facing agents can answer token questions, verify holders, monitor launches, and keep admin actions separated from public user actions.",
  },
  {
    question: "Can I save a demo agent?",
    answer:
      "Yes. Signed-in users can persist demo records for dashboard and public preview testing. Telegram connections, wallet transactions, and onchain execution remain simulated.",
  },
];
