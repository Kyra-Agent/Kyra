import type { FAQItem } from "../types/agent";

export const faqs: FAQItem[] = [
  {
    question: "What is Kyra?",
    answer:
      "Kyra is a Base-native onchain agent console. It lets users deploy Telegram-native agents that read wallet context, understand commands, and prepare onchain actions for wallet approval.",
  },
  {
    question: "Is this demo executing real transactions?",
    answer:
      "No. Kyra is currently a backend-connected demo. It simulates deployment, approval requests, and Base action workflows without touching real funds.",
  },
  {
    question: "Does Kyra control my wallet?",
    answer:
      "No. Kyra should never ask for seed phrases or private keys. The agent prepares transactions, but the connected wallet or Base Account must approve before anything can happen onchain.",
  },
  {
    question: "Who pays for onchain actions?",
    answer:
      "The wallet that approves the action pays the network and protocol fees. Kyra should not sponsor gas by default in the MVP.",
  },
  {
    question: "Why Telegram first?",
    answer:
      "Telegram gives Kyra a fast command interface for personal and community agents. The product output is still an agent instance: Telegram interface, Kyra dashboard, and wallet approval workflow.",
  },
  {
    question: "What is the Base action layer?",
    answer:
      "It is the approval-first workflow Kyra uses to prepare Base ecosystem actions while keeping the final decision in the user's wallet.",
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
