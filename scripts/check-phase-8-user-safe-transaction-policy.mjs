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
const readme = read("README.md");
const context = read("docs/kyra-agent-context.md");
const model = read("src/types/phase8UserSafeTransactionPolicy.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-8-user-safe-transaction-policy.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 21 first controlled low-value live run.",
  "Batch 16 - User-Safe Transaction Policy",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "In progress: Batch 21",
  "Batch 16 evidence",
  "src/types/phase8UserSafeTransactionPolicy.ts",
  "scripts/test-phase-8-user-safe-transaction-policy.mjs",
  "scripts/check-phase-8-user-safe-transaction-policy.mjs",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "| 8 | In progress: controlled live transaction Batch 21 |",
  "live balance and gas readiness",
]) {
  includes("README", readme, expected);
}

includes("context", context, "Controlled Live Transaction - in progress through Batch 21 first controlled low-value live run.");

for (const expected of [
  "evaluatePhase8UserSafeTransactionPolicy",
  "maxValueWei: \"0\"",
  "non_zero_value_forbidden",
  "calldata_forbidden",
  "token_approval_forbidden",
  "telegram_forbidden",
  "public_profile_forbidden",
]) {
  includes("user-safe policy model", model, expected);
}

for (const expected of [
  "evaluatePhase8UserSafeTransactionPolicy",
  "phase8UserSafeTransactionPolicy",
  "Phase 8 user-safe policy",
  "phase-8-user-policy-panel",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-8-user-policy-panel",
  ".phase-8-user-policy-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 8 user-safe transaction policy checks passed.",
  "ready_for_owner_review",
  "non_zero_value_forbidden",
  "telegram_forbidden",
]) {
  includes("user-safe policy test", test, expected);
}

for (const expected of [
  '"test:phase-8-user-safe-policy"',
  '"check:phase-8-user-safe-policy"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8UserSafeTransactionPolicy|phase8UserSafeTransactionPolicy|phase-8-user-policy/u,
    "Phase 8 user-safe policy in Telegram authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8UserSafeTransactionPolicy|phase8UserSafeTransactionPolicy|phase-8-user-policy/u,
    "Phase 8 user-safe policy in public surfaces",
  );
}

console.log("Phase 8 user-safe transaction policy checks passed.");
