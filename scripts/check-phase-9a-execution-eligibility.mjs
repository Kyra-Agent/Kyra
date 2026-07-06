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

    if (entry.isDirectory()) return walkFiles(childPath);
    return entry.isFile() ? [childPath] : [];
  });
}

const roadmap = read("docs/product-phase-roadmap.md");
const phase9Doc = read("docs/phase-9-public-execution-hardening.md");
const model = read("src/types/phase9ExecutionEligibility.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-9a-execution-eligibility.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /^(?:src\/pages|src\/components)\//u.test(path) && /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "# Phase 9 Public Execution Hardening",
  "## Batch 9A - Execution Eligibility Hardening",
  "public execution runtime remains default-off",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 9 doc", phase9Doc, expected);
}

for (const expected of [
  "Phase 9 working groups",
  "Execution eligibility hardening",
  "Abuse, rate limit, and value-limit enforcement",
  "Public privacy and release gate",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "evaluatePhase9ExecutionEligibility",
  "runtime_disabled",
  "telegram_execution_forbidden",
  "public_profile_execution_forbidden",
  "private_key_forbidden",
  "seed_phrase_forbidden",
  "publicExecutionAllowed",
  "canProceedToAbuseHardening",
]) {
  includes("Phase 9A model", model, expected);
}

for (const expected of [
  "evaluatePhase9ExecutionEligibility",
  "phase9ExecutionEligibility",
  "Public execution eligibility",
  "phase-9-execution-eligibility-panel",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-9-execution-eligibility-panel",
  ".phase-9-execution-eligibility-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 9A execution eligibility checks passed.",
  "ready_but_runtime_disabled",
  "telegram_execution_forbidden",
  "private_key_forbidden",
]) {
  includes("Phase 9A test", test, expected);
}

for (const expected of [
  '"test:phase-9a-execution-eligibility"',
  '"check:phase-9a"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase9ExecutionEligibility|phase9ExecutionEligibility|publicExecutionAllowed/u,
    "Phase 9 public execution authority in Telegram webhook",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase9ExecutionEligibility|phase9ExecutionEligibility|publicExecutionAllowed/u,
    "Phase 9 execution eligibility authority in public surfaces",
  );
}

console.log("Phase 9A execution eligibility hardening checks passed.");