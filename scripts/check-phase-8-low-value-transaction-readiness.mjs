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
const model = read("src/types/phase8LowValueTransactionReadiness.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-8-low-value-transaction-readiness.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 25 production closeout.",
  "Batch 17 - Low-Value Transaction Readiness",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "Complete: controlled live transaction implementation closeout",
  "Batch 17 evidence",
  "src/types/phase8LowValueTransactionReadiness.ts",
  "scripts/test-phase-8-low-value-transaction-readiness.mjs",
  "scripts/check-phase-8-low-value-transaction-readiness.mjs",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "Product Snapshot",
  "Base Account",
]) {
  includes("README", readme, expected);
}

includes("context", context, "Controlled Live Transaction - implementation closeout complete through Batch 25 production closeout.");

for (const expected of [
  "evaluatePhase8LowValueTransactionReadiness",
  "maxValueWei: \"100000000000000\"",
  "maxValueLabel: \"0.0001 ETH\"",
  "value_cap_exceeded",
  "gas_balance_required",
  "calldata_forbidden",
  "token_approval_forbidden",
  "telegram_forbidden",
  "public_profile_forbidden",
]) {
  includes("low-value readiness model", model, expected);
}

for (const expected of [
  "evaluatePhase8LowValueTransactionReadiness",
  "phase8LowValueTransactionReadiness",
  "Low-value readiness",
  "phase-8-low-value-panel",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-8-low-value-panel",
  ".phase-8-low-value-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 8 low-value transaction readiness checks passed.",
  "ready_for_low_value_review",
  "value_cap_exceeded",
  "telegram_forbidden",
]) {
  includes("low-value readiness test", test, expected);
}

for (const expected of [
  '"test:phase-8-low-value-readiness"',
  '"check:phase-8-low-value-readiness"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8LowValueTransactionReadiness|phase8LowValueTransactionReadiness|phase-8-low-value/u,
    "Phase 8 low-value readiness in Telegram authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8LowValueTransactionReadiness|phase8LowValueTransactionReadiness|phase-8-low-value/u,
    "Phase 8 low-value readiness in public surfaces",
  );
}

console.log("Phase 8 low-value transaction readiness checks passed.");
