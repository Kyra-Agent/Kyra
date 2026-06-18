import {
  baseChainId,
  validateUnsignedTransactionHandoff,
  type WalletUnsignedTransactionHandoff,
  type WalletUnsignedTransactionHandoffValidation,
} from "./unsignedTransactionHandoff";

export type RiskReviewLevel =
  | "read-only"
  | "low"
  | "medium"
  | "high"
  | "blocked";
export type RiskReviewStatus = "ready" | "review_required" | "blocked";
export type RiskPermission =
  | "read_context"
  | "wallet_prompt"
  | "token_spend"
  | "contract_call"
  | "unknown";

export interface RiskReviewResult {
  level: RiskReviewLevel;
  status: RiskReviewStatus;
  explicitApprovalRequired: boolean;
  permissions: RiskPermission[];
  checks: string[];
  refusalReason: string | null;
  safetyCopy: string;
}

export interface PreparedActionRiskInput {
  actionKind: string;
  chainId: unknown;
  routeSummary: string;
  valueSummary: string;
  valueWei: string;
  data: string;
  requiresWallet: boolean;
  declaredRisk?: "low" | "medium" | "high";
  validation?: WalletUnsignedTransactionHandoffValidation;
}

const supportedPreparedActionKinds = new Set([
  "base_mcp_status_check",
  "base_reviewed_transaction",
]);

const signablePreparedActionKinds = new Set(["base_reviewed_transaction"]);

export function reviewPreparedActionRisk(
  input: PreparedActionRiskInput,
): RiskReviewResult {
  if (!supportedPreparedActionKinds.has(input.actionKind)) {
    return blockedRiskReview("Unsupported action type. Kyra fails closed.");
  }

  if (input.actionKind === "base_mcp_status_check") {
    return {
      level: "read-only",
      status: "ready",
      explicitApprovalRequired: false,
      permissions: ["read_context"],
      checks: [
        "Read-only Base MCP status check.",
        "No wallet prompt.",
        "No token spend.",
        "No calldata.",
      ],
      refusalReason: null,
      safetyCopy: "Read-only context is safe to review. Nothing can be signed.",
    };
  }

  if (!signablePreparedActionKinds.has(input.actionKind)) {
    return blockedRiskReview("Action is not signable in Phase 6.");
  }

  if (input.validation && !input.validation.ok) {
    return blockedRiskReview(
      input.validation.reason ?? "Prepared action is invalid.",
    );
  }

  if (input.chainId !== baseChainId) {
    return blockedRiskReview("Prepared action must target Base.");
  }

  const permissions = getRiskPermissions(input);
  const checks = [
    "NYX-05 review required before wallet prompt.",
    "Route, chain, value, and expiry must be visible.",
    "Owner approval is required before any wallet prompt.",
  ];
  const hasTokenSpend = permissions.includes("token_spend");
  const hasContractCall = permissions.includes("contract_call");
  const heuristicLevel: RiskReviewLevel = hasTokenSpend && hasContractCall
    ? "high"
    : hasTokenSpend || hasContractCall
    ? "medium"
    : "low";
  const level = maxRiskLevel(heuristicLevel, input.declaredRisk ?? "low");

  return {
    level,
    status: level === "low" ? "ready" : "review_required",
    explicitApprovalRequired: true,
    permissions,
    checks,
    refusalReason: null,
    safetyCopy:
      "Wallet execution remains disabled. This review only prepares owner-visible context.",
  };
}

export function reviewUnsignedTransactionHandoff(
  handoff: WalletUnsignedTransactionHandoff,
  validation = validateUnsignedTransactionHandoff(handoff),
): RiskReviewResult {
  return reviewPreparedActionRisk({
    actionKind: handoff.actionKind,
    chainId: handoff.chainId,
    routeSummary: handoff.routeSummary,
    valueSummary: handoff.valueSummary,
    valueWei: handoff.valueWei,
    data: handoff.data,
    requiresWallet: true,
    declaredRisk: handoff.risk,
    validation,
  });
}

function getRiskPermissions(input: PreparedActionRiskInput): RiskPermission[] {
  const permissions = new Set<RiskPermission>(["wallet_prompt"]);

  const spendSurface = `${input.routeSummary} ${input.valueSummary}`.replace(
    /no token spend/gi,
    "",
  );

  if (
    isPositiveWei(input.valueWei) ||
    /spend|send|swap|transfer|->/i.test(spendSurface)
  ) {
    permissions.add("token_spend");
  }

  if (
    input.data !== "0x" ||
    /contract|calldata|approval/i.test(input.routeSummary)
  ) {
    permissions.add("contract_call");
  }

  return [...permissions];
}

function isPositiveWei(value: string) {
  return /^(?:[1-9]\d*)$/u.test(value);
}

function maxRiskLevel(
  left: Exclude<RiskReviewLevel, "read-only" | "blocked">,
  right: Exclude<RiskReviewLevel, "read-only" | "blocked">,
) {
  const score = {
    low: 1,
    medium: 2,
    high: 3,
  };

  return score[left] >= score[right] ? left : right;
}

function blockedRiskReview(reason: string): RiskReviewResult {
  return {
    level: "blocked",
    status: "blocked",
    explicitApprovalRequired: false,
    permissions: ["unknown"],
    checks: [
      "Unsupported or invalid action.",
      "No wallet prompt.",
      "No signing.",
      "No transaction submission.",
    ],
    refusalReason: reason,
    safetyCopy: "Kyra blocks this action before any wallet prompt can open.",
  };
}
