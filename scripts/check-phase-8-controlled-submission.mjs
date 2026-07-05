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
const model = read("src/types/phase8ControlledSubmission.ts");
const test = read("scripts/test-phase-8-controlled-submission.mjs");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx|js|jsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 25 production closeout.",
  "controlled transaction submission",
  "one-time submission nonce",
  "sanitized transaction hash reference",
  "owner-only result closeout",
  "ready_to_submit",
  "submitted_pending_confirmation",
  "closed_confirmed",
  "closed_failed",
  "src/types/phase8ControlledSubmission.ts",
  "scripts/test-phase-8-controlled-submission.mjs",
  "scripts/check-phase-8-controlled-submission.mjs",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "Batch 4 evidence",
  "controlled transaction submission",
  "one-time submission nonce",
  "owner-only result closeout",
  "sanitized transaction hash reference",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "export type Phase8ControlledSubmissionStatus",
  "export interface Phase8ControlledSubmissionIntent",
  "export interface Phase8ControlledSubmissionResultEvent",
  "evaluatePhase8ControlledSubmission",
  "ready_to_submit",
  "submitted_pending_confirmation",
  "closed_confirmed",
  "closed_failed",
  "submission_nonce_required",
  "submission_nonce_unused_required",
  "base_account_approval_required",
  "sanitized_tx_hash_required",
  "owner_only_result_required",
  "telegram_authority_forbidden",
  "public_visibility_forbidden",
]) {
  includes("Phase 8 submission model", model, expected);
}

for (const expected of [
  "Phase 8 controlled submission checks passed.",
  "ready_to_submit",
  "submitted_pending_confirmation",
  "closed_confirmed",
  "closed_failed",
  "submission_nonce_required",
  "submission_nonce_unused_required",
  "base_account_approval_required",
  "sanitized_tx_hash_required",
  "owner_only_result_required",
  "telegram_authority_forbidden",
  "public_visibility_forbidden",
]) {
  includes("Phase 8 submission test", test, expected);
}

for (const expected of [
  "evaluatePhase8ControlledSubmission",
  "phase8ControlledSubmission",
  "Phase 8 controlled submission",
  "submission nonce",
  "result closeout",
  "submit allowed",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-8-submission-panel",
  ".phase-8-submission-header",
  ".phase-8-submission-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  '"test:phase-8-submission"',
  '"check:phase-8-submission"',
  "check-phase-8-controlled-submission.mjs",
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8ControlledSubmission|phase8ControlledSubmission|sendTransaction|writeContract|eth_sendTransaction/u,
    "Phase 8 submission Telegram execution authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8ControlledSubmission|phase8ControlledSubmission|sendTransaction|writeContract|eth_sendTransaction/u,
    "Phase 8 submission public execution authority",
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

console.log("Phase 8 controlled submission checks passed.");
