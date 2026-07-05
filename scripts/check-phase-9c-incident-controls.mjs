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
const model = read("src/types/phase9IncidentControls.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-9c-incident-controls.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "## Batch 9C - Incident, Rollback, and Emergency Controls",
  "emergency disable switch",
  "rollback runbook",
  "post-incident owner-only audit",
  "stuck receipt verification",
]) {
  includes("Phase 9 doc", phase9Doc, expected);
}

for (const expected of [
  "Incident, rollback, and emergency controls",
  "rejected prompts, insufficient gas, reverted transactions, provider outage, chain mismatch, stale approval, stale prepared action, and stuck receipt verification",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "evaluatePhase9IncidentControls",
  "emergency_disable_required",
  "rollback_runbook_required",
  "provider_outage_handler_required",
  "stuck_receipt_handler_required",
  "telegram_incident_authority_forbidden",
  "canProceedToMonitoring",
]) {
  includes("Phase 9C model", model, expected);
}

for (const expected of [
  "evaluatePhase9IncidentControls",
  "phase9IncidentControls",
  "Phase 9C incident controls",
  "phase-9-incident-controls-panel",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-9-incident-controls-panel",
  ".phase-9-incident-controls-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 9C incident controls checks passed.",
  "emergency_disable_required",
  "stuck_receipt_handler_required",
  "telegram_incident_authority_forbidden",
]) {
  includes("Phase 9C test", test, expected);
}

for (const expected of [
  '"test:phase-9c-incident-controls"',
  '"check:phase-9c"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase9IncidentControls|phase9IncidentControls|canProceedToMonitoring/u,
    "Phase 9C incident control authority in Telegram webhook",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase9IncidentControls|phase9IncidentControls|canProceedToMonitoring/u,
    "Phase 9C incident control authority in public surfaces",
  );
}

console.log("Phase 9C incident, rollback, and emergency controls checks passed.");