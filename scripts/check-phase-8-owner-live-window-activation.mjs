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
const model = read("src/types/phase8OwnerLiveWindowActivation.ts");
const candidate = read("src/types/phase8OwnerActionCandidate.ts");
const test = read("scripts/test-phase-8-owner-live-window-activation.mjs");
const candidateTest = read("scripts/test-phase-8-owner-action-candidate.mjs");
const submitter = read("src/components/Phase8ControlledSubmitter.tsx");
const baseAccountPanel = read("src/components/BaseAccountConnectionPanel.tsx");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx|js|jsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 13 result persistence hardening.",
  "Owner Live-Window Activation Lock",
  "Owner Arming UX",
  "Owner Self-Check Candidate",
  "Owner-Only Result Closeout Bridge",
  "owner live-window activation result",
  "owner arming control",
  "operator acknowledgement must be recorded",
  "src/types/phase8OwnerLiveWindowActivation.ts",
  "src/types/phase8OwnerActionCandidate.ts",
  "scripts/test-phase-8-owner-live-window-activation.mjs",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "In progress: Batch 13",
  "Batch 9 evidence",
  "owner live-window activation lock",
  "owner arming UX",
  "owner self-check candidate",
  "owner-only result closeout bridge",
  "src/types/phase8OwnerLiveWindowActivation.ts",
  "src/types/phase8OwnerActionCandidate.ts",
  "scripts/check-phase-8-owner-live-window-activation.mjs",
  "Status: Batch 13 result persistence hardening.",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "evaluatePhase8OwnerLiveWindowActivation",
  "runtime_window_disabled",
  "controlled_submission_required",
  "operator_ack_required",
  "rollback_required",
  "emergency_disable_required",
  "post_transaction_audit_required",
  "owner_dashboard_required",
  "transactionSubmissionAllowed: true",
]) {
  includes("activation model", model, expected);
}

for (const expected of [
  "createPhase8OwnerActionCandidate",
  "base_account_address_required",
  "Owner Base Account self-check controlled transaction.",
  "Zero ETH, no token spend, no calldata, self-address recipient.",
]) {
  includes("owner action candidate", candidate, expected);
}

for (const expected of [
  "Phase 8 owner live-window activation checks passed.",
  "runtime_window_disabled",
  "controlled_submission_required",
  "operator_ack_required",
  "owner_dashboard_required",
]) {
  includes("activation test", test, expected);
}

for (const expected of [
  "Phase 8 owner action candidate checks passed.",
  "base_account_address_required",
  "base_chain_required",
]) {
  includes("owner action candidate test", candidateTest, expected);
}

for (const expected of [
  "address: `0x${string}` | null",
  "address: binding?.address ?? null",
]) {
  includes("base account panel", baseAccountPanel, expected);
}

for (const expected of [
  "Phase8OwnerLiveWindowActivationResult",
  "activation.transactionSubmissionAllowed",
  "Phase 8 Batch 11 submitter",
  "Window armed",
  "onResultCloseout",
  "Submitted with sanitized hash reference.",
  "Activation blocked by",
]) {
  includes("submitter", submitter, expected);
}

for (const expected of [
  "evaluatePhase8OwnerLiveWindowActivation",
  "phase8OwnerLiveWindowActivation",
  "phase8OwnerActionCandidate",
  "phase8SubmitterResult",
  "createPhase8OwnerActionCandidate",
  "baseAccountAddress: baseAccountConnectionStatus.address",
  "providerStatus: phase8SubmitterResult ? \"provider_submitted\" : \"not_started\"",
  "txHash: phase8SubmitterResult?.txHash ?? null",
  "resultEvents: phase8SubmitterResult ? [phase8SubmitterResult] : []",
  "onResultCloseout={handlePhase8ResultCloseout}",
  "phase8OwnerArming",
  "phase8FrozenAction",
  "activePhase8OwnerArming",
  "armPhase8OwnerLiveWindow",
  "resetPhase8OwnerLiveWindow",
  "operatorAcknowledged: Boolean(activePhase8OwnerArming)",
  "promptNonce: activePhase8OwnerArming?.promptNonce ?? null",
  "submissionNonce: activePhase8OwnerArming?.submissionNonce ?? null",
  "submissionState: phase8SubmitterResult",
  "? phase8SubmitterResult.state",
  "Arm owner live window",
  "Reset window",
  "phase-8-owner-candidate-panel",
  "owner self-check",
  "Phase 8 live-window activation",
  "activation={phase8OwnerLiveWindowActivation}",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-8-live-window-activation-panel",
  ".phase-8-live-window-activation-grid",
  ".phase-8-live-window-activation-actions",
  ".phase-8-owner-candidate-panel",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  '"test:phase-8-owner-live-window-activation"',
  '"test:phase-8-owner-action-candidate"',
  '"check:phase-8-owner-live-window"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /phase8OwnerLiveWindowActivation|evaluatePhase8OwnerLiveWindowActivation|Phase8ControlledSubmitter|createPhase8OwnerActionCandidate|useSendTransaction|sendTransaction|eth_sendTransaction/u,
    "Phase 8 owner live-window activation Telegram authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /phase8OwnerLiveWindowActivation|evaluatePhase8OwnerLiveWindowActivation|Phase8ControlledSubmitter|createPhase8OwnerActionCandidate|useSendTransaction|sendTransaction|eth_sendTransaction/u,
    "Phase 8 owner live-window activation public authority",
  );
}

console.log("Phase 8 owner live-window activation checks passed.");
