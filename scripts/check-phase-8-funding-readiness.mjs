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
const model = read("src/types/phase8FundingReadiness.ts");
const submitter = read("src/components/Phase8ControlledSubmitter.tsx");
const styles = read("src/styles.css");
const test = read("scripts/test-phase-8-funding-readiness.mjs");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 25 production closeout.",
  "Batch 14 - Funding and Gas UX",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "Complete: controlled live transaction implementation closeout",
  "Batch 14 evidence",
  "src/types/phase8FundingReadiness.ts",
  "scripts/test-phase-8-funding-readiness.mjs",
  "scripts/check-phase-8-funding-readiness.mjs",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "Product Snapshot",
  "Robinhood Chain wallet",
]) {
  includes("README", readme, expected);
}

for (const expected of [
  "evaluatePhase8FundingReadiness",
  "canOpenSubmitter",
  "privacyBoundary",
  "never stores private keys",
  "never asks Telegram or public profiles",
  "formatPhase8BaseEth",
]) {
  includes("funding model", model, expected);
}

for (const expected of [
  "evaluatePhase8FundingReadiness",
  "fundingReadiness.canOpenSubmitter",
  "phase-8-funding-guide",
  "Funding required",
  "No Telegram, public profile, token approval, swap, calldata, non-zero value, seed phrase, or private-key path is allowed here.",
]) {
  includes("submitter", submitter, expected);
}

for (const expected of [
  ".phase-8-funding-guide",
  "rgba(245, 158, 11",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  "Phase 8 funding readiness checks passed.",
  "zero-value",
  "Base ETH",
  "wallet_required",
]) {
  includes("funding test", test, expected);
}

for (const expected of [
  '"test:phase-8-funding-readiness"',
  '"check:phase-8-funding-readiness"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8FundingReadiness|phase8FundingReadiness|phase-8-funding-guide|fundingReadiness/u,
    "Phase 8 funding UX in Telegram authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /evaluatePhase8FundingReadiness|phase8FundingReadiness|phase-8-funding-guide|fundingReadiness/u,
    "Phase 8 funding UX in public surfaces",
  );
}

console.log("Phase 8 funding readiness checks passed.");
