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

const doc = read("docs/phase-8-controlled-live-transaction.md");
const roadmap = read("docs/product-phase-roadmap.md");
const readme = read("README.md");
const component = read("src/components/Phase8LowValueSubmitter.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const packageJson = read("package.json");
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = walkFiles("src")
  .filter((path) => /\.(?:ts|tsx)$/u.test(path) && /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 21 first controlled low-value live run.",
  "Batch 21 - First Controlled Low-Value Live Run",
  "Batch 21 finalizes the first controlled low-value live-run UI boundary",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "In progress: Batch 21",
  "Batch 21 evidence",
  "first controlled low-value live run",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "| 8 | In progress: controlled live transaction Batch 21 |",
  "first controlled low-value live run",
]) {
  includes("README", readme, expected);
}

for (const expected of [
  "Phase 8 Batch 21 low-value live run",
  "hasCloseoutScope",
  "closeoutScope.ownerUserId.trim()",
  "closeoutScope.workspaceId.trim()",
  "closeoutScope.agentId.trim()",
  "closeoutScope.preparedActionId.trim()",
  "closeoutScope.submissionNonce.trim()",
  "Owner closeout scope must be complete before low-value submit.",
  "setSubmittedHash(hash)",
  "Hash: {maskHash(submittedHash)}",
  "function maskHash",
  "sendTransaction.sendTransactionAsync(submitRequest.request)",
  "createPhase8SubmittedCloseoutEvent",
]) {
  includes("low-value submitter component", component, expected);
}

for (const expected of [
  "Low-value request is ready for the isolated owner-dashboard submitter.",
  "closeoutScope={{",
  "onResultCloseout={handlePhase8ResultCloseout}",
]) {
  includes("Dashboard", dashboard, expected);
}

for (const expected of [
  '"check:phase-8-low-value-live-run"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /Phase8LowValueSubmitter|phase8LowValueSubmission|owner_low_value_window|low-value live run|sendTransaction/u,
    "Batch 21 low-value live-run authority in Telegram",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /Phase8LowValueSubmitter|phase8LowValueSubmission|owner_low_value_window|low-value live run|sendTransaction/u,
    "Batch 21 low-value live-run authority in public surfaces",
  );
}

console.log("Phase 8 Batch 21 first controlled low-value live run checks passed.");
