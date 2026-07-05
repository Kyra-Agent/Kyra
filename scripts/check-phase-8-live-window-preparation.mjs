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
const model = read("src/types/phase8LiveWindowPreparation.ts");
const test = read("scripts/test-phase-8-live-window-preparation.mjs");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx|js|jsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 15 controlled smoke closeout hardening.",
  "owner-approved live window",
  "private owner dashboard",
  "execute intent",
  "Frozen action binding",
  "Base Account prompt readiness",
  "ready_for_wallet_prompt",
  "wallet_prompt_opened",
  "wallet_prompt_approved",
  "transaction submission remains disabled",
  "src/types/phase8LiveWindowPreparation.ts",
  "scripts/test-phase-8-live-window-preparation.mjs",
  "scripts/check-phase-8-live-window-preparation.mjs",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "Batch 2 evidence",
  "live-window preparation guard",
  "owner-approved live window",
  "private dashboard execute intent",
  "frozen action binding",
  "Base Account prompt readiness",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "export type Phase8LiveWindowStatus",
  "export type Phase8ExecuteIntentSource",
  "export interface Phase8LiveWindowPreparationInput",
  "export interface Phase8LiveWindowPreparationResult",
  "evaluatePhase8LiveWindowPreparation",
  "ready_for_wallet_prompt",
  "wallet_prompt_opened",
  "wallet_prompt_approved",
  "owner_match_required",
  "workspace_match_required",
  "selected_agent_match_required",
  "base_chain_required",
  "live_window_expired",
  "live_window_revoked",
  "private_dashboard_intent_required",
  "telegram_authority_forbidden",
  "public_visibility_forbidden",
  "transactionSubmissionAllowed: false",
]) {
  includes("Phase 8 live-window model", model, expected);
}

for (const expected of [
  "Phase 8 live-window preparation checks passed.",
  "ready_for_wallet_prompt",
  "wallet_prompt_opened",
  "wallet_prompt_approved",
  "live_window_expired",
  "live_window_revoked",
  "owner_match_required",
  "selected_agent_match_required",
  "base_chain_required",
  "telegram_authority_forbidden",
  "public_visibility_forbidden",
  "base_account_prompt_ready_required",
]) {
  includes("Phase 8 live-window test", test, expected);
}

for (const expected of [
  "evaluatePhase8LiveWindowPreparation",
  "phase8LiveWindowPreparation",
  "Phase 8 live window",
  "owner-approved window",
  "private dashboard intent",
  "prompt readiness",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-8-live-window-panel",
  ".phase-8-live-window-header",
  ".phase-8-live-window-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  '"test:phase-8-live-window"',
  '"check:phase-8-live-window"',
  "check-phase-8-live-window-preparation.mjs",
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8LiveWindowPreparation|phase8LiveWindowPreparation|sendTransaction|writeContract|eth_sendTransaction/u,
    "Phase 8 live-window Telegram execution authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8LiveWindowPreparation|phase8LiveWindowPreparation|sendTransaction|writeContract|eth_sendTransaction/u,
    "Phase 8 live-window public execution authority",
  );
}

for (const path of sourceFiles) {
  const source = read(path);

  if (path === "src/providers/WalletRuntimeProviders.tsx" || path === "src/components/Phase8ControlledSubmitter.tsx") {
    continue;
  }

  excludes(
    path,
    source,
    /sendTransaction|writeContract|eth_sendTransaction|signMessage|signTypedData/u,
    "direct wallet execution calls outside isolated provider boundary",
  );
}

console.log("Phase 8 live-window preparation checks passed.");
