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
const component = read("src/components/Phase8LowValueSubmitter.tsx");
const config = read("src/config/appConfig.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-8-low-value-submitter-gate.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 20 live balance and gas readiness.",
  "Batch 19 - Isolated Low-Value Submitter Gate",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "In progress: Batch 20",
  "Batch 19 evidence",
  "src/components/Phase8LowValueSubmitter.tsx",
  "scripts/test-phase-8-low-value-submitter-gate.mjs",
  "scripts/check-phase-8-low-value-submitter-gate.mjs",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "| 8 | In progress: controlled live transaction Batch 20 |",
  "live balance and gas readiness",
]) {
  includes("README", readme, expected);
}

includes("context", context, "Controlled Live Transaction - in progress through Batch 20 live balance and gas readiness.");

for (const expected of [
  "Phase8LowValueSubmitter",
  "phase8LowValueSubmission === \"owner_low_value_window\"",
  "sendTransaction.sendTransactionAsync(submitRequest.request)",
  "createPhase8SubmittedCloseoutEvent",
  "onResultCloseout?.(closeout.event)",
]) {
  includes("low-value submitter component", component, expected);
}

for (const expected of [
  "VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION",
  "phase8LowValueSubmission: phase8LowValueSubmissionRuntime",
]) {
  includes("appConfig", config, expected);
}

for (const expected of [
  "Phase8LowValueSubmitter",
  "phase8LowValueSubmitRequest",
  "phase8LowValueTransactionReadiness",
  "onResultCloseout={handlePhase8ResultCloseout}",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-8-low-value-submitter",
  ".phase-8-low-value-submitter-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 8 low-value submitter gate checks passed.",
  "owner_low_value_window",
]) {
  includes("low-value submitter test", test, expected);
}

for (const expected of [
  '"test:phase-8-low-value-submitter"',
  '"check:phase-8-low-value-submitter"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /Phase8LowValueSubmitter|phase8LowValueSubmission|owner_low_value_window|phase-8-low-value-submitter/u,
    "Phase 8 low-value submitter in Telegram authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /Phase8LowValueSubmitter|phase8LowValueSubmission|owner_low_value_window|phase-8-low-value-submitter/u,
    "Phase 8 low-value submitter in public surfaces",
  );
}

console.log("Phase 8 low-value submitter gate checks passed.");
