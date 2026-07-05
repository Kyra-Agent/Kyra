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
const model = read("src/types/phase8UserExecutionFlow.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-8-user-execution-flow.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 23 user-facing execution flow.",
  "Batch 23 - User-Facing Execution Flow",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "In progress: Batch 23",
  "Batch 23 evidence",
  "src/types/phase8UserExecutionFlow.ts",
  "scripts/test-phase-8-user-execution-flow.mjs",
  "scripts/check-phase-8-user-execution-flow.mjs",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "| 8 | In progress: controlled live transaction Batch 23 |",
  "user-facing execution flow",
]) {
  includes("README", readme, expected);
}

for (const expected of [
  "evaluatePhase8UserExecutionFlow",
  "ready_to_submit",
  "telegram_execution_forbidden",
  "public_visibility_forbidden",
  "ownerOnly: true",
  "activeStepKey",
]) {
  includes("user execution flow model", model, expected);
}

for (const expected of [
  "evaluatePhase8UserExecutionFlow",
  "phase8UserExecutionFlow",
  "Phase 8 user execution flow",
  "phase-8-user-flow-panel",
  "phase-8-user-flow-track",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-8-user-flow-panel",
  ".phase-8-user-flow-track",
  ".phase-8-user-flow-step.step-current",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 8 user execution flow checks passed.",
  "ready_to_submit",
  "public_visibility_forbidden",
  "telegram_execution_forbidden",
]) {
  includes("user execution flow test", test, expected);
}

for (const expected of [
  '"test:phase-8-user-execution-flow"',
  '"check:phase-8-user-execution-flow"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8UserExecutionFlow|phase8UserExecutionFlow|user execution flow/u,
    "Phase 8 user execution flow in Telegram authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8UserExecutionFlow|phase8UserExecutionFlow|user execution flow/u,
    "Phase 8 user execution flow in public surfaces",
  );
}

console.log("Phase 8 user execution flow checks passed.");