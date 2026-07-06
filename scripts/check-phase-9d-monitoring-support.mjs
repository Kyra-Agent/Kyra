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
const model = read("src/types/phase9MonitoringSupport.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-9d-monitoring-support.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /^(?:src\/pages|src\/components)\//u.test(path) && /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "## Batch 9D - Monitoring, Support, and Owner Evidence",
  "Netlify health",
  "Supabase health",
  "Edge Functions health",
  "owner-safe support copy",
  "aggregated analytics",
  "privacy-preserving public analytics",
]) {
  includes("Phase 9 doc", phase9Doc, expected);
}

for (const expected of [
  "Monitoring, support, and owner evidence",
  "production health panels for Netlify, Supabase, Edge Functions, transaction verification, and public execution gates",
  "owner-safe support copy and debugging states",
  "public analytics aggregated and privacy-preserving",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "evaluatePhase9MonitoringSupport",
  "netlify_health_required",
  "supabase_health_required",
  "edge_function_health_required",
  "raw_wallet_internals_forbidden",
  "telegram_token_exposure_forbidden",
  "provider_payload_exposure_forbidden",
  "canProceedToPrivacyGate",
]) {
  includes("Phase 9D model", model, expected);
}

for (const expected of [
  "evaluatePhase9MonitoringSupport",
  "phase9MonitoringSupport",
  "Monitoring and support",
  "phase-9-monitoring-support-panel",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-9-monitoring-support-panel",
  ".phase-9-monitoring-support-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 9D monitoring and support checks passed.",
  "raw_wallet_internals_forbidden",
  "telegram_token_exposure_forbidden",
  "provider_payload_exposure_forbidden",
]) {
  includes("Phase 9D test", test, expected);
}

for (const expected of [
  '"test:phase-9d-monitoring-support"',
  '"check:phase-9d"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase9MonitoringSupport|phase9MonitoringSupport|canProceedToPrivacyGate/u,
    "Phase 9D monitoring support authority in Telegram webhook",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase9MonitoringSupport|phase9MonitoringSupport|canProceedToPrivacyGate/u,
    "Phase 9D monitoring support authority in public surfaces",
  );
}

console.log("Phase 9D monitoring, support, and owner evidence checks passed.");