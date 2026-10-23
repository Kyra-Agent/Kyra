// Pure pieces of agent-trade-rules: reading the request and shaping rule
// rows for the dashboard. Rules are created from Telegram (/dca, /stoploss,
// /takeprofit); the dashboard lists them and can pause, resume, or delete one.

export class HttpError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export const tradeRuleActions = ["list", "pause", "resume", "delete"] as const;
export type TradeRuleAction = typeof tradeRuleActions[number];

export interface TradeRulesRequest {
  agentId: string;
  action: TradeRuleAction;
  ruleId: string | null;
}

export interface TradeRuleView {
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

export const tradeRuleColumns =
  "id,kind,sell_token_symbol,buy_token_symbol,sell_amount_atomic,interval_hours,trigger_price_usd,next_run_at,last_triggered_at,enabled,created_at";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function assertTradeRulesRequest(value: unknown): TradeRulesRequest {
  if (!isRecord(value)) throw invalidRequest();
  const keys = Object.keys(value).sort().join(",");
  const action = value.action;
  if (
    typeof action !== "string" || !tradeRuleActions.includes(action as TradeRuleAction) ||
    typeof value.agentId !== "string" || !uuidPattern.test(value.agentId)
  ) {
    throw invalidRequest();
  }
  if (action === "list") {
    if (keys !== "action,agentId") throw invalidRequest();
    return { agentId: value.agentId.toLowerCase(), action, ruleId: null };
  }
  if (
    keys !== "action,agentId,ruleId" ||
    typeof value.ruleId !== "string" || !uuidPattern.test(value.ruleId)
  ) {
    throw invalidRequest();
  }
  return {
    agentId: value.agentId.toLowerCase(),
    action: action as TradeRuleAction,
    ruleId: value.ruleId.toLowerCase(),
  };
}

// The agent must exist and sit in a workspace the caller owns. Anything else
// is reported as not found so other accounts' agents are never confirmed.
export function assertOwnedAgent(agent: unknown, workspaceOwnerId: unknown, userId: string) {
  if (!isRecord(agent) || typeof agent.id !== "string" || workspaceOwnerId !== userId) {
    throw new HttpError(404, "agent_not_found", "This agent was not found in your workspace.");
  }
  return { id: agent.id };
}

export function readTradeRuleRows(rows: unknown): TradeRuleView[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!isRecord(row)) return [];
    const kind = row.kind;
    const sell = row.sell_token_symbol;
    const buy = row.buy_token_symbol;
    if (
      (kind !== "dca" && kind !== "stop_loss" && kind !== "take_profit") ||
      (sell !== "ETH" && sell !== "USDG") || (buy !== "ETH" && buy !== "USDG") ||
      typeof row.id !== "string" || typeof row.sell_amount_atomic !== "string" ||
      typeof row.enabled !== "boolean" || typeof row.created_at !== "string"
    ) return [];
    return [{
      id: row.id,
      kind,
      sell,
      buy,
      amountAtomic: row.sell_amount_atomic,
      intervalHours: typeof row.interval_hours === "number" ? row.interval_hours : null,
      triggerPriceUsd: row.trigger_price_usd === null || row.trigger_price_usd === undefined
        ? null
        : String(row.trigger_price_usd),
      nextRunAt: typeof row.next_run_at === "string" ? row.next_run_at : null,
      lastTriggeredAt: typeof row.last_triggered_at === "string" ? row.last_triggered_at : null,
      enabled: row.enabled,
      createdAt: row.created_at,
    }];
  });
}

// Maps the database function's answer to what the owner sees.
export function describeRuleChange(action: Exclude<TradeRuleAction, "list">, result: unknown) {
  if (result === "not_found") {
    throw new HttpError(404, "rule_not_found", "This rule no longer exists.");
  }
  if (result === "limit_reached") {
    throw new HttpError(
      409,
      "rule_limit_reached",
      "An agent can run up to 5 rules at once. Pause or delete one first.",
    );
  }
  if (action === "delete" && result === "deleted") return "Rule deleted.";
  if (action === "pause" && (result === "paused" || result === "unchanged")) return "Rule paused.";
  if (action === "resume" && (result === "resumed" || result === "unchanged")) {
    return "Rule resumed. Kyra sends the next swap prompt in Telegram when it is due.";
  }
  throw new Error("Unexpected trade rule result.");
}

function invalidRequest() {
  return new HttpError(400, "invalid_request", "The trade rule request is invalid.");
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
