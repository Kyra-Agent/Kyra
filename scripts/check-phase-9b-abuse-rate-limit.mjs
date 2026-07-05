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
const model = read("src/types/phase9AbuseRateLimit.ts");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-9b-abuse-rate-limit.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "## Batch 9B - Abuse, Rate Limit, and Value-Limit Enforcement",
  "per-owner, per-agent, per-workspace, per-route, and per-wallet limits",
  "provider failure backoff",
  "sanitized decisions",
]) {
  includes("Phase 9 doc", phase9Doc, expected);
}

for (const expected of [
  "Abuse, rate limit, and value-limit enforcement",
  "per-owner, per-agent, per-workspace, per-route, and per-wallet rate limits",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "evaluatePhase9AbuseRateLimit",
  "owner_rate_limit_exceeded",
  "nonce_replay_detected",
  "duplicate_submit_detected",
  "provider_backoff_active",
  "telegram_token_ref_forbidden",
  "provider_payload_ref_forbidden",
  "canProceedToIncidentControls",
]) {
  includes("Phase 9B model", model, expected);
}

for (const expected of [
  "evaluatePhase9AbuseRateLimit",
  "phase9AbuseRateLimit",
  "Phase 9B abuse and rate limit",
  "phase-9-abuse-rate-limit-panel",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-9-abuse-rate-limit-panel",
  ".phase-9-abuse-rate-limit-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 9B abuse and rate-limit checks passed.",
  "owner_rate_limit_exceeded",
  "duplicate_submit_detected",
  "telegram_token_ref_forbidden",
]) {
  includes("Phase 9B test", test, expected);
}

for (const expected of [
  '"test:phase-9b-abuse-rate-limit"',
  '"check:phase-9b"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase9AbuseRateLimit|phase9AbuseRateLimit|canProceedToIncidentControls/u,
    "Phase 9B execution authority in Telegram webhook",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase9AbuseRateLimit|phase9AbuseRateLimit|canProceedToIncidentControls/u,
    "Phase 9B execution authority in public surfaces",
  );
}

console.log("Phase 9B abuse and rate-limit hardening checks passed.");