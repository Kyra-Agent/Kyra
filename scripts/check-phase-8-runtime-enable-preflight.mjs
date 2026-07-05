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
const model = read("src/types/phase8RuntimeEnablementPreflight.ts");
const test = read("scripts/test-phase-8-runtime-enable-preflight.mjs");
const dashboard = read("src/pages/Dashboard.tsx");
const submitter = read("src/components/Phase8ControlledSubmitter.tsx");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx|js|jsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 21 first controlled low-value live run.",
  "Batch 10 - Runtime Enablement Preflight",
  "runtime flag",
  "owner session",
  "selected deployed agent",
  "connected owner Base Account",
  "owner live-window activation",
  "Telegram and public profiles remain blocked",
  "Batch 11 - Base ETH Gas Readiness Guard",
  "zero-value transaction still needs Base ETH for gas",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "In progress: Batch 21",
  "Batch 10 evidence",
  "runtime enablement preflight",
  "src/types/phase8RuntimeEnablementPreflight.ts",
  "scripts/test-phase-8-runtime-enable-preflight.mjs",
  "scripts/check-phase-8-runtime-enable-preflight.mjs",
  "Batch 11 evidence",
  "Base ETH gas readiness guard",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "evaluatePhase8RuntimeEnablementPreflight",
  "runtime_flag_required",
  "owner_session_required",
  "selected_agent_required",
  "base_account_required",
  "controlled_submission_required",
  "live_window_activation_required",
  "result_already_recorded",
  "telegram_authority_forbidden",
  "public_visibility_forbidden",
  "runtimeSubmitterEnabled: true",
]) {
  includes("preflight model", model, expected);
}

for (const expected of [
  "Phase 8 runtime enablement preflight checks passed.",
  "runtime_flag_required",
  "controlled_submission_required",
  "live_window_activation_required",
  "result_already_recorded",
  "telegram_authority_forbidden",
]) {
  includes("preflight test", test, expected);
}

for (const expected of [
  "evaluatePhase8RuntimeEnablementPreflight",
  "phase8RuntimeEnablementPreflight",
  "runtimeSubmitterEnabled",
  "phase8ControlledSubmission.resultCloseoutRecorded",
  "baseAccountConnectionStatus.connected",
  "baseAccountAddress={baseAccountConnectionStatus.address}",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  "preflight: Phase8RuntimeEnablementPreflightResult",
  "preflight.runtimeSubmitterEnabled",
  "Phase 8 Batch 11 submitter",
  "Runtime preflight",
  "useBalance",
  "baseAccountAddress: `0x${string}` | null",
  "gasReady",
  "Base ETH gas",
  "evaluatePhase8FundingReadiness",
  "seed phrase, or private-key path",
]) {
  includes("submitter", submitter, expected);
}

for (const expected of [
  '"test:phase-8-runtime-preflight"',
  '"check:phase-8-runtime-preflight"',
  "npm run check:phase-8-runtime-preflight",
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /phase8RuntimeEnablementPreflight|evaluatePhase8RuntimeEnablementPreflight|runtimeSubmitterEnabled|useBalance|baseGasBalance|gasReady|useSendTransaction|sendTransaction|eth_sendTransaction/u,
    "Phase 8 runtime enablement Telegram authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /phase8RuntimeEnablementPreflight|evaluatePhase8RuntimeEnablementPreflight|runtimeSubmitterEnabled|useBalance|baseGasBalance|gasReady|useSendTransaction|sendTransaction|eth_sendTransaction/u,
    "Phase 8 runtime enablement public authority",
  );
}

console.log("Phase 8 runtime enablement preflight checks passed.");
