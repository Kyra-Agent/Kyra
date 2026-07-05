import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
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
  if (stat.isFile()) return [path];
  return readdirSync(absolutePath, { withFileTypes: true }).flatMap((entry) => {
    const childPath = `${path}/${entry.name}`;
    if (entry.isDirectory()) return walkFiles(childPath);
    return entry.isFile() ? [childPath] : [];
  });
}

const phase9Doc = read("docs/phase-9-public-execution-hardening.md");
const roadmap = read("docs/product-phase-roadmap.md");
const model = read("src/types/phase9Closeout.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-9-closeout.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path)
  && !path.endsWith("phase9PublicPrivacyRelease.ts"));

for (const expected of [
  "## Phase 9 Closeout",
  "Phase 9 public execution hardening is structurally complete",
  "public execution runtime remains disabled",
  "Phase 10 release readiness can start",
]) {
  includes("Phase 9 doc", phase9Doc, expected);
}

for (const expected of [
  "| 9 | Public Execution Hardening | Rate limits, rollback, incident controls, monitoring, privacy audits, abuse controls, and wider execution eligibility. | Structurally complete; runtime default-off |",
  "Phase 9 public execution hardening is structurally complete",
  "Phase 10 release readiness can start",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "evaluatePhase9Closeout",
  "execution_eligibility_required",
  "public_privacy_release_required",
  "publicExecutionRuntimeEnabled: false",
  "phase9StructurallyComplete",
]) {
  includes("Phase 9 closeout model", model, expected);
}

for (const expected of [
  "evaluatePhase9Closeout",
  "phase9Closeout",
  "Phase 9 closeout",
  "phase-9-closeout-panel",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-9-closeout-panel",
  ".phase-9-closeout-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 9 closeout checks passed.",
  "publicExecutionRuntimeEnabled === false",
  "phase10_readiness_required",
]) {
  includes("Phase 9 closeout test", test, expected);
}

for (const expected of [
  '"test:phase-9-closeout"',
  '"check:phase-9-closeout"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase9Closeout|phase9Closeout|phase9StructurallyComplete/u,
    "Phase 9 closeout authority in Telegram webhook",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase9Closeout|phase9Closeout|phase9StructurallyComplete/u,
    "Phase 9 closeout authority in public surfaces",
  );
}

console.log("Phase 9 closeout checks passed.");