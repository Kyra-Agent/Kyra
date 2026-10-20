import { HttpError } from "./core.ts";
import type { TelegramWebhookParsedCommandName } from "./update-parser.ts";

export interface TelegramReadOnlyCommandResponse {
  command: TelegramWebhookParsedCommandName;
  text: string;
}

const helpText = [
  "Kyra Telegram",
  "Commands: /help /status /agent /actions /modules /policy /forget",
  "Plain text: ask for a brief, review, or plan.",
  "Memory: last 6 messages, 24h. /forget clears it.",
  "Boundary: wallet and onchain execution are disabled.",
].join("\n");

const forgetText = [
  "Done. I cleared this chat's memory.",
  "Earlier messages are no longer used. Your next message starts fresh.",
].join("\n");

const walletStatusText = [
  "Kyra cannot read live wallet balances or history from Telegram.",
  "Open your private Kyra dashboard and connect your wallet to review it.",
  "Here I can explain your agent's review scope or help plan a review.",
].join("\n");

const ownerLinkedText = [
  "Kyra: this chat is now linked as your agent's owner chat.",
  "Try /help or /status, or just ask in plain language.",
  "Wallet and onchain actions still need your approval in the Kyra dashboard.",
].join("\n");

const ownerLinkRejectedText = [
  "Kyra could not use this activation link. It may have expired or already been used.",
  "Create a new link from your Kyra dashboard and open it again.",
].join("\n");

export function buildTelegramOwnerLinkReply(
  outcome: "linked" | "not_linked",
): TelegramReadOnlyCommandResponse {
  return {
    command: "help",
    text: outcome === "linked" ? ownerLinkedText : ownerLinkRejectedText,
  };
}

const statusText = [
  "Kyra Telegram session: active",
  "Command access: read-only",
  "Live replies: commands and read-only natural chat",
  "Memory: last 6 messages for 24 hours (/forget clears it)",
  "Execution: wallet, write, approval, and onchain disabled",
].join("\n");

const agentText = [
  "Kyra agent interface",
  "Role: read-only Telegram operator",
  "Focus: template profile, actions, and module stack",
  "Next: /actions or /modules",
].join("\n");

const actionsText = [
  "Kyra actions",
  "Ready in Telegram: market brief, campaign plan, narrative map, launch copy, community pulse",
  "Use commands or plain text requests.",
  "Dashboard gated: write and approval",
  "Owner approval required: wallet and onchain execution",
].join("\n");

const modulesText = [
  "Kyra modules view",
  "Shows the deployed template stack when context is available.",
  "Global module activation and execution stay gated outside Telegram.",
].join("\n");

const policyText = [
  "Kyra policy: approval required",
  "Telegram can brief and plan only.",
  "Wallet, write, approval, and onchain execution stay disabled.",
].join("\n");

export function buildTelegramReadOnlyCommandResponse(
  command: unknown,
  text?: unknown,
): TelegramReadOnlyCommandResponse {
  if (command === "help") {
    return { command, text: helpText };
  }

  if (command === "status") {
    return { command, text: statusText };
  }

  if (command === "agent") {
    return { command, text: agentText };
  }

  if (command === "actions") {
    return { command, text: actionsText };
  }

  if (command === "modules") {
    return { command, text: modulesText };
  }

  if (command === "policy") {
    return { command, text: policyText };
  }

  if (command === "forget") {
    return { command, text: forgetText };
  }

  if (command === "chat") {
    return {
      command,
      text: buildTelegramReadOnlyChatFallbackText(text),
    };
  }

  throw new HttpError(
    422,
    "unsupported_update",
    "Telegram update is not supported.",
  );
}

export type TelegramReadOnlyChatIntent =
  | "market_brief"
  | "campaign_plan"
  | "narrative_map"
  | "launch_copy"
  | "community_pulse"
  | "risk_review"
  | "module_status"
  | "agent_profile"
  | "policy"
  | "help"
  | "wallet_status"
  | "unsafe_execution"
  | "general";

const walletActionVerbPattern =
  /\b(send|transfer|swap|approve|approval|allowance|permit|revoke|sign|execute|bridge|mint|burn|stake|unstake|claim|withdraw|deposit|buy|sell|delegate|wrap|unwrap|borrow|lend|liquidate|repay|kirim|tukar|setujui|persetujuan|izin|cabut|tandatangani|jalankan|jembatani|bakar|klaim|tarik|setor|beli|jual|delegasikan|bungkus|pinjam|bayar)\b/i;
const alwaysUnsafePattern =
  /\b(private key|kunci privat|seed phrase|frasa seed|robinhood chain actions|aksi robinhood chain|contract call|panggilan kontrak|calldata)\b/i;
// "Do it now" language keeps a wallet verb on the refusal path even when the
// message also asks a question.
const directExecutionCuePattern =
  /\b(now|right away|immediately|asap|execute|submit|broadcast|do it|confirm it|sekarang|langsung|jalankan)\b/i;
// Reviews, plans, drafts, and questions about a wallet action are read-only
// work the agent can do; only bare commands ("swap 10 USDC to ETH") are refused.
const planningCuePattern =
  /\?|\b(review|check|plan|planning|draft|explain|analy[sz]e|assess|evaluate|compare|simulate|estimate|strategy|checklist|risks?|pros|cons|should|would|could|how|what|why|when|which|tips|guide|faq|thread|tweet|copy|announcement|write|idea|ideas|campaign|tinjau|cek|rencana|jelaskan|analisa|analisis|bandingkan|risiko|bagaimana|gimana|apa|kenapa|kapan|apakah|sebaiknya|tulis)\b/i;

function isUnsafeExecutionRequest(text: string) {
  if (alwaysUnsafePattern.test(text)) {
    return true;
  }

  if (!walletActionVerbPattern.test(text)) {
    return false;
  }

  return directExecutionCuePattern.test(text) || !planningCuePattern.test(text);
}
// Read-only wallet questions (balance, history, portfolio). Answered honestly
// as "not visible from Telegram", never treated as an execution request.
const walletStatusPattern =
  /\b(wallet|dompet|balance|saldo|portfolio|portofolio|holdings?|aset|tx|transactions?|transaksi|history|riwayat|onchain)\b/i;

export function classifyTelegramReadOnlyChatIntent(
  value: unknown,
): TelegramReadOnlyChatIntent {
  if (typeof value !== "string") {
    return "general";
  }

  const text = value.toLowerCase();

  if (isUnsafeExecutionRequest(text)) {
    return "unsafe_execution";
  }

  if (walletStatusPattern.test(text)) {
    return "wallet_status";
  }

  if (
    /\b(help|what can you do|commands?|capabilities|bantuan|bisa apa|perintah|kemampuan)\b/i
      .test(text)
  ) {
    return "help";
  }

  if (
    /\b(policy|permission|allowed|disabled|gated|approval|kebijakan|diizinkan|dinonaktifkan|dibatasi)\b/i
      .test(text)
  ) {
    return "policy";
  }

  if (/\b(module|modul|stack|nira|vexa|astra|nova|nyx)\b/i.test(text)) {
    return "module_status";
  }

  if (
    /\b(campaign|kampanye|go[- ]?to[- ]?market|gtm|roadmap|launch plan|rencana peluncuran|pemasaran)\b/i
      .test(text)
  ) {
    return "campaign_plan";
  }

  if (
    /\b(narrative|narasi|positioning|pemosisian|angle|sudut|thesis|tesis|story|cerita)\b/i
      .test(text)
  ) {
    return "narrative_map";
  }

  if (
    /\b(copy|tweet|thread|utas|announcement|pengumuman|caption|cta|post|postingan)\b/i
      .test(text)
  ) {
    return "launch_copy";
  }

  if (
    /\b(community|komunitas|sentiment|sentimen|pulse|engagement|keterlibatan|discord|telegram group|grup telegram)\b/i
      .test(text)
  ) {
    return "community_pulse";
  }

  if (
    /\b(risk|risiko|review|tinjauan|dca|stop loss|liquidity pool|kumpulan likuiditas|lp review|tinjauan lp|lend review)\b/i
      .test(text)
  ) {
    return "risk_review";
  }

  if (
    /\b(market|pasar|brief|ringkasan|trend|tren|liquidity|likuiditas|volume|price|harga|token)\b/i
      .test(text)
  ) {
    return "market_brief";
  }

  if (
    /\b(agent|agen|profile|profil|role|peran|who are you|siapa kamu|template|templat|strategy|strategi|playbook|approach|pendekatan)\b/i
      .test(text)
  ) {
    return "agent_profile";
  }

  return "general";
}

function buildTelegramReadOnlyChatFallbackText(text: unknown) {
  const intent = classifyTelegramReadOnlyChatIntent(text);

  if (intent === "unsafe_execution") {
    return [
      "Kyra cannot execute that from Telegram.",
      "Wallet signing, approvals, and onchain execution are disabled.",
      "I can turn it into a read-only risk review or checklist.",
    ].join("\n");
  }

  if (intent === "wallet_status") {
    return walletStatusText;
  }

  if (intent === "help") {
    return helpText;
  }

  if (intent === "module_status") {
    return modulesText;
  }

  if (intent === "agent_profile") {
    return agentText;
  }

  if (intent === "policy") {
    return policyText;
  }

  return [
    "Kyra read-only chat is online.",
    "Ask for market brief, campaign plan, narrative map, launch copy, or community pulse.",
    "Telegram can brief and plan only. Wallet, approval, Robinhood Chain actions, and onchain execution stay disabled.",
  ].join("\n");
}
