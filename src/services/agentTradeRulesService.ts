import { appConfig } from "../config/appConfig";
import type { KyraAuthSession } from "./supabaseAuthService";
import { getSupabaseApiKey } from "./supabaseRestClient";
import { readServerMessage } from "./serverMessage";
import { postBoundedJson } from "./swapTransport";

// The owner's DCA, stop-loss, and take-profit rules. They are created from
// Telegram; the dashboard lists them and can pause, resume, or delete one
// through the agent-trade-rules Edge Function.

export interface TradeRule {
  id: string;
  kind: "dca" | "stop_loss" | "take_profit";
  sell: "ETH" | "USDG";
  buy: "ETH" | "USDG";
  amountAtomic: string;
  intervalHours: number | null;
  triggerPriceUsd: string | null;
  nextRunAt: string | null;
  lastTriggeredAt: string | null;
  enabled: boolean;
  createdAt: string;
}

export type TradeRuleChange = "pause" | "resume" | "delete";

export type TradeRulesResult =
  | { ok: true; rules: TradeRule[]; message: string | null }
  | { ok: false; message: string };

const timeoutMs = 8_000;

export function listTradeRules(session: KyraAuthSession, agentId: string) {
  return requestTradeRules(session, { agentId, action: "list" });
}

export function changeTradeRule(
  session: KyraAuthSession,
  agentId: string,
  ruleId: string,
  action: TradeRuleChange,
) {
  return requestTradeRules(session, { agentId, action, ruleId });
}

async function requestTradeRules(
  session: KyraAuthSession,
  body: Record<string, unknown>,
): Promise<TradeRulesResult> {
  if (!appConfig.functions.agentTradeRulesConfigured) {
    return { ok: false, message: "Trade rules are not available yet." };
  }
  const response = await postBoundedJson(appConfig.functions.agentTradeRulesUrl, {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: getSupabaseApiKey(),
    Authorization: `Bearer ${session.accessToken}`,
  }, body, timeoutMs);
  const value = response.value as Record<string, unknown> | null;
  if (!response.ok || value?.ok !== true || !Array.isArray(value.rules)) {
    return {
      ok: false,
      message: readServerMessage(response.value) ??
        (response.status === 0
          ? "Kyra could not reach the trade rules service. Check your connection."
          : "Kyra could not load trade rules right now."),
    };
  }
  return {
    ok: true,
    rules: value.rules.filter(isTradeRule),
    message: typeof value.message === "string" ? value.message.slice(0, 200) : null,
  };
}

function isTradeRule(value: unknown): value is TradeRule {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const rule = value as Record<string, unknown>;
  return typeof rule.id === "string" &&
    (rule.kind === "dca" || rule.kind === "stop_loss" || rule.kind === "take_profit") &&
    (rule.sell === "ETH" || rule.sell === "USDG") &&
    (rule.buy === "ETH" || rule.buy === "USDG") &&
    typeof rule.amountAtomic === "string" && /^[1-9][0-9]*$/u.test(rule.amountAtomic) &&
    (rule.intervalHours === null || typeof rule.intervalHours === "number") &&
    (rule.triggerPriceUsd === null || typeof rule.triggerPriceUsd === "string") &&
    (rule.nextRunAt === null || typeof rule.nextRunAt === "string") &&
    (rule.lastTriggeredAt === null || typeof rule.lastTriggeredAt === "string") &&
    typeof rule.enabled === "boolean" &&
    typeof rule.createdAt === "string";
}
