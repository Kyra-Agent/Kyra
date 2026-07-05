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
const model = read("src/types/phase8SecurityAbuseHardening.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const submitter = read("src/components/Phase8LowValueSubmitter.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-8-security-abuse-hardening.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 24 security and abuse hardening.",
  "Batch 24 - Security And Abuse Hardening",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "In progress: Batch 24",
  "Batch 24 evidence",
  "src/types/phase8SecurityAbuseHardening.ts",
  "scripts/test-phase-8-security-abuse-hardening.mjs",
  "scripts/check-phase-8-security-abuse-hardening.mjs",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "| 8 | In progress: controlled live transaction Batch 24 |",
  "security and abuse hardening",
]) {
  includes("README", readme, expected);
}

for (const expected of [
  "evaluatePhase8SecurityAbuseHardening",
  "canOpenSubmitter",
  "replay_nonce_detected",
  "result_already_recorded",
  "telegram_execution_forbidden",
  "public_visibility_forbidden",
  "unsanitized_failure_forbidden",
]) {
  includes("security hardening model", model, expected);
}

for (const expected of [
  "evaluatePhase8SecurityAbuseHardening",
  "phase8SecurityAbuseHardening",
  "Phase 8 security hardening",
  "phase-8-security-hardening-panel",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  "securityCanOpenSubmitter",
  "securityBlockReasons",
  "Security hardening blocked this submitter window.",
]) {
  includes("submitter", submitter, expected);
}

for (const expected of [
  ".phase-8-security-hardening-panel",
  ".phase-8-security-hardening-grid",
  ".security-blocked",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 8 security and abuse hardening checks passed.",
  "replay_nonce_detected",
  "unsanitized_failure_forbidden",
  "failed_safe",
]) {
  includes("security hardening test", test, expected);
}

for (const expected of [
  '"test:phase-8-security-abuse-hardening"',
  '"check:phase-8-security-abuse-hardening"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8SecurityAbuseHardening|phase8SecurityAbuseHardening|security hardening/u,
    "Phase 8 security hardening in Telegram authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8SecurityAbuseHardening|phase8SecurityAbuseHardening|security hardening/u,
    "Phase 8 security hardening in public surfaces",
  );
}

console.log("Phase 8 security and abuse hardening checks passed.");