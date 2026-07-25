import { existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const entrypoints = [
  "chain-action-prepare",
  "chain-status-provider",
  "deploy-agent",
  "remove-agent",
  "reset-demo-workspace",
  "telegram-connect",
  "telegram-dashboard-status",
  "telegram-disconnect",
  "telegram-link",
  "telegram-webhook",
  "transaction-result-closeout",
];

const expectedJwt = new Map([
  ["chain-action-prepare", true],
  ["chain-status-provider", false],
  ["remove-agent", true],
  ["telegram-connect", true],
  ["telegram-dashboard-status", true],
  ["telegram-disconnect", true],
  ["telegram-link", true],
  ["telegram-webhook", false],
  ["transaction-result-closeout", true],
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

const telegramGate = readFileSync(
  "supabase/functions/telegram-webhook/execution-gate.ts",
  "utf8",
);
for (const boundary of [
  "canExecuteFromTelegram: false",
  "canCreateDraftNow: false",
  "approval_draft_candidate",
  "Command rejected: Telegram cannot execute",
]) {
  if (!telegramGate.includes(boundary)) {
    throw new Error("Telegram execution boundary missing: " + boundary);
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

console.log("Current Robinhood and Telegram Edge Functions passed.");
