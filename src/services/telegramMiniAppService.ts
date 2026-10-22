import { appConfig } from "../config/appConfig";
import type { SwapTokenSymbol } from "../config/swapQuotePolicy";
import { getSupabaseApiKey } from "./supabaseRestClient";
import { readServerMessage } from "./serverMessage";
import { postBoundedJson, type SwapPost } from "./swapTransport";

// The Telegram Mini App has no Kyra account session. Each request carries the
// initData Telegram signed when the owner opened the Mini App from their
// agent's bot, and telegram-miniapp re-checks it and the owner link every time.

export type MiniAppAction = "context" | "quote" | "prepare" | "closeout";

export interface MiniAppSession {
  initData: string;
  agentId: string;
}

export interface MiniAppRule {
  kind: "dca" | "stop_loss" | "take_profit";
  sell: SwapTokenSymbol;
  buy: SwapTokenSymbol;
  amountAtomic: string;
}

export type MiniAppContextResult =
  | { ok: true; agentName: string; rule: MiniAppRule | null }
  | { ok: false; message: string };

// Quotes price every pool and simulate on chain, so they get the longer wait.
const timeouts: Record<MiniAppAction, number> = {
  context: 8_000,
  quote: 15_000,
  prepare: 8_000,
  closeout: 8_000,
};
// The backend fills these in from the verified owner scope.
const scopeKeys = new Set(["workspaceId", "agentId"]);
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

export function isMiniAppConfigured() {
  return appConfig.chain.currentKey === "robinhood_mainnet" &&
    appConfig.functions.telegramMiniAppConfigured;
}

export function createMiniAppSwapPost(
  session: MiniAppSession,
  action: Exclude<MiniAppAction, "context">,
): SwapPost {
  return (body) => {
    const payload = Object.fromEntries(
      Object.entries(body).filter(([key]) => !scopeKeys.has(key)),
    );
    return postMiniApp(session, action, payload);
  };
}

export async function loadMiniAppContext(
  session: MiniAppSession,
  ruleId: string | null,
): Promise<MiniAppContextResult> {
  const response = await postMiniApp(
    session,
    "context",
    ruleId ? { ruleId } : {},
  );
  const value = response.value as Record<string, unknown>;
  if (!response.ok || value?.ok !== true || typeof value.agentName !== "string") {
    return {
      ok: false,
      message: readServerMessage(response.value) ??
        "Kyra could not open this agent. Open it again from the bot.",
    };
  }
  return {
    ok: true,
    agentName: value.agentName.slice(0, 80),
    rule: readRule(value.rule),
  };
}

export function readMiniAppLaunch(location: Pick<Location, "search" | "hash">) {
  const query = new URLSearchParams(location.search);
  const hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  const agentId = query.get("agent")?.toLowerCase() ?? "";
  const sell = query.get("sell");
  const amountAtomic = query.get("amount") ?? "";
  const ruleId = query.get("rule")?.toLowerCase() ?? null;
  return {
    initData: hash.get("tgWebAppData") ?? "",
    agentId: uuidPattern.test(agentId) ? agentId : "",
    sell: sell === "ETH" || sell === "USDG" ? sell as SwapTokenSymbol : null,
    amountAtomic: /^[1-9][0-9]{0,30}$/u.test(amountAtomic) ? amountAtomic : null,
    ruleId: ruleId && uuidPattern.test(ruleId) ? ruleId : null,
  };
}

function postMiniApp(
  session: MiniAppSession,
  action: MiniAppAction,
  payload: Record<string, unknown>,
) {
  return postBoundedJson(appConfig.functions.telegramMiniAppUrl, {
    Accept: "application/json",
    "Content-Type": "application/json",
    apikey: getSupabaseApiKey(),
  }, {
    initData: session.initData,
    agentId: session.agentId,
    action,
    payload,
  }, timeouts[action]);
}

function readRule(value: unknown): MiniAppRule | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const rule = value as Record<string, unknown>;
  const symbols = ["ETH", "USDG"];
  if (
    (rule.kind !== "dca" && rule.kind !== "stop_loss" && rule.kind !== "take_profit") ||
    typeof rule.sell !== "string" || !symbols.includes(rule.sell) ||
    typeof rule.buy !== "string" || !symbols.includes(rule.buy) ||
    rule.sell === rule.buy ||
    typeof rule.amountAtomic !== "string" || !/^[1-9][0-9]*$/u.test(rule.amountAtomic)
  ) return null;
  return {
    kind: rule.kind,
    sell: rule.sell as SwapTokenSymbol,
    buy: rule.buy as SwapTokenSymbol,
    amountAtomic: rule.amountAtomic,
  };
}
