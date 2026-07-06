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

function includes(label, source, expected) {
  assert(source.includes(expected), `${label} must include: ${expected}`);
}

function excludes(label, source, pattern, description) {
  assert(!pattern.test(source), `${label} must not include ${description}`);
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

const doc = read("docs/phase-8-controlled-live-transaction.md");
const roadmap = read("docs/product-phase-roadmap.md");
const model = read("src/types/phase8ControlledExecution.ts");
const test = read("scripts/test-phase-8-controlled-execution.mjs");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) =>
  /\.(?:ts|tsx|js|jsx)$/u.test(path)
);
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) =>
  /Public|AgentProfile|public/i.test(path)
);

for (
  const expected of [
    "# Phase 8 Controlled Live Transaction",
    "Runtime execution remains default-off.",
    "zero-value transaction",
    "no calldata",
    "explicit Kyra approval",
    "explicit Base Account approval",
    "No swap, token approval, token spend",
    "Phase 8 runtime enablement must be explicitly enabled",
    "src/types/phase8ControlledExecution.ts",
    "scripts/test-phase-8-controlled-execution.mjs",
    "scripts/check-phase-8-controlled-execution.mjs",
    "ready_for_owner_wallet_prompt",
    "transactionSubmissionAllowed: true",
    "User wallet authority and user Telegram bot-token privacy remain priority",
  ]
) {
  includes("Phase 8 doc", doc, expected);
}

for (
  const expected of [
    "## Phase 8 - Controlled Live Transaction",
    "one low-risk prepared action",
    "explicit Kyra approval",
    "explicit Base Account approval",
    "owner-only result",
  ]
) {
  includes("roadmap", roadmap, expected);
}

for (
  const expected of [
    "export type Phase8ControlledExecutionStatus",
    "export type Phase8ControlledExecutionBlockReason",
    "export interface Phase8ControlledExecutionInput",
    "export interface Phase8ControlledExecutionResult",
    "evaluatePhase8ControlledExecution",
    "ready_for_owner_wallet_prompt",
    "wallet_prompt_opened",
    "submitted_pending_confirmation",
    "runtime_enablement_required",
    "owner_click_required",
    "zero_value_action_required",
    "no_calldata_required",
    "telegram_authority_forbidden",
    "public_visibility_forbidden",
    "baseAccountPrimaryLane: true",
    "officialMcpRequired: false",
  ]
) {
  includes("Phase 8 model", model, expected);
}

for (
  const expected of [
    "Phase 8 controlled execution checks passed.",
    "ready_for_owner_wallet_prompt",
    "wallet_prompt_opened",
    "submitted_pending_confirmation",
    "closed_confirmed",
    "runtime_enablement_required",
    "owner_click_required",
    "zero_value_action_required",
    "no_calldata_required",
    "telegram_authority_forbidden",
    "public_visibility_forbidden",
  ]
) {
  includes("Phase 8 test", test, expected);
}

for (
  const expected of [
    "evaluatePhase8ControlledExecution",
    "phase8ControlledExecution",
    "Owner-controlled execution",
    "ready for wallet prompt",
    "locked",
  ]
) {
  includes("dashboard", dashboard, expected);
}

for (
  const expected of [
    ".phase-8-execution-panel",
    ".phase-8-execution-header",
    ".phase-8-execution-grid",
  ]
) {
  includes("styles", styles, expected);
}

for (
  const expected of [
    '"test:phase-8"',
    '"check:phase-8"',
    "check-phase-8-controlled-execution.mjs",
  ]
) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8ControlledExecution|phase8ControlledExecution|sendTransaction|writeContract|eth_sendTransaction/u,
    "Phase 8 Telegram execution authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8ControlledExecution|phase8ControlledExecution|sendTransaction|writeContract|eth_sendTransaction/u,
    "Phase 8 public execution authority",
  );
}

for (const path of sourceFiles) {
  const source = read(path);

  if (path === "src/providers/WalletRuntimeProviders.tsx" || path === "src/components/Phase8ControlledSubmitter.tsx" || path === "src/components/Phase8LowValueSubmitter.tsx") {
    continue;
  }

  excludes(
    path,
    source,
    /sendTransaction|writeContract|eth_sendTransaction|signMessage|signTypedData/u,
    "direct wallet execution calls outside isolated provider boundary",
  );
}

console.log("Phase 8 controlled execution checks passed.");
