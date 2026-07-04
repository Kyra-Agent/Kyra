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
const appConfig = read("src/config/appConfig.ts");
const submitter = read("src/components/Phase8ControlledSubmitter.tsx");
const requestBuilder = read("src/types/phase8OwnerSubmitRequest.ts");
const requestTest = read("scripts/test-phase-8-owner-submit-request.mjs");
const dashboard = read("src/pages/Dashboard.tsx");
const styles = read("src/styles.css");
const packageJson = read("package.json");
const sourceFiles = walkFiles("src").filter((path) => /\.(?:ts|tsx|js|jsx)$/u.test(path));
const telegramFiles = walkFiles("supabase/functions/telegram-webhook")
  .filter((path) => /\.ts$/u.test(path) && !path.endsWith("_test.ts"));
const publicFiles = sourceFiles.filter((path) => /Public|AgentProfile|public/i.test(path));

for (const expected of [
  "Status: Batch 9 owner-only result closeout bridge.",
  "Owner Dashboard Submitter Wiring",
  "isolated `Phase8ControlledSubmitter` component",
  "zero-value/no-calldata/Base-only request builder",
  "VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION=owner_approved_window",
  "default production state remains `disabled`",
  "User wallet authority and user Telegram bot-token privacy remain priority one",
]) {
  includes("Phase 8 doc", doc, expected);
}

for (const expected of [
  "Batch 5 evidence",
  "isolated owner dashboard submitter boundary",
  "src/components/Phase8ControlledSubmitter.tsx",
  "src/types/phase8OwnerSubmitRequest.ts",
  "scripts/test-phase-8-owner-submit-request.mjs",
  "scripts/check-phase-8-controlled-submitter.mjs",
  "Status: Batch 9 owner-only result closeout bridge.",
]) {
  includes("roadmap", roadmap, expected);
}

for (const expected of [
  "VITE_KYRA_PHASE8_CONTROLLED_SUBMISSION",
  "owner_approved_window",
  "phase8ControlledSubmission: phase8ControlledSubmissionRuntime",
  "walletExecution: \"disabled\"",
]) {
  includes("app config", appConfig, expected);
}

for (const expected of [
  "useSendTransaction",
  "createPhase8OwnerSubmitRequest",
  "phase8ControlledSubmission === \"owner_approved_window\"",
  "submission.transactionSubmissionAllowed",
  "No Telegram, public profile, token approval, swap, calldata, or non-zero value path is allowed here.",
]) {
  includes("submitter", submitter, expected);
}

for (const expected of [
  "createPhase8OwnerSubmitRequest",
  "value: 0n",
  "chainId: baseChainId",
  "zero_value_required",
  "no_calldata_required",
  "recipient_required",
]) {
  includes("request builder", requestBuilder, expected);
}

for (const expected of [
  "Phase 8 owner submit request checks passed.",
  "zero_value_required",
  "no_calldata_required",
  "base_chain_required",
  "recipient_required",
]) {
  includes("request test", requestTest, expected);
}

for (const expected of [
  "Phase8ControlledSubmitter",
  "phase8ControlledSubmission",
]) {
  includes("dashboard", dashboard, expected);
}

for (const expected of [
  ".phase-8-submit-boundary",
  ".phase-8-submit-boundary-grid",
]) {
  includes("styles", styles, expected);
}

for (const expected of [
  '"test:phase-8-owner-submit-request"',
  '"check:phase-8-submitter"',
]) {
  includes("package.json", packageJson, expected);
}

for (const path of sourceFiles) {
  const source = read(path);
  const allowed = path === "src/components/Phase8ControlledSubmitter.tsx" ||
    path === "src/providers/WalletRuntimeProviders.tsx";

  if (allowed) {
    continue;
  }

  excludes(
    path,
    source,
    /useSendTransaction|sendTransaction|writeContract|eth_sendTransaction|signMessage|signTypedData/u,
    "wallet execution calls outside isolated Phase 8 submitter boundary",
  );
}

for (const path of telegramFiles) {
  excludes(
    path,
    read(path),
    /Phase8ControlledSubmitter|createPhase8OwnerSubmitRequest|useSendTransaction|sendTransaction|writeContract|eth_sendTransaction/u,
    "Phase 8 submitter Telegram execution authority",
  );
}

for (const path of publicFiles) {
  excludes(
    path,
    read(path),
    /Phase8ControlledSubmitter|createPhase8OwnerSubmitRequest|useSendTransaction|sendTransaction|writeContract|eth_sendTransaction/u,
    "Phase 8 submitter public execution authority",
  );
}

console.log("Phase 8 controlled submitter checks passed.");
