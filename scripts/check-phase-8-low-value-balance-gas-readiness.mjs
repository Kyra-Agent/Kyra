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
const dashboard = read("src/pages/Dashboard.tsx");
const sixC = read("scripts/check-phase-6c-wallet-handoff.mjs");
const sevenE = read("scripts/check-phase-7e-wallet-signing-boundary.mjs");
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = walkFiles("src")
  .filter((path) => /\.(?:ts|tsx)$/u.test(path) && /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 25 production closeout.",
  "Batch 20 - Live Balance And Gas Readiness",
  "Batch 20 wires live Base ETH balance into the low-value readiness gate",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "Complete: controlled live transaction implementation closeout",
  "Batch 20 evidence",
  "live Base ETH balance",
  "Phase 8 closeout path after Batch 20 used this working peg",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "Product Snapshot",
  "Base Account",
]) {
  includes("README", readme, expected);
}

for (const expected of [
  "useBalance",
  "phase8LowValueBaseBalance",
  "availableGasBalanceWei: phase8LowValueBaseBalance.data?.value.toString() ?? null",
  "formatPhase8BaseEth",
  "Live {currentProductChain.name} balance",
  "Gas/value source",
]) {
  includes("Dashboard", dashboard, expected);
}

excludes(
  "Dashboard low-value readiness",
  dashboard,
  /availableGasBalanceWei:\s*null/u,
  "null low-value balance source",
);

for (const expected of [
  "src/pages/Dashboard.tsx",
  "src/components/Phase8LowValueSubmitter.tsx",
]) {
  includes("Phase 6C allowlist", sixC, expected);
  includes("Phase 7E allowlist", sevenE, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /phase8LowValueBaseBalance|VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION|useBalance/u,
    "Batch 20 low-value balance authority in Telegram",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /phase8LowValueBaseBalance|VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION|useBalance/u,
    "Batch 20 low-value balance authority in public surfaces",
  );
}

console.log("Phase 8 Batch 20 low-value balance and gas readiness checks passed.");
