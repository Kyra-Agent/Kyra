import type { FAQItem } from "../types/agent";

export const faqs: FAQItem[] = [
  {
    question: "What is Kyra?",
    answer:
      "Kyra is a Base-native AI agent platform. It lets users deploy Telegram-native agents that read context, understand commands, and prepare approval-first action reviews.",
  },
  {
    question: "Does Kyra execute real transactions automatically?",
    answer:
      "No. Kyra can deploy agents, run Telegram read-only replies, and prepare approval-first review flows. Transaction execution requires explicit owner and wallet approval.",
  },
  {
    question: "Does Kyra control my wallet?",
    answer:
      "No. Kyra never needs seed phrases or private keys. The agent can prepare review context, but wallet prompts, signing, and onchain execution stay behind the owner-controlled approval path.",
  },
  {
    question: "Who pays for onchain actions?",
    answer:
      "Network and protocol fees belong to the owner wallet. Any onchain action must show the owner what is being approved before submission.",
  },
  {
    question: "Why Telegram first?",
    answer:
      "Telegram gives Kyra a fast command interface for personal and community agents. The product output is still a full agent workspace: Telegram interface, dashboard, public profile, and approval-first workflow.",
  },
  {
    question: "Do I need to expose a Telegram bot token?",
    answer:
      "No. Public pages never collect bot tokens. Owners connect Telegram only through deploy or an explicit reconnect flow, and token handling stays backend-scoped.",
  },
  {
    question: "What is the Base action layer?",
    answer:
      "It is the approval-first workflow Kyra uses to prepare Base ecosystem action reviews while keeping wallet prompts and execution under explicit owner control.",
  },
  {
    question: "Can project teams use Kyra?",
    answer:
      "Yes. Project-facing agents can answer token questions, verify holders, monitor launches, and keep admin actions separated from public user actions.",
  },
  {
    question: "Can I save an agent?",
    answer:
      "Yes. Signed-in users can persist agent records for dashboard and public profile views. Telegram connections stay owner-managed, while wallet transactions remain approval-first.",
  },
];
