import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const entrypoints = [
  "chain-action-prepare",
  "chain-status-provider",
  "deploy-agent",
  "remove-agent",
  "reset-demo-workspace",
  "swap-execution-prepare",
  "swap-quote-prepare",
  "swap-result-closeout",
  "telegram-connect",
  "telegram-dashboard-status",
  "telegram-disconnect",
  "telegram-link",
  "telegram-webhook",
  "transaction-result-closeout",
  "transaction-intent-prepare",
];

const expectedJwt = new Map([
  ["chain-action-prepare", true],
  ["chain-status-provider", false],
  ["remove-agent", true],
  ["swap-execution-prepare", true],
  ["swap-quote-prepare", true],
  ["swap-result-closeout", true],
  ["telegram-connect", true],
  ["telegram-dashboard-status", true],
  ["telegram-disconnect", true],
  ["telegram-link", true],
  ["telegram-webhook", false],
  ["transaction-result-closeout", true],
  ["transaction-intent-prepare", true],
]);

const config = readFileSync("supabase/config.toml", "utf8");
for (const [name, value] of expectedJwt) {
  const section = "[functions." + name + "]";
  const start = config.indexOf(section);
  if (start < 0) throw new Error("Missing function config: " + name);
  const tail = config.slice(start, start + 300);
  if (!tail.includes("verify_jwt = " + value)) {
    throw new Error("Invalid JWT boundary for " + name);
  }
}

for (const name of entrypoints) {
  const path = "supabase/functions/" + name + "/index.ts";
  if (!existsSync(path)) throw new Error("Missing Edge Function: " + name);
  const result = spawnSync("deno", ["check", path], {
    stdio: "inherit",
    windowsHide: true,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}

const swapExecutionCore = readFileSync(
  "supabase/functions/swap-execution-prepare/core.ts",
  "utf8",
);
const swapExecutionFunction = readFileSync(
  "supabase/functions/swap-execution-prepare/index.ts",
  "utf8",
);
const swapCloseoutFunction = readFileSync(
  "supabase/functions/swap-result-closeout/index.ts",
  "utf8",
);
const swapReceiptVerifier = readFileSync(
  "supabase/functions/swap-result-closeout/receipt-verifier.ts",
  "utf8",
);
for (const boundary of [
  "createExactAllowanceTransaction",
  "fresh_quote_required",
  "allowance_revoke",
  "KYRA_PROTECTED_SWAP_EXECUTION_ENABLED",
  'executionScope: "private_account_wallet"',
]) {
  if (
    !swapExecutionCore.includes(boundary) &&
    !swapExecutionFunction.includes(boundary)
  ) {
    throw new Error("Protected swap execution boundary missing: " + boundary);
  }
}
for (const boundary of [
  "verifySwapExecutionReceipt",
  "nextSwapExecutionAction",
  'visibility: "owner-only"',
  "KYRA_PROTECTED_SWAP_EXECUTION_ENABLED",
  "normalizeCalldata",
  "reconcileSwapExecutionResultStatus",
  'insertError?.code === "23505"',
]) {
  if (
    !swapCloseoutFunction.includes(boundary) &&
    !swapReceiptVerifier.includes(boundary)
  ) {
    throw new Error("Protected swap closeout boundary missing: " + boundary);
  }
}

const swapQuoteMigration = readFileSync(
  "supabase/migrations/20260731120000_add_protected_swap_quote_lane.sql",
  "utf8",
);
const swapExecutionMigration = readFileSync(
  "supabase/migrations/20260731122000_add_protected_swap_execution_lane.sql",
  "utf8",
);
const swapExecutionVerifier = readFileSync(
  "supabase/migrations/20260731123000_verify_protected_swap_execution_lane.sql",
  "utf8",
);
const swapQuoteProvider = readFileSync(
  "supabase/functions/swap-quote-prepare/provider.ts",
  "utf8",
);
const swapQuoteFunction = readFileSync(
  "supabase/functions/swap-quote-prepare/index.ts",
  "utf8",
);
for (const boundary of [
  "https://api.0x.org/swap/allowance-holder/quote",
  'url.searchParams.set("chainId"',
  '"0x-api-key": config.apiKey',
  '"0x-version": "v2"',
  "allowedTransactionTargets",
  "allowedAllowanceTargets",
  "allowedLiquiditySources",
  "reviewTransactionEnvelope",
  "readAddressAllowlist",
  "readSourceAllowlist",
]) {
  if (!swapQuoteProvider.includes(boundary)) {
    throw new Error("Protected swap provider boundary missing: " + boundary);
  }
}
for (const boundary of [
  "KYRA_ZEROX_API_KEY",
  "KYRA_ZEROX_SWAP_ALLOWED_TARGETS",
  "KYRA_ZEROX_ALLOWANCE_ALLOWED_TARGETS",
  "KYRA_ZEROX_ALLOWED_SOURCES",
  "KYRA_ZEROX_TIMEOUT_MS",
]) {
  if (!swapQuoteFunction.includes(boundary)) {
    throw new Error("Protected swap provider config missing: " + boundary);
  }
}
const swapQualificationHarness = readFileSync(
  "scripts/protected-swap-provider-qualification.mjs",
  "utf8",
);
const swapQualificationCli = readFileSync(
  "scripts/qualify-protected-swap-provider.mjs",
  "utf8",
);
for (const boundary of [
  "https://api.0x.org/swap/allowance-holder/quote",
  '"0x-api-key": apiKey',
  '"0x-version": "v2"',
  'redirect: "error"',
  "readBoundedQualificationBody",
  "executionEnabled: false",
  'allowlistReview: issues.simulationIncomplete',
]) {
  if (!swapQualificationHarness.includes(boundary)) {
    throw new Error("Protected swap qualification boundary missing: " + boundary);
  }
}
for (const boundary of [
  "KYRA_PROTECTED_SWAP_EXECUTION_ENABLED",
  "VITE_KYRA_PROTECTED_SWAP_ENABLED",
  "qualification_requires_default_off_gates",
  "KYRA_ZEROX_QUALIFICATION_TAKER",
]) {
  if (!swapQualificationCli.includes(boundary)) {
    throw new Error("Protected swap qualification CLI gate missing: " + boundary);
  }
}
for (const boundary of [
  "enable row level security",
  "revoke all on table public.swap_quote_reviews",
  "grant select, insert on table public.swap_quote_reviews to service_role",
  "reject_swap_quote_review_mutation",
  "enforce_swap_quote_review_agent_scope",
]) {
  if (!swapQuoteMigration.includes(boundary)) {
    throw new Error("Protected swap quote migration boundary missing: " + boundary);
  }
}
for (const boundary of [
  "enable row level security",
  "prevent_swap_execution_intent_mutation",
  "old.status in ('confirmed', 'failed')",
  "new.receipt_block_number is distinct from old.receipt_block_number",
  "new.receipt_checked_at is distinct from old.receipt_checked_at",
  "swap execution terminal result immutability missing",
]) {
  if (
    !swapExecutionMigration.includes(boundary) &&
    !swapExecutionVerifier.includes(boundary)
  ) {
    throw new Error("Protected swap result migration boundary missing: " + boundary);
  }
}
const telegramGate = readFileSync(
  "supabase/functions/telegram-webhook/execution-gate.ts",
  "utf8",
);
for (const boundary of [
  "canExecuteFromTelegram: false",
  "canCreateDraftNow: false",
  "approval_draft_candidate",
  "Command rejected: Kyra never executes",
]) {
  if (!telegramGate.includes(boundary)) {
    throw new Error("Telegram execution boundary missing: " + boundary);
  }
}

const telegramWebhookFunction = readFileSync(
  "supabase/functions/telegram-webhook/index.ts",
  "utf8",
);
const telegramDeliveryRetryMigration = readFileSync(
  "supabase/migrations/20260726122000_telegram_delivery_retry.sql",
  "utf8",
);
const telegramDeliveryRetryVerifier = readFileSync(
  "supabase/migrations/20260726123000_verify_telegram_delivery_retry.sql",
  "utf8",
);
for (const boundary of [
  "markTelegramUpdateDelivered",
  "mark_telegram_update_delivered",
  "delivery_status",
  "lease_expires_at",
  "telegram_processed_updates_attempt_count_check",
  "telegram_processed_updates_retry_idx",
  "pg_advisory_xact_lock",
  "grant execute on function public.mark_telegram_update_delivered",
  "commit;",
]) {
  if (
    !telegramWebhookFunction.includes(boundary) &&
    !telegramDeliveryRetryMigration.includes(boundary)
  ) {
    throw new Error("Telegram delivery retry boundary missing: " + boundary);
  }
}
for (const boundary of [
  "telegram delivery retry columns missing",
  "telegram delivery metadata is publicly accessible",
  "telegram delivery retry service role access missing",
]) {
  if (!telegramDeliveryRetryVerifier.includes(boundary)) {
    throw new Error("Telegram delivery retry verifier missing: " + boundary);
  }
}

const intentFunction = readFileSync(
  "supabase/functions/transaction-intent-prepare/index.ts",
  "utf8",
);
const intentCore = readFileSync(
  "supabase/functions/transaction-intent-prepare/core.ts",
  "utf8",
);
for (const boundary of [
  "workspace_forbidden",
  "agent_transaction_locked",
  "createChainActionRateLimitChecker",
  "transaction_intent_rate_limited",
  'body.chainKey !== robinhoodMainnetChainKey',
  "isAllowedOwnerTransactionValueWei(body.valueWei)",
  "policyVersion: ownerTransactionPolicyVersion",
]) {
  if (
    !intentFunction.includes(boundary) && !intentCore.includes(boundary)
  ) {
    throw new Error("Transaction intent boundary missing: " + boundary);
  }
}

const dashboard = readFileSync("src/pages/Dashboard.tsx", "utf8");
for (const boundary of [
  "createTransactionIntentReviewNonce",
  "transactionIntentReviewNonce",
  "setTransactionIntentReviewNonce(createTransactionIntentReviewNonce())",
]) {
  if (!dashboard.includes(boundary)) {
    throw new Error("Transaction intent retry boundary missing: " + boundary);
  }
}

const closeoutFunction = readFileSync(
  "supabase/functions/transaction-result-closeout/index.ts",
  "utf8",
);
const closeoutCore = readFileSync(
  "supabase/functions/transaction-result-closeout/core.ts",
  "utf8",
);
const receiptVerifier = readFileSync(
  "supabase/functions/transaction-result-closeout/receipt-verifier.ts",
  "utf8",
);
for (const boundary of [
  "parseRpcQuantity(tx.value",
  "normalizeCalldata(tx.input)",
  "normalizeAddress(tx.from",
  "normalizeAddress(tx.to",
]) {
  if (!receiptVerifier.includes(boundary)) {
    throw new Error("Transaction receipt verification boundary missing: " + boundary);
  }
}
const closeoutMigration = readFileSync(
  "supabase/migrations/20260724130000_execution_result_closeout.sql",
  "utf8",
);
for (const boundary of [
  "workspace_forbidden",
  "agent_forbidden",
  "submission_key",
  'chain_key: "robinhood_mainnet"',
  'visibility: "owner-only"',
  "isStaleSubmittedResult",
  "intent.policy_version === ownerTransactionPolicyVersion",
]) {
  if (!closeoutFunction.includes(boundary) && !closeoutCore.includes(boundary)) {
    throw new Error("Transaction closeout boundary missing: " + boundary);
  }
}
for (const boundary of [
  "execution_results_status_fields_check",
  "unique (chain_id, tx_hash)",
  "enforce_execution_result_scope_on_write",
  "grant select on public.execution_results to authenticated",
  "grant all on public.execution_results to service_role",
]) {
  if (!closeoutMigration.includes(boundary)) {
    throw new Error("Transaction closeout database boundary missing: " + boundary);
  }
}

// The official KYRA contract stays unpublished until the Robinhood Chain
// relaunch. Test fixtures may configure a synthetic address, but no product
// module may import the fixture or call the test-only override.
const retiredKyraContract = ["0xa2d99db0593ffd57ae9b", "92103515bba061fa5ec1"]
  .join("");
const testOnlyTokenHooks = [
  "configureOfficialKyraTokenAddressForTests",
  "official-token-test-fixture",
];
const tokenHookDefinitions = new Set([
  "src/config/transferTransactionPolicy.ts",
  "supabase/functions/_shared/transfer-transaction-policy.ts",
  "supabase/functions/_shared/official-token-test-fixture.ts",
]);
const productSources = spawnSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "src", "supabase/functions"],
  { encoding: "utf8", windowsHide: true },
);
if (productSources.status !== 0) {
  throw new Error("Unable to list product sources for the official token check.");
}
for (const path of productSources.stdout.split(/\r?\n/u).filter(Boolean)) {
  if (!/\.(?:ts|tsx)$/u.test(path) || !existsSync(path)) continue;
  const source = readFileSync(path, "utf8");
  if (source.toLowerCase().includes(retiredKyraContract)) {
    throw new Error("Retired KYRA contract address found in " + path);
  }
  if (path.endsWith("_test.ts") || tokenHookDefinitions.has(path)) continue;
  for (const hook of testOnlyTokenHooks) {
    if (source.includes(hook)) {
      throw new Error("Test-only official token hook used by product code: " + path);
    }
  }
}
for (
  const path of [
    "src/config/transferTransactionPolicy.ts",
    "supabase/functions/_shared/transfer-transaction-policy.ts",
  ]
) {
  if (
    !readFileSync(path, "utf8").includes(
      "export const publishedOfficialKyraTokenAddress = null as EvmAddress | null;",
    )
  ) {
    throw new Error("Official KYRA contract must remain unpublished in " + path);
  }
}

console.log("Current Robinhood and Telegram Edge Functions passed.");
