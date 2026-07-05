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
const model = read("src/types/phase8ResultPersistence.ts");
const store = read("src/services/phase8ResultPersistenceStore.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const test = read("scripts/test-phase-8-result-persistence.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 20 live balance and gas readiness.",
  "Batch 13 - Owner-Only Result Persistence",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "| 8 | Controlled Live Transaction",
  "In progress: Batch 20",
  "Batch 13 evidence",
  "src/types/phase8ResultPersistence.ts",
  "src/services/phase8ResultPersistenceStore.ts",
  "scripts/test-phase-8-result-persistence.mjs",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "| 8 | In progress: controlled live transaction Batch 20 |",
  "result persistence hardening",
]) {
  includes("README", readme, expected);
}

for (const expected of [
  "createPhase8PersistedExecutionResult",
  "owner_scope_required",
  "owner_only_required",
  "sanitized_event_required",
  "transaction_hash_required",
  "mapPhase8PersistedResultToDemoExecutionResult",
  "visibility: \"owner-only\"",
]) {
  includes("result persistence model", model, expected);
}

for (const expected of [
  "sessionStorage",
  "kyra.phase8.ownerExecutionResults.v1",
  "visibility === \"owner-only\"",
  "maxStoredResults",
]) {
  includes("result persistence store", store, expected);
}

for (const expected of [
  "phase8PersistedResults",
  "handlePhase8ResultCloseout",
  "createPhase8PersistedExecutionResult",
  "savePhase8PersistedExecutionResult",
  "mapPhase8PersistedResultToDemoExecutionResult",
  "onResultCloseout={handlePhase8ResultCloseout}",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  "Phase 8 result persistence checks passed.",
  "owner_only_required",
  "sanitized_event_required",
  "unsupported_state",
  "transaction_hash_required",
]) {
  includes("result persistence test", test, expected);
}

for (const expected of [
  '"test:phase-8-result-persistence"',
  '"check:phase-8-result-persistence"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /phase8PersistedResults|Phase8PersistedExecutionResult|savePhase8PersistedExecutionResult|kyra\.phase8\.ownerExecutionResults/u,
    "Phase 8 owner result persistence in public surfaces",
  );
}

console.log("Phase 8 result persistence checks passed.");
