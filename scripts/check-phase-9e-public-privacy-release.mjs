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
const model = read("src/types/phase9PublicPrivacyRelease.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-9e-public-privacy-release.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path)
  && !path.endsWith("phase9PublicPrivacyRelease.ts"));

for (const expected of [
  "## Batch 9E - Public Privacy and Release Gate",
  "landing page audit",
  "public agent profile audit",
  "Telegram response audit",
  "Edge Function error audit",
  "wallet address exposure",
  "transaction intent internals",
  "raw error details",
]) {
  includes("Phase 9 doc", phase9Doc, expected);
}

for (const expected of [
  "Public privacy and release gate",
  "Audit landing page, public agent profiles, Telegram responses, dashboard copy, logs, docs, and Edge Function errors",
  "wallet addresses beyond owner-approved display, token refs, session ids, internal ids, provider payload refs, transaction intent internals, or raw error details",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "evaluatePhase9PublicPrivacyRelease",
  "landing_audit_required",
  "public_profile_audit_required",
  "telegram_response_audit_required",
  "wallet_address_exposure_forbidden",
  "transaction_intent_internal_exposure_forbidden",
  "raw_error_detail_exposure_forbidden",
  "canProceedToPhase10",
]) {
  includes("Phase 9E model", model, expected);
}

for (const expected of [
  "evaluatePhase9PublicPrivacyRelease",
  "phase9PublicPrivacyRelease",
  "Public privacy gate",
  "phase-9-public-privacy-panel",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-9-public-privacy-panel",
  ".phase-9-public-privacy-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 9E public privacy release checks passed.",
  "wallet_address_exposure_forbidden",
  "transaction_intent_internal_exposure_forbidden",
  "raw_error_detail_exposure_forbidden",
]) {
  includes("Phase 9E test", test, expected);
}

for (const expected of [
  '"test:phase-9e-public-privacy-release"',
  '"check:phase-9e"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase9PublicPrivacyRelease|phase9PublicPrivacyRelease|canProceedToPhase10/u,
    "Phase 9E public privacy release authority in Telegram webhook",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase9PublicPrivacyRelease|phase9PublicPrivacyRelease|canProceedToPhase10/u,
    "Phase 9E public privacy release authority in public surfaces",
  );
}

console.log("Phase 9E public privacy and release gate checks passed.");