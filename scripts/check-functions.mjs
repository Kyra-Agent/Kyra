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

console.log("Current Robinhood and Telegram Edge Functions passed.");
