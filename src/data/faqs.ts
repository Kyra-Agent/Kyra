import type { FAQItem } from "../types/agent";

export const faqs: FAQItem[] = [
  {
    question: "What is Kyra?",
    answer:
      "Kyra is a Base-native agent console. It lets users deploy Telegram-native agents that read context, understand commands, and prepare approval-gated action reviews.",
  },
  {
    question: "Does Kyra execute real transactions automatically?",
    answer:
      "No. Kyra is product-ready for agent deployment, Telegram read-only replies, and approval-gated review flows. Public transaction execution remains gated by explicit owner and wallet approval.",
  },
  {
    question: "Does Kyra control my wallet?",
    answer:
      "No. Kyra should never ask for seed phrases or private keys. The agent can prepare review context, but wallet prompts, signing, and onchain execution stay disabled until the owner-controlled handoff is audited.",
  },
  {
    question: "Who pays for onchain actions?",
    answer:
      "Public live onchain actions are not submitted without explicit release approval. Any future network and protocol fees must be shown to the owner wallet before an approval path is enabled.",
  },
  {
    question: "Why Telegram first?",
    answer:
      "Telegram gives Kyra a fast command interface for personal and community agents. The product output is still an agent instance: Telegram interface, Kyra dashboard, and an approval-gated review workflow.",
  },
  {
    question: "Do I need to expose a Telegram bot token?",
    answer:
      "No. Public pages never collect bot tokens. Owners connect Telegram only through deploy or an explicit reconnect flow, and token handling stays backend-scoped.",
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
    question: "Can I save an agent?",
    answer:
      "Yes. Signed-in users can persist agent records for dashboard and public profile views. Telegram connections stay owner-managed, while wallet transactions and public onchain execution remain approval-gated.",
  },
];
