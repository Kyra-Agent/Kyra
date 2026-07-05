import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function read(path) {
  return readFileSync(resolve(root, path), "utf8");
}

const component = read("src/components/Phase8LowValueSubmitter.tsx");
const config = read("src/config/appConfig.ts");
const dashboard = read("src/pages/Dashboard.tsx");

for (const expected of [
  "Phase8LowValueSubmitter",
  "phase8LowValueSubmission === \"owner_low_value_window\"",
  "readiness.canEnterLowValueReview",
  "submitRequest.ok",
  "ownerWindowArmed",
  "resultAlreadyRecorded",
  "sendTransaction.sendTransactionAsync(submitRequest.request)",
  "createPhase8SubmittedCloseoutEvent",
  "onResultCloseout?.(closeout.event)",
  "Telegram, public profiles, token approvals",
]) {
  assert(component.includes(expected), `component must include ${expected}`);
}

for (const expected of [
  "VITE_KYRA_PHASE8_LOW_VALUE_SUBMISSION",
  "owner_low_value_window",
  "phase8LowValueSubmission: phase8LowValueSubmissionRuntime",
]) {
  assert(config.includes(expected), `config must include ${expected}`);
}

for (const expected of [
  "Phase8LowValueSubmitter",
  "readiness={phase8LowValueTransactionReadiness}",
  "submitRequest={phase8LowValueSubmitRequest}",
  "onResultCloseout={handlePhase8ResultCloseout}",
]) {
  assert(dashboard.includes(expected), `dashboard must include ${expected}`);
}

console.log("Phase 8 low-value submitter gate checks passed.");
