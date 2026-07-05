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
const model = read("src/types/phase8SmokeCloseout.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-8-smoke-closeout.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 18 low-value submit request skeleton.",
  "Batch 15 - Controlled Smoke Closeout",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "In progress: Batch 18",
  "Batch 15 evidence",
  "src/types/phase8SmokeCloseout.ts",
  "scripts/test-phase-8-smoke-closeout.mjs",
  "scripts/check-phase-8-smoke-closeout.mjs",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "| 8 | In progress: controlled live transaction Batch 18 |",
  "low-value submit request skeleton",
]) {
  includes("README", readme, expected);
}

for (const expected of [
  "evaluatePhase8SmokeCloseout",
  "canContinueToPublicHardening",
  "public_visibility_forbidden",
  "confirmation_required",
  "sanitized_failure_required",
  "ownerOnly: true",
]) {
  includes("smoke closeout model", model, expected);
}

for (const expected of [
  "evaluatePhase8SmokeCloseout",
  "phase8SmokeCloseout",
  "Phase 8 smoke closeout",
  "canContinueToPublicHardening",
  "phase-8-smoke-closeout-panel",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-8-smoke-closeout-panel",
  ".phase-8-smoke-closeout-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 8 smoke closeout checks passed.",
  "closed_confirmed",
  "closed_aborted",
  "public_visibility_forbidden",
]) {
  includes("smoke closeout test", test, expected);
}

for (const expected of [
  '"test:phase-8-smoke-closeout"',
  '"check:phase-8-smoke-closeout"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8SmokeCloseout|phase8SmokeCloseout|phase-8-smoke-closeout/u,
    "Phase 8 smoke closeout in Telegram authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8SmokeCloseout|phase8SmokeCloseout|phase-8-smoke-closeout/u,
    "Phase 8 smoke closeout in public surfaces",
  );
}

console.log("Phase 8 smoke closeout checks passed.");