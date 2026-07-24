import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function includes(sourceName, source, text) {
  assert(source.includes(text), `${sourceName} must include: ${text}`);
}

function excludes(sourceName, source, pattern, label) {
  assert(!pattern.test(source), `${sourceName} must not include ${label}`);
}

function walkFiles(path) {
  const absolutePath = resolve(root, path);
  const stat = statSync(absolutePath);

  if (stat.isFile()) {
    return [path];
  }

  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = `${path}/${entry.name}`;

    if (entry.isDirectory()) {
      return walkFiles(childPath);
    }

    return entry.isFile() ? [childPath] : [];
  });
}

const doc = read("docs/controlled-execution-launch-packet.md");
const freezeCheckpoint = read("docs/production-smoke-freeze-checkpoint.md");
const roadmap = read("docs/product-phase-roadmap.md");
const typeModel = read("src/types/executionLaunchReadiness.ts");
const typeTest = read("scripts/test-execution-launch-readiness.mjs");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|js|jsx)$/u.test(path)
);
const telegramRuntimeFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));

for (
  const required of [
    "# Controlled Execution Launch Packet",
    "Status: implemented as an owner-only readiness packet.",
    "This is not a new product phase",
    "Base Account remains the primary transaction lane.",
    "Official hosted Base MCP remains optional and disabled while provider evidence",
    "wallet execution runtime disabled",
    "wallet signing runtime disabled",
    "transaction submission runtime disabled",
    "User wallet authority and Telegram bot-token privacy remain the top security",
    "owner_approved_runtime_still_disabled",
    "npm run check:execution-launch-readiness",
  ]
) {
  includes("controlled execution launch packet", doc, required);
}

includes(
  "controlled execution launch packet",
  doc,
  "docs/production-smoke-freeze-checkpoint.md",
);

for (
  const required of [
    "# Production Smoke Freeze Checkpoint",
    "Status: frozen after owner production smoke.",
    "Owner production smoke passed with an existing deployed agent.",
    "Base Account connection can be initiated by owner click",
    "Base Account disconnect returns to the clean ready state",
    "wallet signing prompt did not open",
    "transaction submission prompt did not open",
    "token approval prompt did not open",
    "Execution launch packet remained disabled or blocked",
    "This freeze does not authorize live execution.",
    "Do not bypass the frozen boundary just because connect/disconnect works.",
  ]
) {
  includes("production smoke freeze checkpoint", freezeCheckpoint, required);
}

for (
  const required of [
    "export type ExecutionLaunchReadinessStatus",
    "export type ExecutionLaunchReadinessBlockReason",
    "export interface ExecutionLaunchReadinessInput",
    "export interface ExecutionLaunchReadinessResult",
    "evaluateExecutionLaunchReadiness",
    "baseAccountPrimaryLane: true",
    "officialMcpRequired: false",
    "walletPromptAllowed: false",
    "walletSigningAllowed: false",
    "transactionSubmissionAllowed: false",
    "official_mcp_must_remain_optional_or_disabled",
    "telegram_execution_must_remain_disabled",
    "public_execution_must_remain_hidden",
    "wallet_runtime_must_remain_disabled",
    "signing_runtime_must_remain_disabled",
    "submission_runtime_must_remain_disabled",
  ]
) {
  includes("execution launch model", typeModel, required);
}

for (
  const required of [
    "ready_for_owner_launch_decision",
    "owner_approved_runtime_still_disabled",
    "official_mcp_must_remain_optional_or_disabled",
    "telegram_execution_must_remain_disabled",
    "wallet_runtime_must_remain_disabled",
    "Execution launch readiness checks passed.",
  ]
) {
  includes("execution launch test", typeTest, required);
}

for (
  const required of [
    "evaluateExecutionLaunchReadiness",
    "executionLaunchReadiness",
    "Execution launch packet",
    "currentWalletDisplayName",
    "optional disabled",
    "wallet prompt, signing, and submission",
  ]
) {
  includes("dashboard", dashboard, required);
}

for (
  const required of [
    ".execution-launch-panel",
    ".execution-launch-header",
    ".execution-launch-grid",
  ]
) {
  includes("styles", styles, required);
}

for (
  const required of [
    '"test:execution-launch-readiness"',
    '"check:execution-launch-readiness"',
    "npm run check:execution-launch-readiness",
  ]
) {
  includes("package.json", packageJson, required);
}

includes(
  "roadmap",
  roadmap,
  "Controlled execution launch packet: `docs/controlled-execution-launch-packet.md`",
);
includes(
  "roadmap",
  roadmap,
  "It does not enable wallet prompt, signing, submission, or official MCP tools.",
);

for (const path of sourceFiles) {
  const source = read(path);
  excludes(
    path,
    source,
    /VITE_.*(?:SERVICE_ROLE|PRIVATE_KEY|BOT_TOKEN|OPENROUTER|AGENT_BRAIN_API_KEY)/u,
    "frontend secret env exposure",
  );
}

for (const path of telegramRuntimeFiles) {
  const source = read(path);
  excludes(
    path,
    source,
    /evaluateExecutionLaunchReadiness|executionLaunchReadiness|sendTransaction|writeContract|eth_sendTransaction/u,
    "Telegram execution launch authority",
  );
}

excludes(
  "execution launch model",
  typeModel,
  /sendTransaction|writeContract|eth_sendTransaction|signMessage|signTypedData|fetch\(|localStorage|sessionStorage/u,
  "wallet/provider/browser side effects",
);

console.log("Controlled execution launch packet checks passed.");
