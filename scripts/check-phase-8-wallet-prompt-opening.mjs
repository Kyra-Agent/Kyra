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
const model = read("src/types/phase8WalletPromptOpening.ts");
const test = read("scripts/test-phase-8-wallet-prompt-opening.mjs");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx|js|jsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 17 low-value transaction readiness hardening.",
  "controlled wallet prompt opening",
  "one-time prompt nonce",
  "owner-click Base Account prompt",
  "owner-only prompt audit",
  "ready_to_open_prompt",
  "prompt_opened",
  "prompt_approved",
  "prompt_rejected",
  "prompt_failed",
  "transactionSubmissionAllowed: false",
  "src/types/phase8WalletPromptOpening.ts",
  "scripts/test-phase-8-wallet-prompt-opening.mjs",
  "scripts/check-phase-8-wallet-prompt-opening.mjs",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "Batch 3 evidence",
  "controlled wallet prompt opening",
  "one-time prompt nonce",
  "owner-only prompt audit",
  "transaction submission remains disabled",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "export type Phase8WalletPromptOpeningStatus",
  "export type Phase8WalletPromptState",
  "export interface Phase8WalletPromptIntent",
  "export interface Phase8WalletPromptAuditEvent",
  "evaluatePhase8WalletPromptOpening",
  "ready_to_open_prompt",
  "prompt_opened",
  "prompt_approved",
  "prompt_rejected",
  "prompt_failed",
  "one_time_prompt_nonce_required",
  "one_time_prompt_nonce_unused_required",
  "owner_only_audit_required",
  "sanitized_audit_required",
  "telegram_authority_forbidden",
  "public_visibility_forbidden",
  "transactionSubmissionAllowed: false",
]) {
  includes("Phase 8 prompt model", model, expected);
}

for (const expected of [
  "Phase 8 wallet prompt opening checks passed.",
  "ready_to_open_prompt",
  "prompt_opened",
  "prompt_approved",
  "prompt_rejected",
  "prompt_failed",
  "one_time_prompt_nonce_required",
  "one_time_prompt_nonce_unused_required",
  "frozen_action_binding_required",
  "owner_only_audit_required",
  "sanitized_audit_required",
  "telegram_authority_forbidden",
  "public_visibility_forbidden",
]) {
  includes("Phase 8 prompt test", test, expected);
}

for (const expected of [
  "evaluatePhase8WalletPromptOpening",
  "phase8WalletPromptOpening",
  "Phase 8 wallet prompt opening",
  "one-time nonce",
  "owner-only audit",
  "open allowed",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-8-wallet-prompt-panel",
  ".phase-8-wallet-prompt-header",
  ".phase-8-wallet-prompt-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  '"test:phase-8-wallet-prompt"',
  '"check:phase-8-wallet-prompt"',
  "check-phase-8-wallet-prompt-opening.mjs",
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8WalletPromptOpening|phase8WalletPromptOpening|sendTransaction|writeContract|eth_sendTransaction/u,
    "Phase 8 wallet prompt Telegram execution authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8WalletPromptOpening|phase8WalletPromptOpening|sendTransaction|writeContract|eth_sendTransaction/u,
    "Phase 8 wallet prompt public execution authority",
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

console.log("Phase 8 wallet prompt opening checks passed.");
