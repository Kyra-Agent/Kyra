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
const model = read("src/types/phase8LowValueSubmitRequest.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-8-low-value-submit-request.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 25 production closeout.",
  "Batch 18 - Low-Value Submit Request Skeleton",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "Complete: controlled live transaction implementation closeout",
  "Batch 18 evidence",
  "src/types/phase8LowValueSubmitRequest.ts",
  "scripts/test-phase-8-low-value-submit-request.mjs",
  "scripts/check-phase-8-low-value-submit-request.mjs",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "Product Snapshot",
  "Base Account",
]) {
  includes("README", readme, expected);
}

includes("context", context, "Controlled Live Transaction - complete as owner-controlled execution architecture.");

for (const expected of [
  "createPhase8LowValueSubmitRequest",
  "maxValueWei: \"100000000000000\"",
  "ownerOnly: true",
  "value_cap_exceeded",
  "no_calldata_required",
  "token_approval_forbidden",
  "telegram_forbidden",
  "public_profile_forbidden",
]) {
  includes("low-value submit request model", model, expected);
}

for (const expected of [
  "createPhase8LowValueSubmitRequest",
  "phase8LowValueSubmitRequest",
  "Low-value request",
  "phase-8-low-value-request-panel",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-8-low-value-request-panel",
  ".phase-8-low-value-request-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 8 low-value submit request checks passed.",
  "value_cap_exceeded",
  "telegram_forbidden",
]) {
  includes("low-value submit request test", test, expected);
}

for (const expected of [
  '"test:phase-8-low-value-submit-request"',
  '"check:phase-8-low-value-submit-request"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /createPhase8LowValueSubmitRequest|phase8LowValueSubmitRequest|phase-8-low-value-request/u,
    "Phase 8 low-value submit request in Telegram authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /createPhase8LowValueSubmitRequest|phase8LowValueSubmitRequest|phase-8-low-value-request/u,
    "Phase 8 low-value submit request in public surfaces",
  );
}

console.log("Phase 8 low-value submit request checks passed.");
