import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const functionEntrypoints = [
  "supabase/functions/base-mcp-prepare/index.ts",
  "supabase/functions/deploy-agent/index.ts",
  "supabase/functions/official-mcp-oauth-callback/index.ts",
  "supabase/functions/official-mcp-oauth-start/index.ts",
  "supabase/functions/official-mcp-revoke/index.ts",
  "supabase/functions/official-mcp-status/index.ts",
  "supabase/functions/official-mcp-token-broker/index.ts",
  "supabase/functions/reset-demo-workspace/index.ts",
  "supabase/functions/telegram-connect/index.ts",
  "supabase/functions/telegram-dashboard-status/index.ts",
  "supabase/functions/telegram-disconnect/index.ts",
  "supabase/functions/telegram-link/index.ts",
  "supabase/functions/telegram-webhook/index.ts",
];

const expectedFunctionJwtVerification = new Map([
  ["functions.base-mcp-prepare", true],
  ["functions.telegram-connect", true],
  ["functions.telegram-dashboard-status", true],
  ["functions.telegram-disconnect", true],
  ["functions.telegram-link", true],
  ["functions.telegram-webhook", false],
]);

function readFunctionJwtVerification(configPath) {
  if (!existsSync(configPath)) {
    throw new Error(`${configPath} is required for Edge Function auth configuration.`);
  }

  const values = new Map();
  let currentSection = "";

  for (const line of readFileSync(configPath, "utf8").split(/\r?\n/u)) {
    const sectionMatch = line.match(/^\s*\[([^\]]+)\]\s*$/u);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    if (!expectedFunctionJwtVerification.has(currentSection)) {
      continue;
    }

    const verifyJwtMatch = line.match(
      /^\s*verify_jwt\s*=\s*(true|false)\s*(?:#.*)?$/u,
    );
    if (!verifyJwtMatch) {
      continue;
    }

    if (values.has(currentSection)) {
      throw new Error(`${currentSection} has duplicate verify_jwt configuration.`);
    }

    values.set(currentSection, verifyJwtMatch[1] === "true");
  }

  return values;
}

const functionJwtVerification = readFunctionJwtVerification("supabase/config.toml");

for (const [section, expected] of expectedFunctionJwtVerification) {
  if (functionJwtVerification.get(section) !== expected) {
    throw new Error(`${section} must set verify_jwt = ${expected}.`);
  }
}

const denoCandidates = [
  process.env.DENO_BIN,
  "deno",
  process.platform === "win32" ? "deno.exe" : undefined,
  process.env.USERPROFILE ? join(process.env.USERPROFILE, ".deno", "bin", "deno.exe") : undefined,
  process.env.HOME ? join(process.env.HOME, ".deno", "bin", "deno") : undefined,
].filter(Boolean);

function commandExists(command) {
  if (command.includes("/") || command.includes("\\")) {
    return existsSync(command);
  }

  const result = spawnSync(command, ["--version"], {
    encoding: "utf8",
    stdio: "ignore",
    shell: process.platform === "win32",
  });

  return result.status === 0;
}

const denoBin = denoCandidates.find(commandExists);

if (!denoBin) {
  console.error("Deno is required to check Supabase Edge Functions.");
  console.error("Install Deno, or set DENO_BIN to the deno executable path.");
  process.exit(1);
}

for (const entrypoint of functionEntrypoints) {
  const result = spawnSync(denoBin, ["check", entrypoint], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const telegramWebhookIndex = readFileSync(
  "supabase/functions/telegram-webhook/index.ts",
  "utf8",
);
const telegramExecutionGate = readFileSync(
  "supabase/functions/telegram-webhook/execution-gate.ts",
  "utf8",
);
const telegramExecutionGateDoc = readFileSync(
  "docs/phase-6-telegram-execution-gate.md",
  "utf8",
);

for (
  const boundary of [
    "reviewTelegramExecutionGate",
    'executionGate?.status !== "blocked"',
    'executionGate?.status !== "approval_draft_candidate"',
  ]
) {
  if (!telegramWebhookIndex.includes(boundary)) {
    throw new Error(`telegram-webhook index must include: ${boundary}`);
  }
}

for (
  const boundary of [
    "canExecuteFromTelegram: false",
    "canCreateDraftNow: false",
    "approval_draft_candidate",
    "Command rejected: Telegram cannot execute",
    "buildTelegramExecutionDraftReplayKey",
  ]
) {
  if (!telegramExecutionGate.includes(boundary)) {
    throw new Error(`telegram execution gate must include: ${boundary}`);
  }
}

for (
  const boundary of [
    "No Telegram-created approval records.",
    "No wallet prompts.",
    "No Base MCP calls.",
    "No transaction submission.",
  ]
) {
  if (!telegramExecutionGateDoc.includes(boundary)) {
    throw new Error(`telegram execution gate doc must include: ${boundary}`);
  }
}
